// convex/canvas/facebook.ts
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Create a new Facebook Ad node on the canvas
 * This is an action because it needs to schedule background ad data fetch
 */
export const createFacebookAdNode = action({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    adId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    canvasNodeId: Id<"canvas_nodes">;
    facebookAdNodeId: Id<"facebook_ads_nodes">;
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

    // Create Facebook Ad node via internal mutation
    const result = await ctx.runMutation(internal.canvas.facebook.createFacebookAdNodeInternal, {
      canvasId: args.canvasId,
      position: args.position,
      adId: args.adId,
      organizationId,
    });

    // Schedule background ad data fetch
    await ctx.scheduler.runAfter(0, internal.canvas.facebook.fetchFacebookAdData, {
      facebookAdNodeId: result.facebookAdNodeId,
    });

    return result;
  },
});

/**
 * Internal mutation to create Facebook Ad node (called from action)
 */
export const createFacebookAdNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    adId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create Facebook Ad node data with pending status
    const facebookAdNodeId = await ctx.db.insert("facebook_ads_nodes", {
      organizationId: args.organizationId,
      adId: args.adId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "facebook_ad",
      position: args.position,
      width: 450, // Facebook Ad node width
      height: 450, // Facebook Ad node height
      data: { nodeId: facebookAdNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, facebookAdNodeId };
  },
});

/**
 * Background action to fetch Facebook Ad data from Scrape Creators API
 */
