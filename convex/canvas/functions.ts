// convex/canvas/functions.ts
import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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
 * Create a new canvas
 */
export const createCanvas = mutation({
  args: {
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const now = Date.now();
    const title = args.title || `Canvas ${new Date().toLocaleDateString()}`;

    const canvasId = await ctx.db.insert("canvases", {
      organizationId,
      title,
      description: args.description,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    });

    return { canvasId, title };
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
 */
export const deleteCanvas = mutation({
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

    // Get canvas and verify ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    if (canvas.organizationId !== organizationId) {
      throw new Error("Canvas does not belong to your organization");
    }

    // Delete all nodes
    const nodes = await ctx.db
      .query("canvas_nodes")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    for (const node of nodes) {
      // Delete node-specific data
      await ctx.db.delete(node.data.nodeId as Id<"text_nodes"> | Id<"chat_nodes">);
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
