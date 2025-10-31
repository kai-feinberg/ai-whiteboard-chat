// convex/canvas/threads.ts
import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { createThread } from "@convex-dev/agent";
import { components } from "../_generated/api";

/**
 * List all threads for a canvas
 */
export const listCanvasThreads = query({
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
    if (!canvas || canvas.organizationId !== organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    // Get all threads for this canvas
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .order("desc")
      .collect();

    return threads;
  },
});

/**
 * Create a new thread for a canvas
 */
export const createCanvasThread = action({
  args: {
    canvasId: v.id("canvases"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    threadId: Id<"threads">;
    agentThreadId: string;
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

    // Get count of existing threads for naming
    const existingThreads = await ctx.runQuery(internal.canvas.threads.countCanvasThreads, {
      canvasId: args.canvasId,
      organizationId,
    });

    const title = args.title || `Chat Thread ${existingThreads + 1}`;

    console.log("[createCanvasThread] Creating thread:", {
      canvasId: args.canvasId,
      title,
      existingThreads,
    });

    // Create thread record
    const threadId: Id<"threads"> = await ctx.runMutation(internal.canvas.threads.saveCanvasThread, {
      agentThreadId,
      userId,
      organizationId,
      canvasId: args.canvasId,
      title,
    });

    console.log("[createCanvasThread] Thread created:", {
      threadId,
      canvasId: args.canvasId,
    });

    return { threadId, agentThreadId };
  },
});

/**
 * Internal mutation to save thread
 */
export const saveCanvasThread = internalMutation({
  args: {
    agentThreadId: v.string(),
    userId: v.string(),
    organizationId: v.string(),
    canvasId: v.id("canvases"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("threads", {
      agentThreadId: args.agentThreadId,
      userId: args.userId,
      organizationId: args.organizationId,
      canvasId: args.canvasId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal query to count threads for a canvas
 */
export const countCanvasThreads = internalQuery({
  args: {
    canvasId: v.id("canvases"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    return threads.length;
  },
});

/**
 * Select a thread for a chat node
 */
export const selectThread = mutation({
  args: {
    chatNodeId: v.id("chat_nodes"),
    threadId: v.id("threads"),
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

    // Get chat node and verify ownership
    const chatNode = await ctx.db.get(args.chatNodeId);
    if (!chatNode || chatNode.organizationId !== organizationId) {
      throw new Error("Chat node not found or unauthorized");
    }

    // Verify thread belongs to same canvas
    const thread = await ctx.db.get(args.threadId);

    // Debug logging
    console.log("[selectThread] Validation:", {
      threadId: args.threadId,
      chatNodeId: args.chatNodeId,
      threadCanvasId: thread?.canvasId,
      chatNodeCanvasId: chatNode.canvasId,
      threadCanvasIdType: typeof thread?.canvasId,
      chatNodeCanvasIdType: typeof chatNode.canvasId,
      match: thread?.canvasId === chatNode.canvasId
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    // Both must have canvasId and they must match
    if (!thread.canvasId || !chatNode.canvasId) {
      throw new Error(`Missing canvasId - thread: ${thread.canvasId}, chatNode: ${chatNode.canvasId}`);
    }

    if (thread.canvasId !== chatNode.canvasId) {
      throw new Error(`Thread canvas (${thread.canvasId}) does not match chat node canvas (${chatNode.canvasId})`);
    }

    // Update selected thread
    await ctx.db.patch(args.chatNodeId, {
      selectedThreadId: args.threadId,
    });

    return { success: true };
  },
});
