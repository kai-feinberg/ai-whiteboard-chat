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
import Firecrawl from "@mendable/firecrawl-js";

/**
 * Detect platform from URL
 */
type Platform = "youtube" | "twitter" | "tiktok" | "facebook_ad" | "website";

function detectPlatform(url: string): Platform {
  const urlLower = url.toLowerCase();

  // YouTube
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    return "youtube";
  }

  // Twitter/X
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) {
    return "twitter";
  }

  // TikTok
  if (urlLower.includes("tiktok.com")) {
    return "tiktok";
  }

  // Facebook Ad Library
  if (urlLower.includes("facebook.com/ads/library")) {
    return "facebook_ad";
  }

  // Default to website
  return "website";
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
  return match?.[1] ?? null;
}

/**
 * Extract Twitter/X tweet ID from URL
 */
function extractTwitterId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Extract Facebook Ad ID from URL
 */
function extractFacebookAdId(url: string): string | null {
  const match = url.match(/facebook\.com\/ads\/library.*[?&]id=(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Tool for AI to read content from URLs without creating nodes
 * Supports: YouTube, Twitter/X, TikTok, Facebook Ads, general websites
 */
const readLinkTool = createTool({
  description: "Read and extract content from a URL. Use this when the user shares a link and wants you to analyze or discuss its content. Supports YouTube videos (transcripts), Twitter/X posts, TikTok videos (transcripts), Facebook Ads, and general websites.",
  args: z.object({
    url: z.string().describe("The URL to read and extract content from"),
  }),
  handler: async (_ctx, args) => {
    console.log(`[readLink] Reading URL: ${args.url}`);

    // Validate URL
    try {
      new URL(args.url);
    } catch {
      return {
        success: false,
        error: "Invalid URL format. Please provide a valid URL.",
        platform: null,
        content: null,
      };
    }

    const platform = detectPlatform(args.url);
    console.log(`[readLink] Detected platform: ${platform}`);

    try {
      switch (platform) {
        case "youtube": {
          const videoId = extractYouTubeId(args.url);
          if (!videoId) {
            return {
              success: false,
              error: "Could not extract YouTube video ID from URL",
              platform,
              content: null,
            };
          }

          const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
          if (!apiKey) {
            return {
              success: false,
              error: "YouTube extraction service not configured",
              platform,
              content: null,
            };
          }

          const response = await fetch(
            `https://api.scrapecreators.com/v1/youtube/video/transcript?url=${encodeURIComponent(args.url)}`,
            {
              method: 'GET',
              headers: { 'x-api-key': apiKey },
            }
          );

          if (!response.ok) {
            return {
              success: false,
              error: `Failed to fetch YouTube transcript: ${response.status}`,
              platform,
              content: null,
            };
          }

          const data = await response.json();
          const transcript = data.transcript_only_text;

          if (!transcript) {
            return {
              success: false,
              error: "No transcript available for this YouTube video",
              platform,
              content: null,
            };
          }

          return {
            success: true,
            platform,
            content: {
              title: `YouTube Video ${videoId}`,
              url: args.url,
              transcript,
            },
          };
        }

        case "twitter": {
          const tweetId = extractTwitterId(args.url);
          if (!tweetId) {
            return {
              success: false,
              error: "Could not extract tweet ID from URL. Please provide a valid Twitter/X post URL.",
              platform,
              content: null,
            };
          }

          const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
          if (!apiKey) {
            return {
              success: false,
              error: "Twitter extraction service not configured",
              platform,
              content: null,
            };
          }

          const response = await fetch(
            `https://api.scrapecreators.com/v1/twitter/tweet?url=${encodeURIComponent(args.url)}`,
            {
              method: 'GET',
              headers: { 'x-api-key': apiKey },
            }
          );

          if (!response.ok) {
            return {
              success: false,
              error: `Failed to fetch tweet: ${response.status}`,
              platform,
              content: null,
            };
          }

          const data = await response.json();
          const fullText = data.legacy?.full_text || data.note_tweet?.note_tweet_results?.result?.text;

          if (!fullText) {
            return {
              success: false,
              error: "Could not extract tweet text",
              platform,
              content: null,
            };
          }

          const authorName = data.core?.user_results?.result?.legacy?.name;
          const authorUsername = data.core?.user_results?.result?.legacy?.screen_name;

          return {
            success: true,
            platform,
            content: {
              text: fullText,
              author: authorUsername ? `@${authorUsername}` : undefined,
              authorName,
              url: args.url,
            },
          };
        }

        case "tiktok": {
          const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
          if (!apiKey) {
            return {
              success: false,
              error: "TikTok extraction service not configured",
              platform,
              content: null,
            };
          }

          const apiUrl = new URL("https://api.scrapecreators.com/v2/tiktok/video");
          apiUrl.searchParams.append("url", args.url);
          apiUrl.searchParams.append("get_transcript", "true");
          apiUrl.searchParams.append("trim", "true");

          const response = await fetch(apiUrl.toString(), {
            method: 'GET',
            headers: { 'x-api-key': apiKey },
          });

          if (!response.ok) {
            return {
              success: false,
              error: `Failed to fetch TikTok video: ${response.status}`,
              platform,
              content: null,
            };
          }

          const data = await response.json();

          if (!data.success) {
            return {
              success: false,
              error: "TikTok API request was not successful",
              platform,
              content: null,
            };
          }

          const awemeDetail = data.aweme_detail;
          if (!awemeDetail) {
            return {
              success: false,
              error: "Invalid TikTok API response",
              platform,
              content: null,
            };
          }

          const title = awemeDetail.desc || "TikTok Video";
          const author = awemeDetail.author?.nickname || awemeDetail.author?.unique_id;

          // Extract transcript
          let transcript = data.transcript_only_text || data.transcript;
          if (transcript && transcript.includes('WEBVTT')) {
            const lines = transcript.split('\n');
            const textLines: string[] = [];
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('WEBVTT') && !trimmed.includes('-->') && !trimmed.match(/^\d{2}:\d{2}:\d{2}/)) {
                textLines.push(trimmed);
              }
            }
            transcript = textLines.join(' ');
          }

          return {
            success: true,
            platform,
            content: {
              title,
              author: author ? `@${author}` : undefined,
              transcript: transcript || undefined,
              url: args.url,
            },
          };
        }

        case "facebook_ad": {
          const adId = extractFacebookAdId(args.url);
          if (!adId) {
            return {
              success: false,
              error: "Could not extract Facebook Ad ID from URL. Please provide a valid Facebook Ad Library URL with an ID parameter.",
              platform,
              content: null,
            };
          }

          const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
          if (!apiKey) {
            return {
              success: false,
              error: "Facebook Ad extraction service not configured",
              platform,
              content: null,
            };
          }

          const apiUrl = new URL("https://api.scrapecreators.com/v1/facebook/adLibrary/ad");
          apiUrl.searchParams.append("id", adId);
          apiUrl.searchParams.append("get_transcript", "true");
          apiUrl.searchParams.append("trim", "true");

          const response = await fetch(apiUrl.toString(), {
            method: 'GET',
            headers: { 'x-api-key': apiKey },
          });

          if (!response.ok) {
            return {
              success: false,
              error: `Failed to fetch Facebook Ad: ${response.status}`,
              platform,
              content: null,
            };
          }

          const data = await response.json();
          const snapshot = data.snapshot;

          if (!snapshot) {
            return {
              success: false,
              error: "Invalid Facebook Ad API response",
              platform,
              content: null,
            };
          }

          let title = snapshot.title;
          if (snapshot.cards && snapshot.cards.length > 0 && snapshot.cards[0].title) {
            title = snapshot.cards[0].title;
          }
          title = title || data.pageName || "Facebook Ad";

          const body = snapshot.body || "";
          const linkDescription = snapshot.link_description || "";
          const pageName = data.pageName || snapshot.page_name;

          // Extract transcript from video if available
          let transcript: string | undefined;
          if (snapshot.videos && snapshot.videos.length > 0) {
            transcript = snapshot.videos[0].transcript;
          }

          return {
            success: true,
            platform,
            content: {
              title,
              pageName,
              body,
              linkDescription: linkDescription || undefined,
              transcript: transcript || undefined,
              url: args.url,
            },
          };
        }

        case "website":
        default: {
          const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
          if (!firecrawlApiKey) {
            return {
              success: false,
              error: "Website scraping service not configured",
              platform,
              content: null,
            };
          }

          const firecrawl = new Firecrawl({ apiKey: firecrawlApiKey });

          const result = await firecrawl.scrape(args.url, {
            formats: ['markdown'],
            onlyMainContent: true,
          });

          const resultData = result as any;
          const markdown = resultData.data?.markdown || resultData.markdown || '';
          const title = resultData.data?.metadata?.title || resultData.metadata?.title || args.url;

          if (!markdown) {
            return {
              success: false,
              error: "Could not extract content from website",
              platform,
              content: null,
            };
          }

          return {
            success: true,
            platform,
            content: {
              title,
              markdown,
              url: args.url,
            },
          };
        }
      }
    } catch (error: any) {
      console.error(`[readLink] Error reading ${platform}:`, error);
      return {
        success: false,
        error: error?.message || `Failed to read ${platform} content`,
        platform,
        content: null,
      };
    }
  },
});

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
      readLink: readLinkTool,
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