export const fetchFacebookAdData = internalAction({
  args: {
    facebookAdNodeId: v.id("facebook_ads_nodes"),
  },
  handler: async (ctx, args) => {
    console.log(`[Facebook Ad] Starting fetch for node: ${args.facebookAdNodeId}`);

    // Get Facebook Ad node
    const node = await ctx.runQuery(internal.canvas.facebook.getFacebookAdNodeInternal, {
      facebookAdNodeId: args.facebookAdNodeId,
    });

    if (!node) {
      console.error(`[Facebook Ad] Node not found: ${args.facebookAdNodeId}`);
      throw new Error("Facebook Ad node not found");
    }

    console.log(`[Facebook Ad] Fetching data for Ad ID: ${node.adId}`);

    // Update status to processing
    await ctx.runMutation(internal.canvas.facebook.updateFacebookAdNodeInternal, {
      facebookAdNodeId: args.facebookAdNodeId,
      status: "processing",
    });

    try {
      // Fetch ad data using Scrape Creators API
      const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
      if (!apiKey) {
        throw new Error("SCRAPE_CREATORS_API_KEY environment variable not set");
      }

      console.log(`[Facebook Ad] Calling Scrape Creators API for Ad ID: ${node.adId}`);

      // Build API URL with parameters
      const apiUrl = new URL("https://api.scrapecreators.com/v1/facebook/adLibrary/ad");
      apiUrl.searchParams.append("id", node.adId);
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
        console.error(`[Facebook Ad] API error (${response.status}):`, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Facebook Ad] Received response from Scrape Creators API`);

      // Check for success
      if (!data.success && data.success !== undefined) {
        console.error(`[Facebook Ad] API returned success=false`);
        throw new Error("API request was not successful");
      }

      // Extract ad information
      const snapshot = data.snapshot;
      if (!snapshot) {
        console.error(`[Facebook Ad] No snapshot in response`);
        throw new Error("Invalid API response: missing snapshot");
      }

      // Extract title - prioritize cards if available, then snapshot.title
      let title = snapshot.title;
      if (snapshot.cards && snapshot.cards.length > 0 && snapshot.cards[0].title) {
        title = snapshot.cards[0].title;
      }
      title = title || data.pageName || "Facebook Ad";

      // Extract ad copy
      const body = snapshot.body || "";
      const linkDescription = snapshot.link_description || "";

      // Extract page name
      const pageName = data.pageName || snapshot.page_name || "Unknown Page";

      // Extract publisher platforms
      const publisherPlatform = data.publisherPlatform || [];

      // Extract Ad Archive ID and URL
      const adArchiveID = data.adArchiveID?.toString() || node.adId;
      const url = data.url || `https://www.facebook.com/ads/library?id=${adArchiveID}`;

      // Determine media type and process media
      let mediaType: "image" | "video" | "none" = "none";
      let imageStorageIds: string[] | undefined;
      let videoThumbnailStorageId: string | undefined;
      let videoUrl: string | undefined;
      let transcript: string | undefined;

      // Check for videos first
      if (snapshot.videos && snapshot.videos.length > 0) {
        mediaType = "video";
        const video = snapshot.videos[0];

        // Store video HD URL
        videoUrl = video.video_hd_url || video.video_sd_url;

        // Fetch and store video thumbnail
        if (video.video_preview_image_url) {
          try {
            console.log(`[Facebook Ad] Fetching video thumbnail...`);
            const thumbnailResponse = await fetch(video.video_preview_image_url);
            if (thumbnailResponse.ok) {
              const thumbnailBlob = await thumbnailResponse.blob();
              videoThumbnailStorageId = await ctx.storage.store(thumbnailBlob);
              console.log(`[Facebook Ad] Video thumbnail stored: ${videoThumbnailStorageId}`);
            }
          } catch (error) {
            console.warn(`[Facebook Ad] Failed to store video thumbnail:`, error);
          }
        }

        // Extract transcript if available
        const videoTranscript = video.transcript;
        if (videoTranscript && typeof videoTranscript === 'string') {
          transcript = videoTranscript;
          console.log(`[Facebook Ad] Transcript found: ${videoTranscript.length} characters`);
        }
      }
      // Check for images
      else if (snapshot.images && snapshot.images.length > 0) {
        mediaType = "image";
        imageStorageIds = [];

        console.log(`[Facebook Ad] Processing ${snapshot.images.length} images...`);

        // Store each image (limit to first 5 to avoid excessive storage)
        const imagesToProcess = snapshot.images.slice(0, 5);
        for (let i = 0; i < imagesToProcess.length; i++) {
          const image = imagesToProcess[i];
          const imageUrl = image.resized_image_url || image.original_image_url;

          if (imageUrl) {
            try {
              console.log(`[Facebook Ad] Fetching image ${i + 1}/${imagesToProcess.length}...`);
              const imageResponse = await fetch(imageUrl);
              if (imageResponse.ok) {
                const imageBlob = await imageResponse.blob();
                const storageId = await ctx.storage.store(imageBlob);
                imageStorageIds.push(storageId);
                console.log(`[Facebook Ad] Image ${i + 1} stored: ${storageId}`);
              }
            } catch (error) {
              console.warn(`[Facebook Ad] Failed to store image ${i + 1}:`, error);
            }
          }
        }

        console.log(`[Facebook Ad] Stored ${imageStorageIds.length} images`);
      }

      // Save data and update to completed
      await ctx.runMutation(internal.canvas.facebook.updateFacebookAdNodeInternal, {
        facebookAdNodeId: args.facebookAdNodeId,
        adArchiveID,
        url,
        title,
        body,
        linkDescription,
        transcript,
        mediaType,
        imageStorageIds,
        videoThumbnailStorageId,
        videoUrl,
        pageName,
        publisherPlatform,
        status: "completed",
      });

      console.log(`[Facebook Ad] Data saved successfully`);
    } catch (error: any) {
      console.error(`[Facebook Ad] Error fetching data:`, error);
      console.error(`[Facebook Ad] Error message: ${error?.message}`);

      let errorMessage = error?.message || "Failed to fetch Facebook Ad data";

      // Handle common API errors
      if (error?.message?.includes('API request failed')) {
        errorMessage = "API request failed. Please check your API key and Ad ID.";
      }

      // Update to failed with error message
      await ctx.runMutation(internal.canvas.facebook.updateFacebookAdNodeInternal, {
        facebookAdNodeId: args.facebookAdNodeId,
        status: "failed",
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal query to get Facebook Ad node (for background action)
 */
export const getFacebookAdNodeInternal = internalQuery({
  args: {
    facebookAdNodeId: v.id("facebook_ads_nodes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.facebookAdNodeId);
  },
});

/**
 * Internal mutation to update Facebook Ad node (for background action)
 */
export const updateFacebookAdNodeInternal = internalMutation({
  args: {
    facebookAdNodeId: v.id("facebook_ads_nodes"),
    adArchiveID: v.optional(v.string()),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    linkDescription: v.optional(v.string()),
    transcript: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"), v.literal("none"))),
    imageStorageIds: v.optional(v.array(v.string())),
    videoThumbnailStorageId: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    pageName: v.optional(v.string()),
    publisherPlatform: v.optional(v.array(v.string())),
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

    if (args.adArchiveID !== undefined) updates.adArchiveID = args.adArchiveID;
    if (args.url !== undefined) updates.url = args.url;
    if (args.title !== undefined) updates.title = args.title;
    if (args.body !== undefined) updates.body = args.body;
    if (args.linkDescription !== undefined) updates.linkDescription = args.linkDescription;
    if (args.transcript !== undefined) updates.transcript = args.transcript;
    if (args.mediaType !== undefined) updates.mediaType = args.mediaType;
    if (args.imageStorageIds !== undefined) updates.imageStorageIds = args.imageStorageIds;
    if (args.videoThumbnailStorageId !== undefined) updates.videoThumbnailStorageId = args.videoThumbnailStorageId;
    if (args.videoUrl !== undefined) updates.videoUrl = args.videoUrl;
    if (args.pageName !== undefined) updates.pageName = args.pageName;
    if (args.publisherPlatform !== undefined) updates.publisherPlatform = args.publisherPlatform;
    if (args.status !== undefined) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.facebookAdNodeId, updates);
  },
});
