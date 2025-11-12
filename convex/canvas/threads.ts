// convex/canvas/threads.ts
import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery, internalAction } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { createThread } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { Agent } from "@convex-dev/agent";
import { listMessages } from "@convex-dev/agent";
import { z } from "zod";

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
    modelId: v.optional(v.string()),
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

    // Create thread record
    const threadId: Id<"threads"> = await ctx.runMutation(internal.canvas.threads.saveCanvasThread, {
      agentThreadId,
      userId,
      organizationId,
      canvasId: args.canvasId,
      title,
      modelId: args.modelId,
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
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("threads", {
      agentThreadId: args.agentThreadId,
      userId: args.userId,
      organizationId: args.organizationId,
      canvasId: args.canvasId,
      title: args.title,
      modelId: args.modelId,
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

/**
 * Update thread title
 */
export const updateThreadTitle = mutation({
  args: {
    threadId: v.id("threads"),
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

    // Get thread and verify ownership
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.organizationId !== organizationId) {
      throw new Error("Thread not found or unauthorized");
    }

    // Update title and timestamp
    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update thread title (bypasses auth)
 */
export const updateThreadTitleInternal = internalMutation({
  args: {
    threadId: v.id("threads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Generate thread title from message history using AI
 */
export const generateThreadTitleAsync = internalAction({
  args: {
    threadId: v.id("threads"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get thread
      const thread: any = await ctx.runQuery(internal.chat.functions.getThreadInternal, {
        threadId: args.threadId,
        organizationId: args.organizationId,
      });

      if (!thread) {
        console.log('[generateThreadTitle] Thread not found');
        return;
      }

      // Check if thread already has custom title (not default)
      if (thread.title && !thread.title.startsWith("Chat Thread ")) {
        console.log('[generateThreadTitle] Thread already has custom title, skipping');
        return;
      }

      // Fetch first 3 messages from thread
      const messages = await listMessages(ctx, components.agent, {
        threadId: thread.agentThreadId,
        excludeToolMessages: true,
        paginationOpts: { cursor: null, numItems: 3 },
      });

      if (!messages.page || messages.page.length === 0) {
        console.log('[generateThreadTitle] No messages found');
        return;
      }

      // Build context from messages
      const messageContext = messages.page
        .map((msg: any) => {
          const role = msg.role === "user" ? "User" : "Assistant";
          let content = "";
          if (typeof msg.content === "string") {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            content = msg.content.map((c: any) => c.text || c.content || "").join(" ");
          } else {
            content = String(msg.content || "");
          }
          return `${role}: ${content}`;
        })
        .join("\n\n");

      // Create lightweight agent for title generation
      const titleAgent = new Agent(components.agent, {
        name: "title-generator",
        instructions: "Generate a concise, descriptive title for this conversation.",
        languageModel: "openai/gpt-4o-mini",
      });

      // Generate title using structured output without saving to thread
      const result: any = await titleAgent.generateObject(
        ctx,
        { threadId: thread.agentThreadId },
        {
          prompt: `Based on the following conversation, generate a concise title (maximum 5 words):\n\n${messageContext}`,
          schema: z.object({
            title: z.string().max(50).describe("A concise title for the conversation"),
          }),
        },
        {
          storageOptions: {
            saveMessages: "none", // Don't save title generation to thread history
          },
        }
      );

      const generatedTitle = result.object.title;

      console.log('[generateThreadTitle] Generated title:', generatedTitle);

      // Update thread title
      await ctx.runMutation(internal.canvas.threads.updateThreadTitleInternal, {
        threadId: args.threadId,
        title: generatedTitle,
      });

    } catch (error) {
      console.error('[generateThreadTitle] Error:', error);
      // Fail silently - keep default title if generation fails
    }
  },
});
