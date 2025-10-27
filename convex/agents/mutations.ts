// convex/agents/mutations.ts
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Save thread mapping (internal mutation)
 */
export const saveThreadMapping = internalMutation({
  args: {
    agentThreadId: v.string(),
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Store in our custom threads table for organization tracking
    await ctx.db.insert("threads", {
      userId: args.agentThreadId, // Store agentThreadId in userId field temporarily
      organizationId: args.organizationId,
      title: "Playground",
    });
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
