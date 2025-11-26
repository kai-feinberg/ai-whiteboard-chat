// convex/canvas/chat.ts
import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Agent, createTool } from "@convex-dev/agent";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { autumn } from "../autumn";
import { convertUsdToCredits } from "../ai/pricing";
import { deductCreditsWithPriority } from "../ai/credits";
import { z } from "zod";

/**
 * Tool for AI to generate images on the canvas
 */
const generateImageTool = createTool({
  description: "Generate an AI image based on a text prompt and place it on the canvas. Use this when the user asks you to create, generate, or make an image.",
  args: z.object({
    prompt: z.string().describe("Detailed description of the image to generate. Be specific about style, content, colors, and composition."),
  }),
  handler: async (ctx, args) => {
    // LOG 1: Inspect the entire context
    console.log('[Image Tool] Full context keys:', Object.keys(ctx));
    console.log('[Image Tool] Context threadId:', (ctx as any).threadId);
    console.log('[Image Tool] Context threadId type:', typeof (ctx as any).threadId);
    console.log('[Image Tool] Context convexThreadId:', (ctx as any).convexThreadId);
    console.log('[Image Tool] Context convexThreadId type:', typeof (ctx as any).convexThreadId);

    // Access context passed from the agent
    const canvasId = (ctx as any).canvasId as Id<"canvases">;
    const organizationId = (ctx as any).organizationId as string;
    const canvasNodeId = (ctx as any).canvasNodeId as Id<"canvas_nodes">;
    const convexThreadId = (ctx as any).convexThreadId as Id<"threads"> | undefined;
    const agentThreadId = (ctx as any).agentThreadId as string | undefined;

    // LOG 2: Validate extracted values
    console.log('[Image Tool] Extracted values:', {
      convexThreadId,
      convexThreadIdType: typeof convexThreadId,
      agentThreadId,
      agentThreadIdType: typeof agentThreadId,
    });

    if (!canvasId || !organizationId) {
      throw new Error("Missing required context for image generation");
    }

    console.log(`[Image Tool] Generating image with prompt: ${args.prompt}`);
    console.log(`[Image Tool] Canvas: ${canvasId}, Organization: ${organizationId}`);
    console.log(`[Image Tool] Convex Thread: ${convexThreadId}, Agent Thread: ${agentThreadId}`);

    // Calculate position: offset from the chat node
    let position = { x: 100, y: 100 };

    try {
      // Try to get the chat node position to place image near it
      const chatNode = await ctx.runQuery(internal.canvas.chat.getCanvasNodeInternal, {
        canvasNodeId,
        organizationId,
      });

      if (chatNode) {
        // Place image to the right of the chat node
        position = {
          x: chatNode.position.x + chatNode.width + 100,
          y: chatNode.position.y,
        };
      }
    } catch (error) {
      console.warn("[Image Tool] Could not get chat node position, using default", error);
    }

    // Create image node via internal mutation
    const result = await ctx.runMutation(internal.canvas.images.createImageNodeInternal, {
      canvasId,
      position,
      prompt: args.prompt,
      organizationId,
      threadId: convexThreadId, // Use renamed field
      agentThreadId,
    });

    // Schedule background image generation
    await ctx.scheduler.runAfter(0, internal.canvas.images.generateImageAsync, {
      imageNodeId: result.imageNodeId,
    });

    console.log(`[Image Tool] Created image node: ${result.imageNodeId}`);

    return `I've started generating the image. It will appear on the canvas in a few moments with a loading indicator while it's being created.`;
  },
});

