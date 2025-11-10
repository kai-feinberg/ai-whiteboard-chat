// convex/chat/functions.ts
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { createThread, listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { paginationOptsValidator } from "convex/server";
import { Agent } from "@convex-dev/agent";
import { autumn } from "../autumn";
import { convertUsdToCredits, estimateCost } from "../ai/pricing";

// Create agent instance with credit tracking
function createChatAgent(userId: string, organizationId: string, agentName: string, systemPrompt: string) {
  return new Agent(components.agent, {
    name: agentName,
    instructions: systemPrompt,
    languageModel: 'xai/grok-4-fast-non-reasoning',
    maxSteps: 10,
    callSettings: {
      maxRetries: 2,
      temperature: 0.7,
    },
    usageHandler: async (ctx, args) => {
      const { threadId, model, provider, usage, providerMetadata } = args;

      // Extract cost from Vercel AI Gateway
      const gatewayCost = providerMetadata?.gateway?.cost;
      if (!gatewayCost) {
        console.warn('[Chat Usage] No gateway cost found, skipping credit tracking');
        return;
      }

      // Convert USD to credits (4000 credits = $1)
      const costInCredits = convertUsdToCredits(gatewayCost);

      console.log('[Chat Usage]', {
        userId,
        organizationId,
        threadId,
        model,
        provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        usdCost: gatewayCost,
        creditsDeducted: costInCredits,
      });

      // Track usage with Autumn (deduct credits)
      await autumn.track(ctx, {
        featureId: "ai_credits",
        value: costInCredits,
      });
    },
  });
}

/**
 * Create a new chat thread for the organization
 */
export const createChatThread = action({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ threadId: any; agentThreadId: string; title: string }> => {
    // Auth check
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

    // Generate title if not provided
    const title = args.title || `Chat ${new Date().toLocaleDateString()}`;

    // Save thread mapping in our database
    const threadId: any = await ctx.runMutation(internal.chat.functions.saveThread, {
      agentThreadId,
      userId,
      organizationId,
      title,
    });

    return { threadId, agentThreadId, title };
  },
});

/**
 * Internal mutation to save thread mapping
 */
export const saveThread = internalMutation({
  args: {
    agentThreadId: v.string(),
    userId: v.string(),
    organizationId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("threads", {
      agentThreadId: args.agentThreadId,
      userId: args.userId,
      organizationId: args.organizationId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * List all threads for the current organization
 */
export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Query threads by organization, sorted by most recently updated
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_org_updated", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    return threads;
  },
});

/**
 * Get a specific thread by ID
 */
export const getThread = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return null;
    }

    // Verify ownership
    if (thread.organizationId !== organizationId) {
      throw new Error("Thread does not belong to your organization");
    }

    return thread;
  },
});

/**
 * Update thread's updatedAt timestamp (called when new messages are added)
 */
export const touchThread = internalMutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      updatedAt: Date.now(),
    });
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
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    // Verify ownership
    if (thread.organizationId !== organizationId) {
      throw new Error("Thread does not belong to your organization");
    }

    // Update title
    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete a thread
 */
export const deleteThread = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    // Verify ownership
    if (thread.organizationId !== organizationId) {
      throw new Error("Thread does not belong to your organization");
    }

    // Delete thread
    await ctx.db.delete(args.threadId);

    return { success: true };
  },
});

/**
 * Send a message to the AI agent and get a response
 */
export const sendMessage = action({
  args: {
    threadId: v.id("threads"),
    message: v.string(),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response: string }> => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get thread and verify ownership
    const thread: any = await ctx.runQuery(internal.chat.functions.getThreadInternal, {
      threadId: args.threadId,
      organizationId,
    });

    if (!thread) {
      throw new Error("Thread not found or does not belong to your organization");
    }

    // ========== PRE-FLIGHT CREDIT CHECK ==========
    const { data, error } = await autumn.check(ctx, {
      featureId: "ai_credits",
    });

    if (error || !data?.allowed) {
      throw new Error(
        `Insufficient credits. Please upgrade or wait for your monthly reset.`
      );
    }

    // Fetch agent config
    const agentId = args.agentId || "default";
    const agentConfig: any = await ctx.runQuery(internal.agents.functions.getAgent, {
      agentId,
      organizationId,
    });

    if (!agentConfig) {
      throw new Error("Agent not found");
    }

    // Touch thread to update timestamp
    await ctx.runMutation(internal.chat.functions.touchThread, {
      threadId: args.threadId,
    });

    // Create agent with user context for credit tracking
    const agent = createChatAgent(userId, organizationId, agentConfig.name, agentConfig.systemPrompt);

    try {
      // Stream AI response with delta saving
      const result: any = await agent.streamText(
        ctx,
        { threadId: thread.agentThreadId },
        {
          prompt: args.message,
        },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          },
        }
      );

      // Await completion
      const responseText: string = await result.text;

      return {
        success: true,
        response: responseText,
      };
    } catch (error) {
      console.error("[sendMessage] Error generating response:", error);
      throw error;
    }
  },
});

/**
 * Internal query to get thread (bypasses auth for internal use)
 */
export const getThreadInternal = internalQuery({
  args: {
    threadId: v.id("threads"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return null;
    }

    // Verify ownership
    if (thread.organizationId !== args.organizationId) {
      return null;
    }

    return thread;
  },
});

/**
 * List messages for a thread with streaming support
 * Note: threadId parameter name is required by useUIMessages hook
 */
export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch messages via Agent component
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });

    // Fetch streaming deltas
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return { ...paginated, streams };
  },
});
