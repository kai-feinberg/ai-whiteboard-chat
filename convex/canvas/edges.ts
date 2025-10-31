// convex/canvas/edges.ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Create an edge between two nodes
 */
export const createEdge = mutation({
  args: {
    canvasId: v.id("canvases"),
    source: v.id("canvas_nodes"),
    target: v.id("canvas_nodes"),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
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

    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    // Verify source and target nodes exist and belong to this canvas
    const sourceNode = await ctx.db.get(args.source);
    const targetNode = await ctx.db.get(args.target);

    if (!sourceNode || !targetNode) {
      throw new Error("Source or target node not found");
    }

    if (sourceNode.canvasId !== args.canvasId || targetNode.canvasId !== args.canvasId) {
      throw new Error("Nodes do not belong to this canvas");
    }

    if (sourceNode.organizationId !== organizationId || targetNode.organizationId !== organizationId) {
      throw new Error("Unauthorized");
    }

    // Check if edge already exists
    const existingEdge = await ctx.db
      .query("canvas_edges")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .filter((q) =>
        q.and(
          q.eq(q.field("source"), args.source),
          q.eq(q.field("target"), args.target)
        )
      )
      .first();

    if (existingEdge) {
      throw new Error("Edge already exists between these nodes");
    }

    // Create edge
    const edgeId = await ctx.db.insert("canvas_edges", {
      canvasId: args.canvasId,
      organizationId,
      source: args.source,
      target: args.target,
      sourceHandle: args.sourceHandle,
      targetHandle: args.targetHandle,
      createdAt: Date.now(),
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, {
      updatedAt: Date.now(),
    });

    return { edgeId };
  },
});

/**
 * Delete an edge
 */
export const deleteEdge = mutation({
  args: {
    edgeId: v.id("canvas_edges"),
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

    // Get edge and verify ownership
    const edge = await ctx.db.get(args.edgeId);
    if (!edge || edge.organizationId !== organizationId) {
      throw new Error("Edge not found or unauthorized");
    }

    // Delete edge
    await ctx.db.delete(args.edgeId);

    // Update canvas timestamp
    await ctx.db.patch(edge.canvasId, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
