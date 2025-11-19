// convex/canvas/nodes.ts
import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { createThread } from "@convex-dev/agent";
import { components } from "../_generated/api";

/**
 * Create a new text node on the canvas
 */
export const createTextNode = mutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    content: v.optional(v.string()),
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

    // Create text node data
    const textNodeId = await ctx.db.insert("text_nodes", {
      organizationId,
      content: args.content || "",
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId,
      nodeType: "text",
      position: args.position,
      width: 400, // Default text node width
      height: 300, // Default text node height
      data: { nodeId: textNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, textNodeId };
  },
});

/**
 * Create a new chat node on the canvas
 * This is an action because it needs to create a thread via the agent component
 */
export const createChatNode = action({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
  },
  handler: async (ctx, args): Promise<{
    canvasNodeId: Id<"canvas_nodes">;
    chatNodeId: Id<"chat_nodes">;
    threadId: Id<"threads">;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Create thread via Agent component
    const agentThreadId = await createThread(ctx, components.agent);

    // Create chat node via internal mutation
    const result: {
      canvasNodeId: Id<"canvas_nodes">;
      chatNodeId: Id<"chat_nodes">;
      threadId: Id<"threads">;
    } = await ctx.runMutation(internal.canvas.nodes.createChatNodeInternal, {
      canvasId: args.canvasId,
      position: args.position,
      agentThreadId,
      userId,
      organizationId,
    });

    return result;
  },
});

/**
 * Internal mutation to create chat node (called from action)
 */
export const createChatNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    agentThreadId: v.string(),
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create initial thread record for this canvas
    const threadId = await ctx.db.insert("threads", {
      agentThreadId: args.agentThreadId,
      userId: args.userId,
      organizationId: args.organizationId,
      canvasId: args.canvasId,
      title: "Chat Thread 1",
      createdAt: now,
      updatedAt: now,
    });

    // Create chat node data
    const chatNodeId = await ctx.db.insert("chat_nodes", {
      organizationId: args.organizationId,
      canvasId: args.canvasId,
      selectedThreadId: threadId,
      createdAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "chat",
      position: args.position,
      width: 1200, // Chat nodes are 2x larger (was 600)
      height: 1000, // Chat nodes are 2x larger (was 500)
      data: { nodeId: chatNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, chatNodeId, threadId };
  },
});

/**
 * Update text node content
 */
