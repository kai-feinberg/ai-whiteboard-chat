// convex/agents/actions.ts
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "../_generated/server";
import { canvasAgent } from "./agent";
import { internal } from "../_generated/api";

/**
 * Get or create a playground thread for the organization (internal)
 */
export const getOrCreatePlaygroundThread = internalMutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Look for existing playground thread
    const existing = await ctx.db
      .query("threads")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("title"), "Playground"))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new playground thread
    const threadId = await ctx.db.insert("threads", {
      userId: args.userId,
      organizationId: args.organizationId,
      title: "Playground",
    });

    return threadId;
  },
});

/**
 * Send a message to the AI agent and get a response
 */
export const sendMessage = action({
  args: {
    message: v.string(),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    console.log("[sendMessage] Received message:", args.message);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get or create thread ID
    const threadId: string = args.threadId || (await ctx.runMutation(internal.agents.actions.getOrCreatePlaygroundThread, {
      userId,
      organizationId,
    }) as any);

    console.log("[sendMessage] Using thread:", threadId);

    // Store user message
    await ctx.runMutation(internal.agents.actions.saveUserMessage, {
      threadId,
      message: args.message,
      userId,
      organizationId: organizationId as string,
    });

    try {
      // Generate AI response
      const result: any = await canvasAgent.generateText(
        ctx,
        { threadId },
        {
          prompt: args.message,
        }
      );

      console.log("[sendMessage] AI response generated:", result.text.substring(0, 100));

      // Store AI response
      await ctx.runMutation(internal.agents.actions.saveAssistantMessage, {
        threadId: threadId as string,
        message: result.text,
        userId,
        organizationId: organizationId as string,
      });

      return {
        success: true,
        response: result.text,
        threadId,
      };
    } catch (error) {
      console.error("[sendMessage] Error generating response:", error);
      throw error;
    }
  },
});

/**
 * Save user message (internal)
 */
export const saveUserMessage = internalMutation({
  args: {
    threadId: v.string(),
    message: v.string(),
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Note: In a full implementation, this would save to a messages table
    // For now, the agent component handles message storage
    console.log("[saveUserMessage] User message saved");
  },
});

/**
 * Save assistant message (internal)
 */
export const saveAssistantMessage = internalMutation({
  args: {
    threadId: v.string(),
    message: v.string(),
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Note: In a full implementation, this would save to a messages table
    // For now, the agent component handles message storage
    console.log("[saveAssistantMessage] Assistant message saved");
  },
});
