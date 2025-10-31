// convex/agents/actions.ts
import { v } from "convex/values";
import { action, internalAction, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { createThread, listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { paginationOptsValidator } from "convex/server";

import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";

const agent = new Agent(components.agent, {
  name: "Basic Agent",
  languageModel: 'xai/grok-4-fast-non-reasoning',
});

/**
 * Send a message to the AI agent and get a response
 */
export const sendMessage = action({
  args: {
    message: v.string(),
    threadId: v.optional(v.string()),
    documentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("[sendMessage] Received message:", args.message);
    console.log("[sendMessage] Args.threadId:", args.threadId, "Type:", typeof args.threadId);
    console.log("[sendMessage] Args.documentId:", args.documentId);

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
    const threadId: string = args.threadId || '' ;

    console.log("[sendMessage] Thread ID obtained:", threadId, "Type:", typeof threadId);

    // Store user message
    await ctx.runMutation(internal.agents.mutations.saveUserMessage, {
      threadId,
      message: args.message,
      userId,
      organizationId: organizationId as string,
    });

    try {
 
      const systemMessage =  `

        You are a helpful AI assistant
        `;

      console.log("[sendMessage] Starting AI stream with threadId:", threadId);

      
      // Stream AI response with delta saving for async streaming
      const result = await agent.streamText(
        ctx,
        { threadId },
        {
          prompt: args.message, // Use the original user message, not enhanced
          system: systemMessage, // Pass document context as system message
        },
        {
          saveStreamDeltas: {
            chunking: "word", // Stream word by word for smooth rendering
            throttleMs: 100,  // Save deltas every 100ms to balance responsiveness and bandwidth
          },
        },

      );

      console.log("[sendMessage] Stream started, awaiting completion...");

      // streamText returns a StreamTextResult where text is a promise
      // The message is already saved by the Agent component with streaming deltas
      // We need to await the text property to get the final complete text
      const responseText = await result.text;

      console.log("[sendMessage] AI response completed. Length:", responseText.length);
      console.log("[sendMessage] Response preview:", responseText.substring(0, 100));

      // Store AI response (this is still saved for the final complete message)
      await ctx.runMutation(internal.agents.mutations.saveAssistantMessage, {
        threadId: threadId as string,
        message: responseText,
        userId,
        organizationId: organizationId as string,
      });

      return {
        success: true,
        response: responseText,
        threadId,
      };
    } catch (error) {
      console.error("[sendMessage] Error generating response:", error);
      throw error;
    }
  },
});

/**
 * List messages for a thread with streaming support
 * Returns both regular messages and streaming deltas
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
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

    // TODO: Add organization ownership check for thread
    // For now, we trust that the threadId provided belongs to the user's organization

    // Fetch the regular non-streaming messages
    const paginated = await listUIMessages(ctx, components.agent, args);

    // Fetch streaming deltas for messages that are currently being generated
    const streams = await syncStreams(ctx, components.agent, args);

    return { ...paginated, streams };
  },
});
