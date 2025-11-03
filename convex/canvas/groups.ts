// convex/canvas/groups.ts
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Create a new group node on the canvas
 */
export const createGroup = mutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    title: v.optional(v.string()),
    color: v.optional(v.string()),
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

    const now = Date.now();

    // Create group node data
    const groupNodeId = await ctx.db.insert("group_nodes", {
      organizationId,
      title: args.title || "New Group",
      color: args.color || "rgba(100, 100, 255, 0.1)",
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId,
      nodeType: "group",
      position: args.position,
      width: 600, // Default group width
      height: 400, // Default group height
      data: { nodeId: groupNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, groupNodeId };
  },
});

/**
 * Update group title
 */
export const updateGroupTitle = mutation({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    title: v.string(),
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

    // Get canvas node and verify ownership
    const canvasNode = await ctx.db.get(args.canvasNodeId);
    if (!canvasNode || canvasNode.organizationId !== organizationId) {
      throw new Error("Node not found or unauthorized");
    }

    if (canvasNode.nodeType !== "group") {
      throw new Error("Node is not a group node");
    }

    // Update group node title
    const groupNodeId = canvasNode.data.nodeId as Id<"group_nodes">;
    await ctx.db.patch(groupNodeId, {
      title: args.title,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Add a node to a group (set parent relationship)
 */
export const addNodeToGroup = mutation({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    parentGroupId: v.id("canvas_nodes"),
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

    // Get both nodes and verify ownership
    const canvasNode = await ctx.db.get(args.canvasNodeId);
    const parentGroup = await ctx.db.get(args.parentGroupId);

    if (!canvasNode || canvasNode.organizationId !== organizationId) {
      throw new Error("Node not found or unauthorized");
    }

    if (!parentGroup || parentGroup.organizationId !== organizationId) {
      throw new Error("Parent group not found or unauthorized");
    }

    if (parentGroup.nodeType !== "group") {
      throw new Error("Parent node is not a group");
    }

    // Prevent grouping a group within itself
    if (args.canvasNodeId === args.parentGroupId) {
      throw new Error("Cannot add a group to itself");
    }

    // Update node to have parent
    await ctx.db.patch(args.canvasNodeId, {
      parentGroupId: args.parentGroupId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Remove a node from its parent group
 */
export const removeNodeFromGroup = mutation({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
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

    // Get node and verify ownership
    const canvasNode = await ctx.db.get(args.canvasNodeId);
    if (!canvasNode || canvasNode.organizationId !== organizationId) {
      throw new Error("Node not found or unauthorized");
    }

    // Remove parent reference
    await ctx.db.patch(args.canvasNodeId, {
      parentGroupId: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get all child nodes of a group
 */
export const getGroupChildren = query({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
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

    // Get group node and verify ownership
    const groupNode = await ctx.db.get(args.canvasNodeId);
    if (!groupNode || groupNode.organizationId !== organizationId) {
      throw new Error("Node not found or unauthorized");
    }

    if (groupNode.nodeType !== "group") {
      throw new Error("Node is not a group");
    }

    // Find all children
    const children = await ctx.db
      .query("canvas_nodes")
      .withIndex("by_parent_group", (q) => q.eq("parentGroupId", args.canvasNodeId))
      .collect();

    return children;
  },
});

/**
 * Delete a group and optionally its children
 */
export const deleteGroup = mutation({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    deleteChildren: v.boolean(), // true = delete children, false = ungroup them
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

    // Get group node and verify ownership
    const groupNode = await ctx.db.get(args.canvasNodeId);
    if (!groupNode || groupNode.organizationId !== organizationId) {
      throw new Error("Node not found or unauthorized");
    }

    if (groupNode.nodeType !== "group") {
      throw new Error("Node is not a group");
    }

    // Get all children
    const children = await ctx.db
      .query("canvas_nodes")
      .withIndex("by_parent_group", (q) => q.eq("parentGroupId", args.canvasNodeId))
      .collect();

    if (args.deleteChildren) {
      // Delete all children
      for (const child of children) {
        // Delete connected edges
        const edges = await ctx.db
          .query("canvas_edges")
          .withIndex("by_canvas", (q) => q.eq("canvasId", groupNode.canvasId))
          .collect();

        for (const edge of edges) {
          if (edge.source === child._id || edge.target === child._id) {
            await ctx.db.delete(edge._id);
          }
        }

        // Delete child node data
        await ctx.db.delete(child.data.nodeId as any);

        // Delete child canvas node
        await ctx.db.delete(child._id);
      }
    } else {
      // Ungroup children (remove parent reference)
      for (const child of children) {
        await ctx.db.patch(child._id, {
          parentGroupId: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    // Delete edges connected to the group
    const edges = await ctx.db
      .query("canvas_edges")
      .withIndex("by_canvas", (q) => q.eq("canvasId", groupNode.canvasId))
      .collect();

    for (const edge of edges) {
      if (edge.source === args.canvasNodeId || edge.target === args.canvasNodeId) {
        await ctx.db.delete(edge._id);
      }
    }

    // Delete group node data
    await ctx.db.delete(groupNode.data.nodeId as Id<"group_nodes">);

    // Delete group canvas node
    await ctx.db.delete(args.canvasNodeId);

    // Update canvas timestamp
    await ctx.db.patch(groupNode.canvasId, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
