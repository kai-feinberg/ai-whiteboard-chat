// convex/agents/actions.ts
import { v } from "convex/values";
import { action, internalAction, query } from "../_generated/server";
import { canvasAgent } from "./agent";
import { internal } from "../_generated/api";
import { createThread, listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { getCurrentDocumentText } from "./tools";
import { paginationOptsValidator } from "convex/server";

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
    const existing: { agentThreadId: string } | null = await ctx.runQuery(internal.agents.queries.queryPlaygroundThread, {
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
    await ctx.runMutation(internal.agents.mutations.saveThreadMapping, {
      agentThreadId,
      userId: args.userId,
      organizationId: args.organizationId,
    });

    return agentThreadId;
  },
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
    const threadId: string = args.threadId || (await ctx.runAction(internal.agents.actions.getOrCreatePlaygroundThread, {
      userId,
      organizationId: organizationId as string,
    }) as any);

    console.log("[sendMessage] Thread ID obtained:", threadId, "Type:", typeof threadId);

    // Store user message
    await ctx.runMutation(internal.agents.mutations.saveUserMessage, {
      threadId,
      message: args.message,
      userId,
      organizationId: organizationId as string,
    });

    try {
      // Get current document text to provide context to the AI
      const documentId = args.documentId || `playground-doc-${organizationId}`;
      const currentDocumentText = await getCurrentDocumentText(ctx, documentId);
      console.log("[sendMessage] Document ID:", documentId);
      console.log("[sendMessage] Current document text length:", currentDocumentText?.length ?? 0);

      // Store documentId in action context so tools can access it
      (ctx as any).activeDocumentId = documentId;

      // Build system message with document context (not shown to user)
      // NOTE: Document context is provided to give the AI awareness of what's in the editor
      // This allows the AI to reference and edit the document content
      
      // TODO: PULL IN CONTEXT FROM ONBOARDING PROFILE
      const systemMessage = currentDocumentText
        ? `

        You are a helpful AI assistant that can help users write and edit documents collaboratively.

        You have access to a collaborative document that you can read and edit. When users ask you to write something,
        create content, or make changes, use the setDocumentText tool to update the document.

        Guidelines:
        - Be helpful and creative when generating content
        - Always respond to the user's message in the chat before and after calling the tools
        - When asked to write something, generate complete, well-structured content

        Here is the current document content:\n\`\`\`\n${currentDocumentText}\n\`\`\`\n\nThe user can see this document in their editor. When they ask you to modify it, use the setDocumentText tool.

        `
        : undefined;

      console.log("[sendMessage] Starting AI stream with threadId:", threadId);

      // Stream AI response with delta saving for async streaming
      const result = await canvasAgent.streamText(
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
 * Get the playground thread for the current organization
 * Returns null if no thread exists yet
 */
export const getPlaygroundThread = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const existing = await ctx.db
      .query("threads")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.eq(q.field("title"), "Playground"))
      .first();

    if (existing) {
      // We store the agentThreadId in the userId field temporarily
      return { threadId: existing.userId };
    }

    return null;
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
