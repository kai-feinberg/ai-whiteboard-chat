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
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.imageNodeId, {
      status: args.status,
      ...(args.imageStorageId && { imageStorageId: args.imageStorageId }),
      ...(args.width && { width: args.width }),
      ...(args.height && { height: args.height }),
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

    // Update status to processing
    await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
      imageNodeId: args.imageNodeId,
      status: "processing",
    });

    try {
      // TODO: Replace with actual image generation API call
      // For now, use placeholder image
      const placeholderUrl = `https://placehold.co/1024x1024/6366f1/white?text=AI+Generated+Image`;

      console.log(`[Image] Fetching placeholder image from: ${placeholderUrl}`);

      const response = await fetch(placeholderUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch placeholder image: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log(`[Image] Storing image blob (${blob.size} bytes)`);

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);
      console.log(`[Image] Image stored with ID: ${storageId}`);

      // Update node with completed status
      await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
        imageNodeId: args.imageNodeId,
        status: "completed",
        imageStorageId: storageId,
        width: 1024,
        height: 1024,
      });

      console.log(`[Image] Generation completed for node: ${args.imageNodeId}`);
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
