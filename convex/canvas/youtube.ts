// convex/canvas/youtube.ts
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { Supadata } from "@supadata/js";

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
  return match?.[1] ?? null;
}

/**
 * Create a new YouTube node on the canvas
 * This is an action because it needs to schedule background transcript fetch
 */
export const createYouTubeNode = action({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
  },
  handler: async (ctx, args): Promise<{
    canvasNodeId: Id<"canvas_nodes">;
    youtubeNodeId: Id<"youtube_nodes">;
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

    // Extract video ID from URL
    const videoId = extractYouTubeId(args.url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // Create YouTube node via internal mutation
    const result = await ctx.runMutation(internal.canvas.youtube.createYouTubeNodeInternal, {
      canvasId: args.canvasId,
      position: args.position,
      url: args.url,
      videoId,
      organizationId,
    });

    // Schedule background transcript fetch
    await ctx.scheduler.runAfter(0, internal.canvas.youtube.fetchYouTubeTranscript, {
      youtubeNodeId: result.youtubeNodeId,
    });

    return result;
  },
});

/**
 * Internal mutation to create YouTube node (called from action)
 */
export const createYouTubeNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
    videoId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create YouTube node data with pending status
    const youtubeNodeId = await ctx.db.insert("youtube_nodes", {
      organizationId: args.organizationId,
      url: args.url,
      videoId: args.videoId,
      status: "pending",
      thumbnailUrl: `https://img.youtube.com/vi/${args.videoId}/maxresdefault.jpg`,
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "youtube",
      position: args.position,
      width: 450, // YouTube embed width
      height: 400, // YouTube embed + transcript preview
      data: { nodeId: youtubeNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, youtubeNodeId };
  },
});

/**
 * Background action to fetch YouTube transcript
 */
export const fetchYouTubeTranscript = internalAction({
  args: {
    youtubeNodeId: v.id("youtube_nodes"),
  },
  handler: async (ctx, args) => {
    console.log(`[YouTube] Starting transcript fetch for node: ${args.youtubeNodeId}`);

    // Get YouTube node
    const node = await ctx.runQuery(internal.canvas.youtube.getYouTubeNodeInternal, {
      youtubeNodeId: args.youtubeNodeId,
    });

    if (!node) {
      console.error(`[YouTube] Node not found: ${args.youtubeNodeId}`);
      throw new Error("YouTube node not found");
    }

    console.log(`[YouTube] Fetching transcript for video ID: ${node.videoId}, URL: ${node.url}`);

    // Update status to processing
    await ctx.runMutation(internal.canvas.youtube.updateYouTubeNodeInternal, {
      youtubeNodeId: args.youtubeNodeId,
      status: "processing",
    });

    try {
      // Initialize Supadata client
      const supadata = new Supadata({
        apiKey: process.env.SUPADATA_API_KEY!,
      });

      console.log(`[YouTube] Supadata client initialized, fetching transcript...`);

      // Fetch transcript using Supadata (with text: true to get plain text)
      const transcriptResult = await supadata.youtube.transcript({
        url: node.url,
        text: true, // Get plain text instead of timestamped chunks
      });

      console.log(`[YouTube] Received transcript result, type:`, typeof transcriptResult);

      // transcriptResult should be a string when text: true
      const transcript = typeof transcriptResult === 'string'
        ? transcriptResult
        : JSON.stringify(transcriptResult);

      // Check if transcript is available
      if (!transcript || transcript.length === 0) {
        console.error(`[YouTube] No transcript available for video: ${node.videoId}`);
        throw new Error("Transcript not available");
      }

      console.log(`[YouTube] Transcript length: ${transcript.length} characters`);

      // Get video metadata for title
      let title = `YouTube Video ${node.videoId}`;
      try {
        const videoData = await supadata.youtube.video({
          id: node.videoId,
        });
        title = videoData.title || title;
        console.log(`[YouTube] Got video title: ${title}`);
      } catch (e) {
        console.warn(`[YouTube] Could not fetch video metadata, using default title`);
      }

      // Save transcript and update to completed
      await ctx.runMutation(internal.canvas.youtube.updateYouTubeNodeInternal, {
        youtubeNodeId: args.youtubeNodeId,
        title,
        transcript,
        status: "completed",
      });

      console.log(`[YouTube] Transcript saved successfully for video: ${node.videoId}`);
    } catch (error: any) {
      console.error(`[YouTube] Error fetching transcript for ${node.videoId}:`, error);
      console.error(`[YouTube] Error message: ${error?.message}`);
      console.error(`[YouTube] Error details:`, error?.details);

      let errorMessage = error?.message || "Failed to fetch transcript";
      if (error?.error) {
        errorMessage = `${error.error}: ${errorMessage}`;
      }

      // Update to failed with error message
      await ctx.runMutation(internal.canvas.youtube.updateYouTubeNodeInternal, {
        youtubeNodeId: args.youtubeNodeId,
        status: "failed",
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal query to get YouTube node (for background action)
 */
export const getYouTubeNodeInternal = internalQuery({
  args: {
    youtubeNodeId: v.id("youtube_nodes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.youtubeNodeId);
  },
});

/**
 * Internal mutation to update YouTube node (for background action)
 */
export const updateYouTubeNodeInternal = internalMutation({
  args: {
    youtubeNodeId: v.id("youtube_nodes"),
    title: v.optional(v.string()),
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
    if (args.transcript !== undefined) updates.transcript = args.transcript;
    if (args.status !== undefined) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.youtubeNodeId, updates);
  },
});
