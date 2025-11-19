// convex/canvas/twitter.ts
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Extract Twitter/X tweet ID from URL
 */
function extractTwitterId(url: string): string | null {
  // Patterns:
  // https://twitter.com/username/status/1234567890
  // https://x.com/username/status/1234567890
  // https://www.twitter.com/username/status/1234567890
  // https://www.x.com/username/status/1234567890
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Create a new Twitter node on the canvas
 * This is an action because it needs to schedule background tweet fetch
 */
export const createTwitterNode = action({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
  },
  handler: async (ctx, args): Promise<{
    canvasNodeId: Id<"canvas_nodes">;
    twitterNodeId: Id<"twitter_nodes">;
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

    // Extract tweet ID from URL
    const tweetId = extractTwitterId(args.url);
    if (!tweetId) {
      throw new Error("Invalid Twitter/X URL. Please provide a valid tweet URL.");
    }

    // Create Twitter node via internal mutation
    const result = await ctx.runMutation(internal.canvas.twitter.createTwitterNodeInternal, {
      canvasId: args.canvasId,
      position: args.position,
      url: args.url,
      tweetId,
      organizationId,
    });

    // Schedule background tweet fetch
    await ctx.scheduler.runAfter(0, internal.canvas.twitter.fetchTweetData, {
      twitterNodeId: result.twitterNodeId,
    });

    return result;
  },
});

/**
 * Internal mutation to create Twitter node (called from action)
 */
export const createTwitterNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
    tweetId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create Twitter node data with pending status
    const twitterNodeId = await ctx.db.insert("twitter_nodes", {
      organizationId: args.organizationId,
      url: args.url,
      tweetId: args.tweetId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "twitter",
      position: args.position,
      width: 600, // Twitter embed width (wider)
      height: 350, // Twitter embed height (less tall)
      data: { nodeId: twitterNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, twitterNodeId };
  },
});

/**
 * Background action to fetch tweet data
 */
export const fetchTweetData = internalAction({
  args: {
    twitterNodeId: v.id("twitter_nodes"),
  },
  handler: async (ctx, args) => {
    console.log(`[Twitter] Starting tweet fetch for node: ${args.twitterNodeId}`);

    // Get Twitter node
    const node = await ctx.runQuery(internal.canvas.twitter.getTwitterNodeInternal, {
      twitterNodeId: args.twitterNodeId,
    });

    if (!node) {
      console.error(`[Twitter] Node not found: ${args.twitterNodeId}`);
      throw new Error("Twitter node not found");
    }

    console.log(`[Twitter] Fetching tweet ID: ${node.tweetId}, URL: ${node.url}`);

    // Update status to processing
    await ctx.runMutation(internal.canvas.twitter.updateTwitterNodeInternal, {
      twitterNodeId: args.twitterNodeId,
      status: "processing",
    });

    try {
      // Fetch tweet using Scrape Creators API
      const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
      if (!apiKey) {
        throw new Error("SCRAPE_CREATORS_API_KEY environment variable not set");
      }

      console.log(`[Twitter] Calling Scrape Creators API for URL: ${node.url}`);

      const response = await fetch(
        `https://api.scrapecreators.com/v1/twitter/tweet?url=${encodeURIComponent(node.url)}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Twitter] API error (${response.status}):`, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Twitter] Received response from Scrape Creators API`);

      // Extract tweet data from response
      const fullText = data.legacy?.full_text || data.note_tweet?.note_tweet_results?.result?.text;
      if (!fullText || fullText.length === 0) {
        console.error(`[Twitter] No tweet text available for tweet: ${node.tweetId}`);
        throw new Error("Tweet text not available");
      }

      console.log(`[Twitter] Tweet text length: ${fullText.length} characters`);

      // Extract author information
      const authorName = data.core?.user_results?.result?.legacy?.name;
      const authorUsername = data.core?.user_results?.result?.legacy?.screen_name;

      console.log(`[Twitter] Author: ${authorName} (@${authorUsername})`);

      // Save tweet data and update to completed
      await ctx.runMutation(internal.canvas.twitter.updateTwitterNodeInternal, {
        twitterNodeId: args.twitterNodeId,
        fullText,
        authorName,
        authorUsername,
        status: "completed",
      });

      console.log(`[Twitter] Tweet data saved successfully for tweet: ${node.tweetId}`);
    } catch (error: any) {
      console.error(`[Twitter] Error fetching tweet ${node.tweetId}:`, error);
      console.error(`[Twitter] Error message: ${error?.message}`);

      let errorMessage = error?.message || "Failed to fetch tweet";

      // Handle common API errors
      if (error?.message?.includes('API request failed')) {
        errorMessage = "API request failed. Please check your API key and tweet URL.";
      }

      // Update to failed with error message
      await ctx.runMutation(internal.canvas.twitter.updateTwitterNodeInternal, {
        twitterNodeId: args.twitterNodeId,
        status: "failed",
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal query to get Twitter node (for background action)
 */
export const getTwitterNodeInternal = internalQuery({
  args: {
    twitterNodeId: v.id("twitter_nodes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.twitterNodeId);
  },
});

/**
 * Internal mutation to update Twitter node (for background action)
 */
export const updateTwitterNodeInternal = internalMutation({
  args: {
    twitterNodeId: v.id("twitter_nodes"),
    fullText: v.optional(v.string()),
    authorName: v.optional(v.string()),
    authorUsername: v.optional(v.string()),
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

    if (args.fullText !== undefined) updates.fullText = args.fullText;
    if (args.authorName !== undefined) updates.authorName = args.authorName;
    if (args.authorUsername !== undefined) updates.authorUsername = args.authorUsername;
    if (args.status !== undefined) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.twitterNodeId, updates);
  },
});