export const updateTextNode = mutation({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    content: v.string(),
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

    if (canvasNode.nodeType !== "text") {
      throw new Error("Node is not a text node");
    }

    // Update text node content
    const textNodeId = canvasNode.data.nodeId as Id<"text_nodes">;
    await ctx.db.patch(textNodeId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    // Update canvas node timestamp
    await ctx.db.patch(args.canvasNodeId, {
      updatedAt: Date.now(),
    });

    // Update canvas timestamp
    await ctx.db.patch(canvasNode.canvasId, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update node position (called when user drags node)
 */
export const updateNodePosition = mutation({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    position: v.object({ x: v.number(), y: v.number() }),
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

    // Update position
    await ctx.db.patch(args.canvasNodeId, {
      position: args.position,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete a node and its connected edges
 */
export const deleteNode = mutation({
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

    // Get canvas node and verify ownership
    const canvasNode = await ctx.db.get(args.canvasNodeId);
    if (!canvasNode || canvasNode.organizationId !== organizationId) {
      throw new Error("Node not found or unauthorized");
    }

    // Delete connected edges
    const edges = await ctx.db
      .query("canvas_edges")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasNode.canvasId))
      .collect();

    for (const edge of edges) {
      if (edge.source === args.canvasNodeId || edge.target === args.canvasNodeId) {
        await ctx.db.delete(edge._id);
      }
    }

    // Delete node-specific data
    await ctx.db.delete(canvasNode.data.nodeId as Id<"text_nodes"> | Id<"chat_nodes"> | Id<"youtube_nodes"> | Id<"website_nodes"> | Id<"tiktok_nodes"> | Id<"twitter_nodes"> | Id<"facebook_ads_nodes"> | Id<"group_nodes">);

    // Delete canvas node reference
    await ctx.db.delete(args.canvasNodeId);

    // Update canvas timestamp
    await ctx.db.patch(canvasNode.canvasId, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get node context for AI (gather text from connected nodes)
 */
export const getNodeContext = query({
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

    // Get canvas node and verify ownership
    const canvasNode = await ctx.db.get(args.canvasNodeId);
    if (!canvasNode || canvasNode.organizationId !== organizationId) {
      throw new Error("Node not found or unauthorized");
    }

    // Find all incoming edges to this node
    const incomingEdges = await ctx.db
      .query("canvas_edges")
      .withIndex("by_target", (q) => q.eq("target", args.canvasNodeId))
      .collect();

    const contextMessages: Array<{ role: "system"; content: string }> = [];

    // Gather context from connected nodes
    for (const edge of incomingEdges) {
      const sourceNode = await ctx.db.get(edge.source);
      if (!sourceNode) continue;

      // Helper function to gather context from a single node
      const gatherNodeContext = async (node: typeof sourceNode) => {
        if (node.nodeType === "text") {
          const textNode = await ctx.db.get(node.data.nodeId as Id<"text_nodes">);
          if (textNode?.content) {
            contextMessages.push({
              role: "system",
              content: `Context from connected text node:\n${textNode.content}`,
            });
          }
        } else if (node.nodeType === "youtube") {
          const youtubeNode = await ctx.db.get(node.data.nodeId as Id<"youtube_nodes">);
          if (youtubeNode?.transcript) {
            const title = youtubeNode.title || `YouTube Video ${youtubeNode.videoId}`;
            contextMessages.push({
              role: "system",
              content: `YouTube Video: ${title}\nURL: ${youtubeNode.url}\n\nTranscript:\n${youtubeNode.transcript}`,
            });
          }
        } else if (node.nodeType === "website") {
          const websiteNode = await ctx.db.get(node.data.nodeId as Id<"website_nodes">);
          if (websiteNode?.markdown) {
            const title = websiteNode.title || websiteNode.url;
            contextMessages.push({
              role: "system",
              content: `Website: ${title}\nURL: ${websiteNode.url}\n\nContent:\n${websiteNode.markdown}`,
            });
          }
        } else if (node.nodeType === "tiktok") {
          const tiktokNode = await ctx.db.get(node.data.nodeId as Id<"tiktok_nodes">);
          if (tiktokNode?.transcript) {
            const title = tiktokNode.title || "TikTok Video";
            const author = tiktokNode.author ? ` by @${tiktokNode.author}` : "";
            contextMessages.push({
              role: "system",
              content: `TikTok Video: ${title}${author}\nURL: ${tiktokNode.url}\n\nTranscript:\n${tiktokNode.transcript}`,
            });
          }
        } else if (node.nodeType === "twitter") {
          const twitterNode = await ctx.db.get(node.data.nodeId as Id<"twitter_nodes">);
          if (twitterNode?.fullText) {
            const author = twitterNode.authorUsername ? `@${twitterNode.authorUsername}` : "";
            contextMessages.push({
              role: "system",
              content: `Tweet${author ? ` by ${author}` : ""}\nURL: ${twitterNode.url}\n\nContent:\n${twitterNode.fullText}`,
            });
          }
        } else if (node.nodeType === "facebook_ad") {
          const fbAdNode = await ctx.db.get(node.data.nodeId as Id<"facebook_ads_nodes">);
          if (fbAdNode) {
            const title = fbAdNode.title || `Facebook Ad ${fbAdNode.adId}`;
            const pageName = fbAdNode.pageName ? ` by ${fbAdNode.pageName}` : "";
            let content = `Facebook Ad: ${title}${pageName}\n`;
            if (fbAdNode.url) content += `URL: ${fbAdNode.url}\n`;
            if (fbAdNode.mediaType) content += `Media Type: ${fbAdNode.mediaType}\n`;
            if (fbAdNode.publisherPlatform) content += `Platforms: ${fbAdNode.publisherPlatform.join(", ")}\n`;
            content += `\n`;
            if (fbAdNode.body) content += `Ad Body:\n${fbAdNode.body}\n\n`;
            if (fbAdNode.linkDescription) content += `Link Description:\n${fbAdNode.linkDescription}\n\n`;
            if (fbAdNode.transcript) content += `Video Transcript:\n${fbAdNode.transcript}\n`;

            contextMessages.push({
              role: "system",
              content: content.trim(),
            });
          }
        } else if (node.nodeType === "group") {
          // Recursively gather context from all children in the group
          const groupNode = await ctx.db.get(node.data.nodeId as Id<"group_nodes">);
          if (groupNode) {
            const children = await ctx.db
              .query("canvas_nodes")
              .withIndex("by_parent_group", (q) => q.eq("parentGroupId", node._id))
              .collect();

            if (children.length > 0) {
              contextMessages.push({
                role: "system",
                content: `--- Group: ${groupNode.title} (${children.length} items) ---`,
              });

              // Gather context from each child
              for (const child of children) {
                await gatherNodeContext(child);
              }

              contextMessages.push({
                role: "system",
                content: `--- End of Group: ${groupNode.title} ---`,
              });
            }
          }
        }

        // Add notes if present
        if (node.notes) {
          contextMessages.push({
            role: "system",
            content: `Notes:\n${node.notes}`,
          });
        }
      };

      await gatherNodeContext(sourceNode);
    }

    return contextMessages;
  },
});
