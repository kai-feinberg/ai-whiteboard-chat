// convex/canvas/images.ts
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Internal mutation to create image node (called from tool)
 */
export const createImageNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    prompt: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create image node data with pending status
    const imageNodeId = await ctx.db.insert("image_nodes", {
      organizationId: args.organizationId,
      prompt: args.prompt,
      isAiGenerated: true,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "image",
      position: args.position,
      width: 512, // Default image node width
      height: 512, // Default image node height (square for now)
      data: { nodeId: imageNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, imageNodeId };
  },
});

/**
 * Internal query to get image node (for background processing)
 */
export const getImageNodeInternal = internalQuery({
  args: {
    imageNodeId: v.id("image_nodes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageNodeId);
  },
});

/**
 * Internal mutation to update image node after generation
 */
export const updateImageNodeInternal = internalMutation({
  args: {
    imageNodeId: v.id("image_nodes"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    imageStorageId: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    kieTaskId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.imageNodeId, {
      status: args.status,
      ...(args.imageStorageId && { imageStorageId: args.imageStorageId }),
      ...(args.width && { width: args.width }),
      ...(args.height && { height: args.height }),
      ...(args.kieTaskId && { kieTaskId: args.kieTaskId }),
      ...(args.error && { error: args.error }),
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Background action to generate/fetch image and store it
 */
export const generateImageAsync = internalAction({
  args: {
    imageNodeId: v.id("image_nodes"),
  },
  handler: async (ctx, args) => {
    console.log(`[Image] Starting generation for node: ${args.imageNodeId}`);

    // Get image node
    const node = await ctx.runQuery(internal.canvas.images.getImageNodeInternal, {
      imageNodeId: args.imageNodeId,
    });

    if (!node) {
      console.error(`[Image] Node not found: ${args.imageNodeId}`);
      throw new Error("Image node not found");
    }

    console.log(`[Image] Generating image for prompt: ${node.prompt}`);

    try {
      // Build callback URL with imageNodeId as query param
      // Use Convex site URL (not frontend SITE_URL)
      const convexSiteUrl = process.env.CONVEX_SITE_URL;
      if (!convexSiteUrl) {
        throw new Error("CONVEX_SITE_URL environment variable is required for webhooks");
      }
      const callbackUrl = `${convexSiteUrl}/api/kie-callback?imageNodeId=${args.imageNodeId}`;

      console.log(`[Image] Calling Kie AI API with callback: ${callbackUrl}`);

      // Call Kie AI API
      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.KIE_AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/nano-banana",
          callBackUrl: callbackUrl,
          input: {
            prompt: node.prompt,
            output_format: "png",
            image_size: "1:1",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Kie AI error: ${data.msg || response.statusText}`);
      }

      console.log(`[Image] Task created successfully: ${data.data?.taskId}`);

      // Update node with processing status and store taskId
      await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
        imageNodeId: args.imageNodeId,
        status: "processing",
        kieTaskId: data.data?.taskId,
      });

      console.log(`[Image] Waiting for webhook callback for node: ${args.imageNodeId}`);

    } catch (error) {
      console.error(`[Image] Generation failed for node ${args.imageNodeId}:`, error);

      // Update node with failed status
      await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
        imageNodeId: args.imageNodeId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  },
});

/**
 * Process Kie AI webhook callback - download image and store in Convex
 */
export const processKieCallback = internalAction({
  args: {
    imageNodeId: v.id("image_nodes"),
    imageUrl: v.string(),
    status: v.literal("completed"),
  },
  handler: async (ctx, args) => {
    console.log(`[Image Callback] Processing webhook for node: ${args.imageNodeId}`);
    console.log(`[Image Callback] Downloading image from: ${args.imageUrl}`);

    try {
      // Download image from Kie AI URL
      const response = await fetch(args.imageUrl);

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log(`[Image Callback] Downloaded image blob (${blob.size} bytes)`);

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);
      console.log(`[Image Callback] Stored image with ID: ${storageId}`);

      // Update node with completed status
      await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
        imageNodeId: args.imageNodeId,
        status: "completed",
        imageStorageId: storageId,
        width: 1024,
        height: 1024,
      });

      console.log(`[Image Callback] Successfully completed image node: ${args.imageNodeId}`);

    } catch (error) {
      console.error(`[Image Callback] Failed to process callback for ${args.imageNodeId}:`, error);

      // Update node with failed status
      await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
        imageNodeId: args.imageNodeId,
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to download and store image",
      });
    }
  },
});
