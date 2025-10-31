// convex/canvas/chat.ts
import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Create agent instance for canvas chat
const canvasChatAgent = new Agent(components.agent, {
  name: "Canvas Chat Assistant",
  instructions: `You are a helpful AI assistant in an infinite canvas workspace. Users may provide context from connected nodes - use this context to inform your responses.`,
  languageModel: 'xai/grok-4-fast-non-reasoning',
  maxSteps: 10,
  callSettings: {
    maxRetries: 2,
    temperature: 0.7,
  },
});

/**
 * Send a message in a canvas chat node with context from connected nodes
 */
export const sendMessage = action({
  args: {
    threadId: v.id("threads"),
    canvasNodeId: v.id("canvas_nodes"),
    message: v.string(),
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
    const thread: any = await ctx.runQuery(internal.chat.functions.getThreadInternal, {
      threadId: args.threadId,
      organizationId,
    });

    if (!thread) {
      throw new Error("Thread not found or does not belong to your organization");
    }

    // Gather context from connected nodes
    const contextMessages: any[] = await ctx.runQuery(internal.canvas.chat.getNodeContextInternal, {
      canvasNodeId: args.canvasNodeId,
      organizationId,
    });

    console.log('[Canvas Chat] Context messages gathered:', {
      count: contextMessages.length,
      messageTypes: contextMessages.map((m: any) => {
        const firstLine = m.content.split('\n')[0];
        return firstLine.substring(0, 50);
      }),
    });

    // Build system message with context
    let systemMessage = "";
    if (contextMessages.length > 0) {
      systemMessage = contextMessages.map((msg: any) => msg.content).join("\n\n");
    }

    console.log('[Canvas Chat] System prompt:', {
      hasSystemMessage: !!systemMessage,
      systemMessageLength: systemMessage.length,
      systemMessagePreview: systemMessage.substring(0, 200),
    });

    // Touch thread to update timestamp
    await ctx.runMutation(internal.chat.functions.touchThread, {
      threadId: args.threadId,
    });

    try {
      // Stream AI response with context injected as system message
      const result: any = await canvasChatAgent.streamText(
        ctx,
        { threadId: thread.agentThreadId },
        {
          prompt: args.message,
          ...(systemMessage && { system: systemMessage }),
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
      console.error("[canvas.chat.sendMessage] Error generating response:", error);
      throw error;
    }
  },
});

/**
 * Internal query to get node context (bypasses auth for internal use)
 */
export const getNodeContextInternal = internalQuery({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get canvas node and verify ownership
    const canvasNode = await ctx.db.get(args.canvasNodeId);
    if (!canvasNode || canvasNode.organizationId !== args.organizationId) {
      return [];
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

      if (sourceNode.nodeType === "text") {
        const textNode = await ctx.db.get(sourceNode.data.nodeId as Id<"text_nodes">);
        if (textNode?.content) {
          contextMessages.push({
            role: "system",
            content: `Context from connected text node:\n${textNode.content}`,
          });
        }
      } else if (sourceNode.nodeType === "youtube") {
        const youtubeNode = await ctx.db.get(sourceNode.data.nodeId as Id<"youtube_nodes">);
        if (youtubeNode?.transcript) {
          const title = youtubeNode.title || `YouTube Video ${youtubeNode.videoId}`;
          contextMessages.push({
            role: "system",
            content: `YouTube Video: ${title}\nURL: ${youtubeNode.url}\n\nTranscript:\n${youtubeNode.transcript}`,
          });
        }
      } else if (sourceNode.nodeType === "website") {
        const websiteNode = await ctx.db.get(sourceNode.data.nodeId as Id<"website_nodes">);
        if (websiteNode?.markdown) {
          const title = websiteNode.title || websiteNode.url;
          contextMessages.push({
            role: "system",
            content: `Website: ${title}\nURL: ${websiteNode.url}\n\nContent:\n${websiteNode.markdown}`,
          });
        }
      } else if (sourceNode.nodeType === "tiktok") {
        const tiktokNode = await ctx.db.get(sourceNode.data.nodeId as Id<"tiktok_nodes">);
        if (tiktokNode?.transcript) {
          const title = tiktokNode.title || "TikTok Video";
          const author = tiktokNode.author ? ` by @${tiktokNode.author}` : "";
          contextMessages.push({
            role: "system",
            content: `TikTok Video: ${title}${author}\nURL: ${tiktokNode.url}\n\nTranscript:\n${tiktokNode.transcript}`,
          });
        }
      }

      // Add notes if present
      if (sourceNode.notes) {
        contextMessages.push({
          role: "system",
          content: `Notes:\n${sourceNode.notes}`,
        });
      }
    }

    return contextMessages;
  },
});
