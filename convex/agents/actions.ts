// convex/agents/actions.ts
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "../_generated/server";
import { canvasAgent } from "./agent";
import { internal } from "../_generated/api";
import { createThread } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { getCurrentDocumentText } from "./tools";

/**
 * Get or create a playground thread for the organization (internal)
 * Uses the Agent component's thread system, not our custom threads table
 */
export const getOrCreatePlaygroundThread = internalAction({
  args: {
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    console.log("[getOrCreatePlaygroundThread] Looking for thread for org:", args.organizationId);

    // Look for existing playground thread in our custom tracking table
    const existing: { agentThreadId: string } | null = await ctx.runQuery(internal.agents.actions.queryPlaygroundThread, {
      organizationId: args.organizationId,
    });

    if (existing) {
      console.log("[getOrCreatePlaygroundThread] Found existing thread:", existing.agentThreadId);
      return existing.agentThreadId;
    }

    // Create new thread using the Agent component's thread system
    console.log("[getOrCreatePlaygroundThread] Creating new agent thread for org:", args.organizationId);
    const agentThreadId: string = await createThread(ctx, components.agent, {
      userId: args.userId,
      title: "Playground",
      summary: `Playground thread for organization ${args.organizationId}`,
    });

    console.log("[getOrCreatePlaygroundThread] Created agent thread with ID:", agentThreadId);

    // Store the mapping in our custom table for organization tracking
    await ctx.runMutation(internal.agents.actions.saveThreadMapping, {
      agentThreadId,
      userId: args.userId,
      organizationId: args.organizationId,
    });

    return agentThreadId;
  },
});

/**
 * Query playground thread (internal query helper)
 */
export const queryPlaygroundThread = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("threads")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("title"), "Playground"))
      .first();

    if (existing) {
      return { agentThreadId: existing.userId }; // We'll store agentThreadId in userId field temporarily
    }
    return null;
  },
});

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
 * Send a message to the AI agent and get a response
 */
export const sendMessage = action({
  args: {
    message: v.string(),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    console.log("[sendMessage] Received message:", args.message);
    console.log("[sendMessage] Args.threadId:", args.threadId, "Type:", typeof args.threadId);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    console.log("[sendMessage] User ID:", userId);
    console.log("[sendMessage] Organization ID:", organizationId);

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get or create thread ID
    console.log("[sendMessage] Creating/fetching thread for organization:", organizationId);
    const threadId: string = args.threadId || (await ctx.runAction(internal.agents.actions.getOrCreatePlaygroundThread, {
      userId,
      organizationId: organizationId as string,
    }) as any);

    console.log("[sendMessage] Thread ID obtained:", threadId, "Type:", typeof threadId);

    // Store user message
    await ctx.runMutation(internal.agents.actions.saveUserMessage, {
      threadId,
      message: args.message,
      userId,
      organizationId: organizationId as string,
    });

    try {
      // Get current document text to provide context to the AI
      const currentDocumentText = await getCurrentDocumentText(ctx, organizationId as string);
      console.log("[sendMessage] Current document text:", currentDocumentText ? `${currentDocumentText.substring(0, 100)}...` : "empty");

      // Build enhanced prompt with document context
      const enhancedPrompt = currentDocumentText
        ? `Current document content:\n\`\`\`\n${currentDocumentText}\n\`\`\`\n\nUser request: ${args.message}`
        : args.message;

      // Generate AI response
      const result: any = await canvasAgent.generateText(
        ctx,
        { threadId },
        {
          prompt: enhancedPrompt,
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
