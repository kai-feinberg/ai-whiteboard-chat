// convex/canvas/functions.ts
import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { autumn } from "../autumn";
import { internal } from "../_generated/api";

/**
 * List all canvases for the current organization
 */
export const listCanvases = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Query canvases by organization, sorted by most recently updated
    const canvases = await ctx.db
      .query("canvases")
      .withIndex("by_org_updated", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    return canvases;
  },
});

/**
 * Get a specific canvas by ID
 */
export const getCanvas = query({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get canvas
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) {
      return null;
    }

    // Verify ownership
    if (canvas.organizationId !== organizationId) {
      throw new Error("Canvas does not belong to your organization");
    }

    return canvas;
  },
});

/**
 * Get full canvas state with nodes and edges
 */
export const getCanvasWithNodes = query({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get canvas
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) {
      return null;
    }

    // Verify ownership
    if (canvas.organizationId !== organizationId) {
      throw new Error("Canvas does not belong to your organization");
    }

    // Get all nodes for this canvas
    const nodes = await ctx.db
      .query("canvas_nodes")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    // Get all edges for this canvas
    const edges = await ctx.db
      .query("canvas_edges")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    // Load node-specific data
    const nodesWithData = await Promise.all(
      nodes.map(async (node) => {
        if (node.nodeType === "text") {
          const textNode = await ctx.db.get(node.data.nodeId as Id<"text_nodes">);
          return {
            ...node,
            textContent: textNode?.content || "",
          };
        } else if (node.nodeType === "chat") {
          const chatNode = await ctx.db.get(node.data.nodeId as Id<"chat_nodes">);
          if (!chatNode) {
            return { ...node, chatNodeId: null, selectedThreadId: null, selectedAgentThreadId: null };
          }
          const selectedThread = chatNode.selectedThreadId
            ? await ctx.db.get(chatNode.selectedThreadId)
            : null;
          return {
            ...node,
            chatNodeId: chatNode._id, // Pass the actual chat_nodes ID
            selectedThreadId: chatNode.selectedThreadId || null,
            selectedAgentThreadId: selectedThread?.agentThreadId || null,
          };
        } else if (node.nodeType === "youtube") {
          const youtubeNode = await ctx.db.get(node.data.nodeId as Id<"youtube_nodes">);
          return {
            ...node,
            youtubeNodeId: youtubeNode?._id || null,
          };
        } else if (node.nodeType === "website") {
          const websiteNode = await ctx.db.get(node.data.nodeId as Id<"website_nodes">);
          return {
            ...node,
            websiteNodeId: websiteNode?._id || null,
          };
        } else if (node.nodeType === "tiktok") {
          const tiktokNode = await ctx.db.get(node.data.nodeId as Id<"tiktok_nodes">);
          return {
            ...node,
            tiktokNodeId: tiktokNode?._id || null,
          };
        } else if (node.nodeType === "twitter") {
          const twitterNode = await ctx.db.get(node.data.nodeId as Id<"twitter_nodes">);
          return {
            ...node,
            twitterNodeId: twitterNode?._id || null,
          };
        } else if (node.nodeType === "facebook_ad") {
          const facebookAdNode = await ctx.db.get(node.data.nodeId as Id<"facebook_ads_nodes">);
          return {
            ...node,
            facebookAdNodeId: facebookAdNode?._id || null,
          };
        } else if (node.nodeType === "group") {
          const groupNode = await ctx.db.get(node.data.nodeId as Id<"group_nodes">);
          return {
            ...node,
            groupNodeId: groupNode?._id || null,
          };
        } else if (node.nodeType === "image") {
          const imageNode = await ctx.db.get(node.data.nodeId as Id<"image_nodes">);
          return {
            ...node,
            imageNodeId: imageNode?._id || null,
          };
        }
        return node;
      })
    );

    return {
      canvas,
      nodes: nodesWithData,
      edges,
    };
  },
});

/**
 * Get YouTube node data (for UI component)
 */