// Create a function that returns an agent with a usageHandler that has access to user/org context
function createCanvasChatAgent(
  userId: string,
  organizationId: string,
  canvasId: Id<"canvases">,
  canvasNodeId: Id<"canvas_nodes">,
  agentName: string,
  systemPrompt: string,
  modelId?: string
) {
  return new Agent<{ canvasId: Id<"canvases">; canvasNodeId: Id<"canvas_nodes">; organizationId: string }>(components.agent, {
    name: agentName,
    instructions: systemPrompt,
    languageModel: modelId || 'xai/grok-4-fast-non-reasoning',
    maxSteps: 10,
    callSettings: {
      maxRetries: 2,
      temperature: 0.7,
    },
    tools: {
      generateImage: generateImageTool,
    },
    usageHandler: async (ctx, args) => {
      const {
        // Who used the tokens
        threadId, agentName,
        // What LLM was used
        model, provider,
        // How many tokens were used
        usage, providerMetadata
      } = args;

      // Extract cost from Vercel AI Gateway
      const gatewayCost = providerMetadata?.gateway?.cost;
      if (!gatewayCost) {
        console.warn('[Canvas Chat Usage] No gateway cost found, skipping credit tracking');
        return;
      }

      // Convert USD to credits (4000 credits = $1)
      const costInCredits = convertUsdToCredits(gatewayCost);

      console.log('[Canvas Chat Usage]', {
        userId, // from closure
        organizationId, // from closure
        threadId,
        agentName,
        model,
        provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        usdCost: gatewayCost,
        creditsDeducted: costInCredits,
      });

      // Deduct credits with priority: monthly first, then top-up
      await deductCreditsWithPriority(ctx, costInCredits);
    },
  });
}

/**
 * Send a message in a canvas chat node with context from connected nodes
 */
