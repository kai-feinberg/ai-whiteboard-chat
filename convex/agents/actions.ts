// convex/agents/actions.ts
import { v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { canvasAgent } from "./agent";
import { internal } from "../_generated/api";

/**
 * Send a message to the AI agent and get a response
 */
export const sendMessage = action({
  args: {
    message: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("[sendMessage] Received message:", args.message);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.orgId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization context");
    }

    // Use hardcoded thread ID for playground
    const threadId = args.threadId || `playground-thread-${organizationId}`;

    console.log("[sendMessage] Using thread:", threadId);

    // Store user message
    await ctx.runMutation(internal.agents.actions.saveUserMessage, {
      threadId,
      message: args.message,
      userId,
      organizationId,
    });

    try {
      // Generate AI response
      const result = await canvasAgent.generateText(
        ctx,
        { threadId },
        {
          prompt: args.message,
        }
      );

      console.log("[sendMessage] AI response generated:", result.text.substring(0, 100));

      // Store AI response
      await ctx.runMutation(internal.agents.actions.saveAssistantMessage, {
        threadId,
        message: result.text,
        userId,
        organizationId,
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