export const getYouTubeNode = query({
  args: {
    youtubeNodeId: v.id("youtube_nodes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const youtubeNode = await ctx.db.get(args.youtubeNodeId);
    if (!youtubeNode) {
      return null;
    }

    // Verify ownership
    if (youtubeNode.organizationId !== organizationId) {
      throw new Error("YouTube node does not belong to your organization");
    }

    return youtubeNode;
  },
});

/**
 * Get Website node data (for UI component)
 */
export const getWebsiteNode = query({
  args: {
    websiteNodeId: v.id("website_nodes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const websiteNode = await ctx.db.get(args.websiteNodeId);
    if (!websiteNode) {
      return null;
    }

    // Verify ownership
    if (websiteNode.organizationId !== organizationId) {
      throw new Error("Website node does not belong to your organization");
    }

    // Get screenshot URL from storage if available
    let screenshotUrl: string | null = null;
    if (websiteNode.screenshotStorageId) {
      screenshotUrl = await ctx.storage.getUrl(websiteNode.screenshotStorageId);
    }

    return {
      ...websiteNode,
      screenshotUrl,
    };
  },
});

/**
 * Get TikTok node data (for UI component)
 */
export const getTikTokNode = query({
  args: {
    tiktokNodeId: v.id("tiktok_nodes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const tiktokNode = await ctx.db.get(args.tiktokNodeId);
    if (!tiktokNode) {
      return null;
    }

    // Verify ownership
    if (tiktokNode.organizationId !== organizationId) {
      throw new Error("TikTok node does not belong to your organization");
    }

    return tiktokNode;
  },
});

/**
 * Get Twitter node data (for UI component)
 */
export const getTwitterNode = query({
  args: {
    twitterNodeId: v.id("twitter_nodes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const twitterNode = await ctx.db.get(args.twitterNodeId);
    if (!twitterNode) {
      return null;
    }

    // Verify ownership
    if (twitterNode.organizationId !== organizationId) {
      throw new Error("Twitter node does not belong to your organization");
    }

    return twitterNode;
  },
});

/**
 * Get Facebook Ad node data (for UI component)
 */
export const getFacebookAdNode = query({
  args: {
    facebookAdNodeId: v.id("facebook_ads_nodes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const facebookAdNode = await ctx.db.get(args.facebookAdNodeId);
    if (!facebookAdNode) {
      return null;
    }

    // Verify ownership
    if (facebookAdNode.organizationId !== organizationId) {
      throw new Error("Facebook Ad node does not belong to your organization");
    }

    // Get image URLs from storage if available
    let imageUrls: (string | null)[] = [];
    if (facebookAdNode.imageStorageIds && facebookAdNode.imageStorageIds.length > 0) {
      imageUrls = await Promise.all(
        facebookAdNode.imageStorageIds.map((storageId) => ctx.storage.getUrl(storageId))
      );
    }

    // Get video thumbnail URL from storage if available
    let videoThumbnailUrl: string | null = null;
    if (facebookAdNode.videoThumbnailStorageId) {
      videoThumbnailUrl = await ctx.storage.getUrl(facebookAdNode.videoThumbnailStorageId);
    }

    return {
      ...facebookAdNode,
      imageUrls,
      videoThumbnailUrl,
    };
  },
});

/**
 * Get Image node data (for UI component)
 */
export const getImageNode = query({
  args: {
    imageNodeId: v.id("image_nodes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const imageNode = await ctx.db.get(args.imageNodeId);
    if (!imageNode) {
      return null;
    }

    // Verify ownership
    if (imageNode.organizationId !== organizationId) {
      throw new Error("Image node does not belong to your organization");
    }

    // Get image URL from storage if available
    let imageUrl: string | null = null;
    if (imageNode.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(imageNode.imageStorageId);
    }

    return {
      ...imageNode,
      imageUrl,
    };
  },
});

/**
 * Create a new canvas
 * ACTION (not mutation) because it needs to call Autumn API (uses fetch)
 */
export const createCanvas = action({
  args: {
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ canvasId: Id<"canvases">; title: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // ========== CHECK CANVAS LIMIT (Backend enforcement) ==========
    const { data: checkData, error: checkError } = await autumn.check(ctx, {
      featureId: "canvases",
    });

    if (checkError || !checkData?.allowed) {
      throw new Error(
        "Canvas limit reached. Upgrade to Pro for unlimited canvases."
      );
    }

    const now = Date.now();
    const title = args.title || `Canvas ${new Date().toLocaleDateString()}`;

    // ========== CREATE CANVAS (via runMutation for transactional safety) ==========
    const canvasId: Id<"canvases"> = await ctx.runMutation(internal.canvas.functions.createCanvasMutation, {
      organizationId,
      userId,
      title,
      description: args.description,
      now,
    });

    // ========== TRACK USAGE ==========
    // Track canvas creation (increment by 1)
    await autumn.track(ctx, {
      featureId: "canvases",
      value: 1,
    });

    return { canvasId, title };
  },
});

/**
 * Internal mutation for creating canvas (called by action)
 * Separated for transactional database operations
 */
export const createCanvasMutation = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const canvasId = await ctx.db.insert("canvases", {
      organizationId: args.organizationId,
      title: args.title,
      description: args.description,
      createdAt: args.now,
      updatedAt: args.now,
      createdBy: args.userId,
    });

    return canvasId;
  },
});

/**
 * Update canvas metadata
 */
export const updateCanvas = mutation({
  args: {
    canvasId: v.id("canvases"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get canvas and verify ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    if (canvas.organizationId !== organizationId) {
      throw new Error("Canvas does not belong to your organization");
    }

    // Update canvas
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }

    await ctx.db.patch(args.canvasId, updates);

    return { success: true };
  },
});

/**
 * Delete a canvas and all its nodes/edges
 * ACTION (not mutation) because it needs to call Autumn API (uses fetch)
 */
export const deleteCanvas = action({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // ========== DELETE CANVAS (via runMutation) ==========
    await ctx.runMutation(internal.canvas.functions.deleteCanvasMutation, {
      canvasId: args.canvasId,
      organizationId,
    });

    // ========== TRACK USAGE ==========
    // Track canvas deletion (decrement by -1)
    await autumn.track(ctx, {
      featureId: "canvases",
      value: -1,
    });

    return { success: true };
  },
});

/**
 * Internal mutation for deleting canvas (called by action)
 * Separated for transactional database operations
 */
export const deleteCanvasMutation = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get canvas and verify ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    if (canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas does not belong to your organization");
    }

    // Delete all nodes
    const nodes = await ctx.db
      .query("canvas_nodes")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    for (const node of nodes) {
      // Delete node-specific data
      await ctx.db.delete(node.data.nodeId as Id<"text_nodes"> | Id<"chat_nodes"> | Id<"youtube_nodes"> | Id<"website_nodes">);
      // Delete node reference
      await ctx.db.delete(node._id);
    }

    // Delete all edges
    const edges = await ctx.db
      .query("canvas_edges")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    for (const edge of edges) {
      await ctx.db.delete(edge._id);
    }

    // Delete canvas
    await ctx.db.delete(args.canvasId);

    return { success: true };
  },
});