export const sendMessage = action({
  args: {
    threadId: v.id("threads"),
    canvasNodeId: v.id("canvas_nodes"),
    message: v.string(),
    agentId: v.optional(v.string()),
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

    // ========== BALANCE CHECK ==========
    // Check if user has any credits remaining
    const monthlyCheck = await autumn.check(ctx, { featureId: "ai_credits" });
    const topUpCheck = await autumn.check(ctx, { featureId: "topup_credits" });

    const monthlyBalance = monthlyCheck?.data?.balance || 0;
    const topUpBalance = topUpCheck?.data?.balance || 0;
    const totalBalance = monthlyBalance + topUpBalance;

    if (totalBalance <= 0) {
      throw new Error(
        "No credits remaining. Please purchase top-up credits to continue."
      );
    }

    // Fetch agent config
    const agentId = args.agentId || "default";
    const agent: any = await ctx.runQuery(internal.agents.functions.getAgent, {
      agentId,
      organizationId,
    });

    if (!agent) {
      throw new Error("Agent not found");
    }

    // Get canvas node to extract canvasId
    const canvasNode: any = await ctx.runQuery(internal.canvas.chat.getCanvasNodeInternal, {
      canvasNodeId: args.canvasNodeId,
      organizationId,
    });

    if (!canvasNode) {
      throw new Error("Canvas node not found");
    }

    const canvasId = canvasNode.canvasId;

    // Fetch organization settings for business context
    const orgSettings: any = await ctx.runQuery(internal.organization.functions.getOrganizationSettingsInternal, {
      organizationId,
    });

    // Create agent with user context for usage tracking and tool access
    const canvasChatAgent = createCanvasChatAgent(
      userId,
      organizationId,
      canvasId,
      args.canvasNodeId,
      agent.name,
      agent.systemPrompt,
      args.modelId
    );

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

    // Build system message: Business context first, then agent prompt, then connected nodes
    let systemMessage = "";

    // 1. Add business context if present (org-wide context like brand voice, business info)
    if (orgSettings?.businessContext) {
      systemMessage += "# Organization Business Context\n\n" + orgSettings.businessContext + "\n\n---\n\n";
    }

    // 2. Add agent-specific system prompt
    systemMessage += "# Your Role and Instructions\n\n" + agent.systemPrompt;

    // 3. Add context from connected nodes
    if (contextMessages.length > 0) {
      const contextContent = contextMessages.map((msg: any) => msg.content).join("\n\n");
      systemMessage += "\n\n---\n\n# Attached Context from User\n\nThe user has connected the following content to this chat for you to reference:\n\n" + contextContent;
    }

    console.log('[Canvas Chat] System prompt:', {
      hasAgentPrompt: !!agent.systemPrompt,
      hasContext: contextMessages.length > 0,
      totalSystemMessageLength: systemMessage.length,
      systemMessagePreview: systemMessage.substring(0, 300),
    });

    // Touch thread to update timestamp
    await ctx.runMutation(internal.chat.functions.touchThread, {
      threadId: args.threadId,
    });

    try {
      // Create extended context with custom fields for tools
      const extendedCtx = {
        ...ctx,
        canvasId,
        canvasNodeId: args.canvasNodeId,
        organizationId,
        convexThreadId: args.threadId, // Renamed to avoid collision with agent's threadId
        agentThreadId: thread.agentThreadId,
      };

      // LOG: Verify extended context before passing
      console.log('[Canvas Chat] Extended context:', {
        convexThreadId: extendedCtx.convexThreadId,
        convexThreadIdType: typeof extendedCtx.convexThreadId,
        agentThreadId: extendedCtx.agentThreadId,
        argsThreadId: args.threadId,
      });

      // Stream AI response with full system message (agent prompt + context)
      const result: any = await canvasChatAgent.streamText(
        extendedCtx as any,
        {
          threadId: thread.agentThreadId,
        },
        {
          prompt: args.message,
          system: systemMessage,
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

      // Generate title if thread has default title
      if (thread.title && thread.title.startsWith("Chat Thread ")) {
        await ctx.scheduler.runAfter(0, internal.canvas.threads.generateThreadTitleAsync, {
          threadId: args.threadId,
          organizationId,
        });
      }

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
      } else if (sourceNode.nodeType === "twitter") {
        const twitterNode = await ctx.db.get(sourceNode.data.nodeId as Id<"twitter_nodes">);
        if (twitterNode?.fullText) {
          const author = twitterNode.authorUsername ? `@${twitterNode.authorUsername}` : "";
          contextMessages.push({
            role: "system",
            content: `Tweet${author ? ` by ${author}` : ""}\n\n${twitterNode.fullText}`,
          });
        }
      } else if (sourceNode.nodeType === "facebook_ad") {
        const facebookAdNode = await ctx.db.get(sourceNode.data.nodeId as Id<"facebook_ads_nodes">);
        if (facebookAdNode) {
          const title = facebookAdNode.title || "Facebook Ad";
          const pageName = facebookAdNode.pageName ? ` by ${facebookAdNode.pageName}` : "";
          let content = `Facebook Ad: ${title}${pageName}\n`;

          if (facebookAdNode.url) {
            content += `URL: ${facebookAdNode.url}\n`;
          }

          if (facebookAdNode.body) {
            content += `\nAd Copy:\n${facebookAdNode.body}\n`;
          }

          if (facebookAdNode.linkDescription) {
            content += `\nLink Description:\n${facebookAdNode.linkDescription}\n`;
          }

          if (facebookAdNode.publisherPlatform && facebookAdNode.publisherPlatform.length > 0) {
            content += `\nPlatforms: ${facebookAdNode.publisherPlatform.join(", ")}\n`;
          }

          if (facebookAdNode.transcript) {
            content += `\nVideo Transcript:\n${facebookAdNode.transcript}`;
          }

          contextMessages.push({
            role: "system",
            content,
          });
        }
      } else if (sourceNode.nodeType === "image") {
        // Images don't provide context to AI (for now)
        // Future: could include image description or vision API analysis
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

/**
 * Internal query to get canvas node (for tool context)
 */
export const getCanvasNodeInternal = internalQuery({
  args: {
    canvasNodeId: v.id("canvas_nodes"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const canvasNode = await ctx.db.get(args.canvasNodeId);
    if (!canvasNode || canvasNode.organizationId !== args.organizationId) {
      return null;
    }
    return canvasNode;
  },
});
