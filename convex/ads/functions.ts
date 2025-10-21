import { v } from "convex/values";
import { query, mutation, action, internalQuery, internalMutation, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

// Get all ads for the current user
export const getByUser = query({
  args: {
    platform: v.optional(v.string()),
    subscriptionId: v.optional(v.id("subscriptions")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    let adsQuery = ctx.db
      .query("ads")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    const ads = await adsQuery.collect();

    // Filter by subscription if provided
    let filteredAds = args.subscriptionId
      ? ads.filter((ad) => ad.subscriptionId === args.subscriptionId)
      : ads;

    // Filter by platform if provided
    filteredAds = args.platform
      ? filteredAds.filter((ad) => ad.platform === args.platform)
      : filteredAds;

    // Sort by scraped date, most recent first
    filteredAds.sort((a, b) => b.scrapedAt - a.scrapedAt);

    // Batch fetch unique advertisers
    const uniquePageIds = [...new Set(filteredAds.map((ad) => ad.pageId).filter(Boolean))];
    const advertisersMap = new Map();

    await Promise.all(
      uniquePageIds.map(async (pageId) => {
        if (!pageId) return;
        // Use the platform from the first ad with this pageId
        const adPlatform = filteredAds.find((ad) => ad.pageId === pageId)?.platform || "facebook";
        const advertiser = await ctx.db
          .query("advertisers")
          .withIndex("by_page_id_and_platform", (q) =>
            q.eq("pageId", pageId).eq("platform", adPlatform)
          )
          .first();
        if (advertiser) {
          advertisersMap.set(pageId, advertiser);
        }
      })
    );

    // Return ads with advertiser data and generate Convex URLs
    return await Promise.all(
      filteredAds.map(async (ad) => {
        // Generate URLs from storage IDs (prefer Convex storage over Meta URLs)
        const thumbnailUrl = ad.thumbnailStorageId
          ? await ctx.storage.getUrl(ad.thumbnailStorageId)
          : ad.thumbnailUrl;

        const mediaUrls = ad.mediaStorageIds
          ? await Promise.all(
              ad.mediaStorageIds.map((id) => ctx.storage.getUrl(id))
            )
          : ad.mediaUrls;

        // Get advertiser and generate profile picture URL
        const advertiser = advertisersMap.get(ad.pageId) || null;
        let advertiserWithUrl = advertiser;
        if (advertiser && advertiser.pageProfilePictureStorageId) {
          const profilePictureUrl = await ctx.storage.getUrl(
            advertiser.pageProfilePictureStorageId
          );
          advertiserWithUrl = {
            ...advertiser,
            pageProfilePictureUrl: profilePictureUrl ?? undefined,
          };
        }

        return {
          ...ad,
          thumbnailUrl,
          mediaUrls,
          advertiser: advertiserWithUrl,
        };
      })
    );
  },
});

// Get a single ad by ID
export const getById = query({
  args: { id: v.id("ads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const ad = await ctx.db.get(args.id);

    if (!ad) {
      throw new Error("Ad not found");
    }

    // Verify ownership
    if (ad.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Generate URLs from storage IDs (prefer Convex storage over Meta URLs)
    const thumbnailUrl = ad.thumbnailStorageId
      ? await ctx.storage.getUrl(ad.thumbnailStorageId)
      : ad.thumbnailUrl;

    const mediaUrls = ad.mediaStorageIds
      ? await Promise.all(ad.mediaStorageIds.map((id) => ctx.storage.getUrl(id)))
      : ad.mediaUrls;

    // Fetch advertiser if pageId exists
    let advertiser = null;
    if (ad.pageId) {
      const pageId = ad.pageId; // Extract for TypeScript type narrowing
      advertiser = await ctx.db
        .query("advertisers")
        .withIndex("by_page_id_and_platform", (q) =>
          q.eq("pageId", pageId).eq("platform", ad.platform)
        )
        .first();
    }

    // Generate advertiser profile picture URL
    let advertiserWithUrl = advertiser;
    if (advertiser && advertiser.pageProfilePictureStorageId) {
      const profilePictureUrl = await ctx.storage.getUrl(
        advertiser.pageProfilePictureStorageId
      );
      advertiserWithUrl = {
        ...advertiser,
        pageProfilePictureUrl: profilePictureUrl ?? undefined,
      };
    }

    return {
      ...ad,
      thumbnailUrl,
      mediaUrls,
      advertiser: advertiserWithUrl || null,
    };
  },
});

// Get ads by subscription ID
export const getBySubscription = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const ads = await ctx.db
      .query("ads")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId)
      )
      .collect();

    // Verify ownership of subscription
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Sort by scraped date, most recent first
    ads.sort((a, b) => b.scrapedAt - a.scrapedAt);

    // Batch fetch unique advertisers
    const uniquePageIds = [...new Set(ads.map((ad) => ad.pageId).filter(Boolean))];
    const advertisersMap = new Map();

    await Promise.all(
      uniquePageIds.map(async (pageId) => {
        if (!pageId) return;
        // Use the platform from the first ad with this pageId
        const adPlatform = ads.find((ad) => ad.pageId === pageId)?.platform || "facebook";
        const advertiser = await ctx.db
          .query("advertisers")
          .withIndex("by_page_id_and_platform", (q) =>
            q.eq("pageId", pageId).eq("platform", adPlatform)
          )
          .first();
        if (advertiser) {
          advertisersMap.set(pageId, advertiser);
        }
      })
    );

    // Return ads with advertiser data and generate Convex URLs
    return await Promise.all(
      ads.map(async (ad) => {
        // Generate URLs from storage IDs (prefer Convex storage over Meta URLs)
        const thumbnailUrl = ad.thumbnailStorageId
          ? await ctx.storage.getUrl(ad.thumbnailStorageId)
          : ad.thumbnailUrl;

        const mediaUrls = ad.mediaStorageIds
          ? await Promise.all(
              ad.mediaStorageIds.map((id) => ctx.storage.getUrl(id))
            )
          : ad.mediaUrls;

        // Get advertiser and generate profile picture URL
        const advertiser = advertisersMap.get(ad.pageId) || null;
        let advertiserWithUrl = advertiser;
        if (advertiser && advertiser.pageProfilePictureStorageId) {
          const profilePictureUrl = await ctx.storage.getUrl(
            advertiser.pageProfilePictureStorageId
          );
          advertiserWithUrl = {
            ...advertiser,
            pageProfilePictureUrl: profilePictureUrl ?? undefined,
          };
        }

        return {
          ...ad,
          thumbnailUrl,
          mediaUrls,
          advertiser: advertiserWithUrl,
        };
      })
    );
  },
});

