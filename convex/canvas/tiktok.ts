// convex/canvas/tiktok.ts
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Create a new TikTok node on the canvas
 * This is an action because it needs to schedule background transcript fetch
 */
export const createTikTokNode = action({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
  },
  handler: async (ctx, args): Promise<{
    canvasNodeId: Id<"canvas_nodes">;
    tiktokNodeId: Id<"tiktok_nodes">;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Create TikTok node via internal mutation
    const result = await ctx.runMutation(internal.canvas.tiktok.createTikTokNodeInternal, {
      canvasId: args.canvasId,
      position: args.position,
      url: args.url,
      organizationId,
    });

    // Schedule background transcript fetch
    await ctx.scheduler.runAfter(0, internal.canvas.tiktok.fetchTikTokTranscript, {
      tiktokNodeId: result.tiktokNodeId,
    });

    return result;
  },
});

/**
 * Internal mutation to create TikTok node (called from action)
 */
export const createTikTokNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create TikTok node data with pending status
    const tiktokNodeId = await ctx.db.insert("tiktok_nodes", {
      organizationId: args.organizationId,
      url: args.url,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "tiktok",
      position: args.position,
      width: 450, // TikTok node width
      height: 400, // TikTok node height
      data: { nodeId: tiktokNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, tiktokNodeId };
  },
});

/**
 * Background action to fetch TikTok video data and transcript
 */
export const fetchTikTokTranscript = internalAction({
  args: {
    tiktokNodeId: v.id("tiktok_nodes"),
  },
  handler: async (ctx, args) => {
    console.log(`[TikTok] Starting fetch for node: ${args.tiktokNodeId}`);

    // Get TikTok node
    const node = await ctx.runQuery(internal.canvas.tiktok.getTikTokNodeInternal, {
      tiktokNodeId: args.tiktokNodeId,
    });

    if (!node) {
      console.error(`[TikTok] Node not found: ${args.tiktokNodeId}`);
      throw new Error("TikTok node not found");
    }

    console.log(`[TikTok] Fetching data for URL: ${node.url}`);

    // Update status to processing
    await ctx.runMutation(internal.canvas.tiktok.updateTikTokNodeInternal, {
      tiktokNodeId: args.tiktokNodeId,
      status: "processing",
    });

    try {
      // Fetch video data using Scrape Creators API
      const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
      if (!apiKey) {
        throw new Error("SCRAPE_CREATORS_API_KEY environment variable not set");
      }

      console.log(`[TikTok] Calling Scrape Creators API for URL: ${node.url}`);

      // Build API URL with parameters
      const apiUrl = new URL("https://api.scrapecreators.com/v2/tiktok/video");
      apiUrl.searchParams.append("url", node.url);
      apiUrl.searchParams.append("get_transcript", "true");
      apiUrl.searchParams.append("trim", "true");

      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TikTok] API error (${response.status}):`, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[TikTok] Received response from Scrape Creators API`);

      // Check for success
      if (!data.success) {
        console.error(`[TikTok] API returned success=false`);
        throw new Error("API request was not successful");
      }

      // Extract video information
      const awemeDetail = data.aweme_detail;
      if (!awemeDetail) {
        console.error(`[TikTok] No aweme_detail in response`);
        throw new Error("Invalid API response: missing aweme_detail");
      }

      // Extract title/description
      const title = awemeDetail.desc || "TikTok Video";

      // Extract author - try multiple fields
      const author = awemeDetail.author?.nickname || awemeDetail.author?.unique_id || "Unknown";

      // Extract video ID
      const videoId = awemeDetail.aweme_id || undefined;

      // Extract transcript if available - could be 'transcript' or 'transcript_only_text'
      let transcript = data.transcript_only_text || data.transcript;

      // If transcript is in WEBVTT format, extract just the text
      if (transcript && transcript.includes('WEBVTT')) {
        // Parse WEBVTT format to extract just the spoken text
        const lines = transcript.split('\n');
        const textLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Skip WEBVTT header, timestamps, and empty lines
          if (line && !line.startsWith('WEBVTT') && !line.includes('-->') && !line.match(/^\d{2}:\d{2}:\d{2}/)) {
            textLines.push(line);
          }
        }

        transcript = textLines.join(' ');
      }

      if (!transcript || transcript.length === 0) {
        console.warn(`[TikTok] No transcript available for video`);
      } else {
        console.log(`[TikTok] Transcript length: ${transcript.length} characters`);
      }

      // Save data and update to completed
      await ctx.runMutation(internal.canvas.tiktok.updateTikTokNodeInternal, {
        tiktokNodeId: args.tiktokNodeId,
        title,
        author,
        videoId,
        transcript,
        status: "completed",
      });

      console.log(`[TikTok] Data saved successfully`);
    } catch (error: any) {
      console.error(`[TikTok] Error fetching data:`, error);
      console.error(`[TikTok] Error message: ${error?.message}`);

      let errorMessage = error?.message || "Failed to fetch TikTok data";

      // Handle common API errors
      if (error?.message?.includes('API request failed')) {
        errorMessage = "API request failed. Please check your API key and video URL.";
      }

      // Update to failed with error message
      await ctx.runMutation(internal.canvas.tiktok.updateTikTokNodeInternal, {
        tiktokNodeId: args.tiktokNodeId,
        status: "failed",
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal query to get TikTok node (for background action)
 */
export const getTikTokNodeInternal = internalQuery({
  args: {
    tiktokNodeId: v.id("tiktok_nodes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tiktokNodeId);
  },
});

/**
 * Internal mutation to update TikTok node (for background action)
 */
export const updateTikTokNodeInternal = internalMutation({
  args: {
    tiktokNodeId: v.id("tiktok_nodes"),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    videoId: v.optional(v.string()),
    transcript: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.author !== undefined) updates.author = args.author;
    if (args.videoId !== undefined) updates.videoId = args.videoId;
    if (args.transcript !== undefined) updates.transcript = args.transcript;
    if (args.status !== undefined) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.tiktokNodeId, updates);
  },
});
