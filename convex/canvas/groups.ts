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
      width: 900, // Wider to fit 2 columns with gaps
      height: 700, // Taller to fit multiple rows
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
 * Add a node to a group (set parent relationship) and auto-arrange in grid
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

    // Get all existing children to calculate grid position
    const existingChildren = await ctx.db
      .query("canvas_nodes")
      .withIndex("by_parent_group", (q) => q.eq("parentGroupId", args.parentGroupId))
      .collect();

    // Grid layout config
    const COLS = 2; // 2 nodes per row
    const NODE_WIDTH = 420; // Slightly larger than default 400 for spacing
    const NODE_HEIGHT = 320; // Slightly larger than default 300 for spacing
    const PADDING = 20; // Padding from group edges
    const GAP = 20; // Gap between nodes

    // Calculate grid position for new node
    const childIndex = existingChildren.length; // Current child will be at this index
    const row = Math.floor(childIndex / COLS);
    const col = childIndex % COLS;

    const gridPosition = {
      x: PADDING + col * (NODE_WIDTH + GAP),
      y: PADDING + row * (NODE_HEIGHT + GAP),
    };

    // Update node to have parent and grid position
    await ctx.db.patch(args.canvasNodeId, {
      parentGroupId: args.parentGroupId,
      position: gridPosition,
      updatedAt: Date.now(),
    });

    return { success: true, gridPosition };
  },
});

/**
 * Remove a node from its parent group
 * Returns the node data so it can be re-added to React Flow
 */
export const removeNodeFromGroup = mutation({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    newPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
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

    // Get parent group to calculate absolute position
    let newPosition = args.newPosition;
    if (!newPosition && canvasNode.parentGroupId) {
      const parentGroup = await ctx.db.get(canvasNode.parentGroupId);
      if (parentGroup) {
        // Convert relative position to absolute
        newPosition = {
          x: parentGroup.position.x + canvasNode.position.x,
          y: parentGroup.position.y + canvasNode.position.y,
        };
      } else {
        newPosition = canvasNode.position; // Fallback
      }
    } else {
      newPosition = newPosition || canvasNode.position;
    }

    // Remove parent reference and update position
    await ctx.db.patch(args.canvasNodeId, {
      parentGroupId: undefined,
      position: newPosition,
      updatedAt: Date.now(),
    });

    // Return node data for React Flow
    return {
      success: true,
      node: {
        ...canvasNode,
        position: newPosition,
        parentGroupId: undefined,
      },
    };
  },
});

/**
 * Get all child nodes of a group with their full data
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

    // Load full data for each child node
    const childrenWithData = await Promise.all(
      children.map(async (child) => {
        if (child.nodeType === "text") {
          const textNode = await ctx.db.get(child.data.nodeId as Id<"text_nodes">);
          return {
            ...child,
            textContent: textNode?.content || "",
          };
        } else if (child.nodeType === "chat") {
          const chatNode = await ctx.db.get(child.data.nodeId as Id<"chat_nodes">);
          return {
            ...child,
            chatNodeId: chatNode?._id || null,
          };
        } else if (child.nodeType === "youtube") {
          const youtubeNode = await ctx.db.get(child.data.nodeId as Id<"youtube_nodes">);
          return {
            ...child,
            youtubeTitle: youtubeNode?.title || "",
            youtubeUrl: youtubeNode?.url || "",
            youtubeThumbnail: youtubeNode?.thumbnailUrl || "",
          };
        } else if (child.nodeType === "website") {
          const websiteNode = await ctx.db.get(child.data.nodeId as Id<"website_nodes">);
          return {
            ...child,
            websiteTitle: websiteNode?.title || "",
            websiteUrl: websiteNode?.url || "",
          };
        } else if (child.nodeType === "tiktok") {
          const tiktokNode = await ctx.db.get(child.data.nodeId as Id<"tiktok_nodes">);
          return {
            ...child,
            tiktokTitle: tiktokNode?.title || "",
            tiktokAuthor: tiktokNode?.author || "",
          };
        } else if (child.nodeType === "facebook_ad") {
          const facebookAdNode = await ctx.db.get(child.data.nodeId as Id<"facebook_ads_nodes">);
          return {
            ...child,
            facebookAdTitle: facebookAdNode?.title || "",
            facebookAdPageName: facebookAdNode?.pageName || "",
          };
        }
        return child;
      })
    );

    return childrenWithData;
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