// Create example ads for testing
export const createExamples = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // Verify subscription ownership
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const examples = [
      {
        userId,
        subscriptionId: args.subscriptionId,
        platform: subscription.platform,
        adId: `ad_${now}_1`,
        title: "Transform Your Business with AI",
        description:
          "Discover how AI automation can save you 10 hours per week. Join 50,000+ businesses already using our platform.",
        link: "https://example.com/ai-platform",
        mediaUrls: ["https://placehold.co/600x400/blue/white?text=AI+Platform"],
        thumbnailUrl: "https://placehold.co/300x200/blue/white?text=AI",
        scrapedAt: now,
        rawData: undefined,
        // New required fields
        pageId: "example_page_1",
        startDate: now - 86400000 * 7, // Started 7 days ago
        endDate: undefined,
        isActive: true,
        totalActiveTime: 604800, // 7 days in seconds
        displayFormat: "SINGLE_IMAGE",
        ctaText: "Learn More",
        ctaType: "LEARN_MORE",
        collationCount: 1,
        caption: undefined,
        publisherPlatforms: ["FACEBOOK", "INSTAGRAM"],
        reachEstimate: undefined,
        spend: undefined,
        cards: undefined,
        hasVideo: false,
        videoCount: 0,
        imageCount: 1,
      },
      {
        userId,
        subscriptionId: args.subscriptionId,
        platform: subscription.platform,
        adId: `ad_${now}_2`,
        title: "Limited Time Offer - 50% Off",
        description:
          "Get started today and save big on our annual plan. No credit card required for your 14-day trial.",
        link: "https://example.com/pricing",
        mediaUrls: [
          "https://placehold.co/600x400/green/white?text=Special+Offer",
        ],
        thumbnailUrl: "https://placehold.co/300x200/green/white?text=Offer",
        scrapedAt: now - 86400000, // 1 day ago
        rawData: undefined,
        // New required fields
        pageId: "example_page_2",
        startDate: now - 86400000 * 3, // Started 3 days ago
        endDate: undefined,
        isActive: true,
        totalActiveTime: 259200, // 3 days in seconds
        displayFormat: "SINGLE_IMAGE",
        ctaText: "Shop Now",
        ctaType: "SHOP_NOW",
        collationCount: 1,
        caption: undefined,
        publisherPlatforms: ["FACEBOOK"],
        reachEstimate: undefined,
        spend: undefined,
        cards: undefined,
        hasVideo: false,
        videoCount: 0,
        imageCount: 1,
      },
      {
        userId,
        subscriptionId: args.subscriptionId,
        platform: subscription.platform,
        adId: `ad_${now}_3`,
        title: "See What Our Customers Are Saying",
        description:
          "4.9/5 stars from 10,000+ reviews. Join the fastest-growing community of professionals.",
        link: "https://example.com/testimonials",
        mediaUrls: [
          "https://placehold.co/600x400/purple/white?text=Testimonials",
        ],
        thumbnailUrl:
          "https://placehold.co/300x200/purple/white?text=Reviews",
        scrapedAt: now - 172800000, // 2 days ago
        rawData: undefined,
        // New required fields
        pageId: "example_page_3",
        startDate: now - 86400000 * 14, // Started 14 days ago
        endDate: now - 86400000, // Ended 1 day ago
        isActive: false,
        totalActiveTime: 1123200, // 13 days in seconds
        displayFormat: "VIDEO",
        ctaText: "Watch Now",
        ctaType: "WATCH_MORE",
        collationCount: 1,
        caption: undefined,
        publisherPlatforms: ["FACEBOOK", "INSTAGRAM", "AUDIENCE_NETWORK"],
        reachEstimate: undefined,
        spend: undefined,
        cards: undefined,
        hasVideo: true,
        videoCount: 1,
        imageCount: 0,
      },
    ];

    const ids = await Promise.all(
      examples.map((example) => ctx.db.insert("ads", example))
    );

    return ids;
  },
});

// Delete an ad
export const remove = mutation({
  args: { id: v.id("ads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const ad = await ctx.db.get(args.id);
    if (!ad) {
      throw new Error("Ad not found");
    }

    // Verify ownership
    if (ad.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Delete the ad document first
    await ctx.db.delete(args.id);

    // Delete associated media files from storage (best effort, don't fail if deletion fails)
    try {
      if (ad.thumbnailStorageId) {
        await ctx.storage.delete(ad.thumbnailStorageId);
      }

      if (ad.mediaStorageIds) {
        await Promise.all(
          ad.mediaStorageIds.map((id) => ctx.storage.delete(id))
        );
      }
    } catch (error) {
      console.error("Error deleting media files:", error);
      // Don't throw - ad is already deleted from DB
    }

    return args.id;
  },
});

// Helper mutation to insert ads from action
export const insertAd = internalMutation({
  args: {
    userId: v.string(),
    subscriptionId: v.id("subscriptions"),
    platform: v.string(),
    adId: v.string(),
    title: v.string(),
    description: v.string(),
    link: v.optional(v.string()),
    mediaUrls: v.array(v.string()),
    thumbnailUrl: v.optional(v.string()),
    // Media storage fields
    thumbnailStorageId: v.optional(v.id("_storage")),
    mediaStorageIds: v.optional(v.array(v.id("_storage"))),
    mediaMetadata: v.optional(
      v.array(
        v.object({
          type: v.string(),
          storageId: v.id("_storage"),
          originalUrl: v.string(),
        })
      )
    ),
    scrapedAt: v.number(),
    rawData: v.optional(v.any()),
    // New fields (optional for backward compatibility)
    pageId: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    totalActiveTime: v.optional(v.number()),
    displayFormat: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaType: v.optional(v.string()),
    collationCount: v.optional(v.number()),
    caption: v.optional(v.string()),
    publisherPlatforms: v.optional(v.array(v.string())),
    reachEstimate: v.optional(
      v.object({
        lower: v.number(),
        upper: v.number(),
      })
    ),
    spend: v.optional(
      v.object({
        lower: v.number(),
        upper: v.number(),
        currency: v.string(),
      })
    ),
    cards: v.optional(
      v.array(
        v.object({
          title: v.optional(v.string()),
          body: v.optional(v.string()),
          caption: v.optional(v.string()),
          linkUrl: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          videoUrl: v.optional(v.string()),
        })
      )
    ),
    hasVideo: v.optional(v.boolean()),
    videoCount: v.optional(v.number()),
    imageCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ads", args);
  },
});

// Internal action to download and store media from external URL
export const storeMediaFromUrl = internalAction({
  args: {
    url: v.string(),
    type: v.union(v.literal("image"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    try {
      // Fetch the media from external URL
      const response = await fetch(args.url);
      if (!response.ok) {
        console.error(`Failed to fetch media from ${args.url}: ${response.statusText}`);
        return null;
      }

      // Convert to blob
      const blob = await response.blob();

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);

      return { storageId, originalUrl: args.url, type: args.type };
    } catch (error) {
      console.error(`Error storing media from ${args.url}:`, error);
      return null;
    }
  },
});

// Scrape ads from Facebook Ad Library API
export const scrapeFromFacebookAdLibrary = action({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; count: number; message?: string; error?: string }> => {
    // Get user ID and verify subscription ownership
    // TODO: Replace with Clerk auth
    // const userId = await getAuthUserId(ctx);
    // if (userId === null) {
    //   throw new Error("Not authenticated");
    // }
    const userId = "temp-user-id"; // Temporary until Clerk is set up

    // Verify subscription exists and user owns it
    const subscription: Doc<"subscriptions"> | null = await ctx.runQuery(
      (internal as any)["ads/functions"].getSubscriptionForAction,
      {
        subscriptionId: args.subscriptionId,
        userId,
      }
    );

    if (!subscription) {
      throw new Error("Subscription not found or unauthorized");
    }

    // Get API key from environment
    const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
    if (!apiKey) {
      throw new Error("SCRAPE_CREATORS_API_KEY not configured");
    }

    // Hardcoded query for MVP
    const searchQuery = "n8n";

    try {
      // Make API request
      const response = await fetch(
        `https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads?query=${encodeURIComponent(searchQuery)}&trim=true&search_type=keyword_exact_phrase&country=US`,
        {
          headers: {
            "x-api-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.searchResults || !Array.isArray(data.searchResults)) {
        throw new Error("Invalid API response format");
      }

      // Take first 5 results
      const results = data.searchResults.slice(0, 5);
      const insertedIds = [];
      let skippedCount = 0;

      // Process each ad result
      for (const result of results) {
        try {
          // Extract data from Facebook Ad Library response
          const archiveId = result.ad_archive_id || result.collation_id || `fb_${Date.now()}_${Math.random()}`;
          const pageName = result.page_name || result.snapshot?.page_name || "Unknown Page";
          const bodyText = result.snapshot?.body?.text || "";

          // Extract images
          const images = result.snapshot?.images || [];
          const imageUrls = images.map((img: any) => img.resized_image_url || img.original_image_url).filter(Boolean);

          // Extract videos
          const videos = result.snapshot?.videos || [];
          const videoUrls = videos.map((vid: any) => vid.video_hd_url || vid.video_sd_url).filter(Boolean);

          // Extract media from carousel cards
          const cards = result.snapshot?.cards || [];
          const cardImageUrls: string[] = [];
          const cardVideoUrls: string[] = [];

          cards.forEach((card: any) => {
            if (card.resized_image_url || card.original_image_url) {
              cardImageUrls.push(card.resized_image_url || card.original_image_url);
            }
            if (card.video_hd_url || card.video_sd_url) {
              cardVideoUrls.push(card.video_hd_url || card.video_sd_url);
            }
          });

          // Combine all media URLs (main images + main videos + card media)
          const allImageUrls = [...imageUrls, ...cardImageUrls];
          const allVideoUrls = [...videoUrls, ...cardVideoUrls];
          const mediaUrls = [...allImageUrls, ...allVideoUrls];

          // Use first video as thumbnail if available, otherwise first image
          const thumbnailUrl = allVideoUrls[0] || allImageUrls[0];

          // Extract link
          const linkUrl = result.snapshot?.link_url;

          // Check if ad already exists
          const exists = await ctx.runQuery(
            (internal as any)["ads/functions"].checkAdExists,
            {
              platform: "facebook",
              adId: archiveId,
            }
          );

          if (exists) {
            skippedCount++;
            continue; // Skip this ad, it already exists
          }

          // STEP 1: Download and store advertiser profile picture
          let profilePictureStorageId = undefined;
          const profilePictureUrl = result.snapshot?.page_profile_picture_url;
          if (profilePictureUrl) {
            const profilePicResult = await ctx.runAction(
              internal.ads.functions.storeMediaFromUrl,
              { url: profilePictureUrl, type: "image" }
            );
            if (profilePicResult) {
              profilePictureStorageId = profilePicResult.storageId;
            }
          }

          // STEP 2: Upsert advertiser (handles deduplication)
          await ctx.runMutation(
            (internal as any)["advertisers/functions"].upsertAdvertiser,
            {
              pageId: result.page_id,
              platform: "facebook",
              pageName: pageName,
              pageLikeCount: result.snapshot?.page_like_count || 0,
              pageCategories: result.snapshot?.page_categories || [],
              pageProfilePictureUrl: profilePictureUrl,
              pageProfilePictureStorageId: profilePictureStorageId,
              pageProfileUri: result.snapshot?.page_profile_uri,
            }
          );

          // STEP 3: Download and store thumbnail (could be video or image)
          let thumbnailStorageId = undefined;
          if (thumbnailUrl) {
            const isThumbnailVideo = allVideoUrls.includes(thumbnailUrl);
            const thumbnailResult = await ctx.runAction(
              internal.ads.functions.storeMediaFromUrl,
              { url: thumbnailUrl, type: isThumbnailVideo ? "video" : "image" }
            );
            if (thumbnailResult) {
              thumbnailStorageId = thumbnailResult.storageId;
            }
          }

          // STEP 4: Download and store all media files in parallel (images and videos)
          const mediaResults = await Promise.all(
            mediaUrls.map(async (url: string) => {
              // Detect media type: check if URL is in allVideoUrls array
              const isVideo = allVideoUrls.includes(url);
              return await ctx.runAction(
                internal.ads.functions.storeMediaFromUrl,
                { url, type: isVideo ? "video" : "image" }
              );
            })
          );

          // Filter successful uploads
          const successfulMedia = mediaResults.filter((r) => r !== null);
          const mediaStorageIds = successfulMedia.map((m) => m!.storageId);
          const mediaMetadata = successfulMedia.map((m) => ({
            type: m!.type,
            storageId: m!.storageId,
            originalUrl: m!.originalUrl,
          }));

          // STEP 5: Extract all new ad fields
          const startDate = result.start_date ? result.start_date * 1000 : Date.now(); // Convert to ms
          const endDate = result.end_date ? result.end_date * 1000 : undefined;
          const isActive = result.is_active ?? true;
          const totalActiveTime = result.total_active_time || 0;

          const displayFormat = result.snapshot?.display_format || "UNKNOWN";
          const ctaText = result.snapshot?.cta_text || "No button";
          const ctaType = result.snapshot?.cta_type || "NO_BUTTON";
          const collationCount = result.collation_count || 1;
          const caption = result.snapshot?.caption ?? undefined;

          const publisherPlatforms = result.publisher_platform || [];
          const reachEstimate = result.reach_estimate
            ? {
                lower: result.reach_estimate.lower_bound,
                upper: result.reach_estimate.upper_bound,
              }
            : undefined;
          const spend = result.spend
            ? {
                lower: result.spend.lower_bound,
                upper: result.spend.upper_bound,
                currency: result.currency || "USD",
              }
            : undefined;

          // Process cards for carousel/DCO ads (transform the earlier extracted cards array)
          const processedCards = cards.map((card: any) => ({
            title: card.title ?? undefined,
            body: card.body ?? undefined,
            caption: card.caption ?? undefined,
            linkUrl: card.link_url ?? undefined,
            imageUrl: card.resized_image_url || card.original_image_url || undefined,
            videoUrl: card.video_hd_url || card.video_sd_url || undefined,
          }));

          // Reuse the videos array extracted earlier
          const hasVideo =
            videos.length > 0 || (processedCards && processedCards.some((c: any) => c.videoUrl));
          const videoCount =
            videos.length + (processedCards?.filter((c: any) => c.videoUrl).length || 0);
          const imageCount =
            images.length + (processedCards?.filter((c: any) => c.imageUrl).length || 0);

          // STEP 6: Create ad record with all new fields including storage IDs
          const adId: Id<"ads"> = await ctx.runMutation(
            (internal as any)["ads/functions"].insertAd,
            {
              userId,
              subscriptionId: args.subscriptionId,
              platform: "facebook",
              adId: archiveId,
              title: pageName,
              description: bodyText || `Ad from ${pageName}`,
              link: linkUrl ?? undefined,
              mediaUrls,
              thumbnailUrl,
              // Media storage fields
              thumbnailStorageId,
              mediaStorageIds: mediaStorageIds.length > 0 ? mediaStorageIds : undefined,
              mediaMetadata: mediaMetadata.length > 0 ? mediaMetadata : undefined,
              scrapedAt: Date.now(),
              rawData: result,
              // New fields
              pageId: result.page_id,
              startDate,
              endDate,
              isActive,
              totalActiveTime,
              displayFormat,
              ctaText,
              ctaType,
              collationCount,
              caption,
              publisherPlatforms,
              reachEstimate,
              spend,
              cards: processedCards,
              hasVideo,
              videoCount,
              imageCount,
            }
          );

          insertedIds.push(adId);
        } catch (error) {
          console.error("Failed to insert ad:", error);
          // Continue processing other ads even if one fails
        }
      }

      const message = skippedCount > 0
        ? `Successfully scraped ${insertedIds.length} new ads (${skippedCount} duplicates skipped)`
        : `Successfully scraped ${insertedIds.length} ads from Facebook Ad Library`;

      return {
        success: true,
        count: insertedIds.length,
        message,
      };
    } catch (error: any) {
      console.error("Facebook Ad Library scrape failed:", error);
      return {
        success: false,
        count: 0,
        error: error.message || "Failed to scrape ads",
      };
    }
  },
});

// Internal query to get subscription for action
export const getSubscriptionForAction = internalQuery({
  args: {
    subscriptionId: v.id("subscriptions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription || subscription.userId !== args.userId) {
      return null;
    }

    return subscription;
  },
});

// Internal query to check if ad already exists
export const checkAdExists = internalQuery({
  args: {
    platform: v.string(),
    adId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingAd = await ctx.db
      .query("ads")
      .withIndex("by_platform_and_ad_id", (q) =>
        q.eq("platform", args.platform).eq("adId", args.adId)
      )
      .first();

    return existingAd !== null;
  },
});
