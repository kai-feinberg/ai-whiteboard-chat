import { v } from "convex/values";
import { query, mutation, action, internalQuery, internalMutation } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

// Get all ads for the current user
export const getByUser = query({
  args: {
    platform: v.optional(v.string()),
    subscriptionId: v.optional(v.id("subscriptions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

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

    return filteredAds;
  },
});

// Get a single ad by ID
export const getById = query({
  args: { id: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const ad = await ctx.db.get(args.id);

    if (!ad) {
      throw new Error("Ad not found");
    }

    // Verify ownership
    if (ad.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return ad;
  },
});

// Get ads by subscription ID
export const getBySubscription = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

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

    return ads;
  },
});

// Create example ads for testing
export const createExamples = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Verify subscription ownership
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const examples = [
      {
        userId,
        subscriptionId: args.subscriptionId,
        platform: subscription.platform,
        adId: `ad_${Date.now()}_1`,
        title: "Transform Your Business with AI",
        description:
          "Discover how AI automation can save you 10 hours per week. Join 50,000+ businesses already using our platform.",
        link: "https://example.com/ai-platform",
        mediaUrls: ["https://placehold.co/600x400/blue/white?text=AI+Platform"],
        thumbnailUrl: "https://placehold.co/300x200/blue/white?text=AI",
        scrapedAt: Date.now(),
        rawData: undefined,
      },
      {
        userId,
        subscriptionId: args.subscriptionId,
        platform: subscription.platform,
        adId: `ad_${Date.now()}_2`,
        title: "Limited Time Offer - 50% Off",
        description:
          "Get started today and save big on our annual plan. No credit card required for your 14-day trial.",
        link: "https://example.com/pricing",
        mediaUrls: [
          "https://placehold.co/600x400/green/white?text=Special+Offer",
        ],
        thumbnailUrl: "https://placehold.co/300x200/green/white?text=Offer",
        scrapedAt: Date.now() - 86400000, // 1 day ago
        rawData: undefined,
      },
      {
        userId,
        subscriptionId: args.subscriptionId,
        platform: subscription.platform,
        adId: `ad_${Date.now()}_3`,
        title: "See What Our Customers Are Saying",
        description:
          "4.9/5 stars from 10,000+ reviews. Join the fastest-growing community of professionals.",
        link: "https://example.com/testimonials",
        mediaUrls: [
          "https://placehold.co/600x400/purple/white?text=Testimonials",
        ],
        thumbnailUrl:
          "https://placehold.co/300x200/purple/white?text=Reviews",
        scrapedAt: Date.now() - 172800000, // 2 days ago
        rawData: undefined,
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
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const ad = await ctx.db.get(args.id);
    if (!ad) {
      throw new Error("Ad not found");
    }

    // Verify ownership
    if (ad.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
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
    scrapedAt: v.number(),
    rawData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ads", args);
  },
});

// Scrape ads from Facebook Ad Library API
export const scrapeFromFacebookAdLibrary = action({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; count: number; message?: string; error?: string }> => {
    // Get user ID and verify subscription ownership
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

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

      // Process each ad result
      for (const result of results) {
        try {
          // Extract data from Facebook Ad Library response
          const archiveId = result.ad_archive_id || result.collation_id || `fb_${Date.now()}_${Math.random()}`;
          const pageName = result.page_name || "Unknown Page";
          const bodyText = result.snapshot?.body?.text || "";

          // Extract images
          const images = result.snapshot?.images || [];
          const mediaUrls = images.map((img: any) => img.resized_image_url || img.original_image_url).filter(Boolean);
          const thumbnailUrl = images[0]?.resized_image_url || images[0]?.original_image_url;

          // Extract link
          const linkUrl = result.snapshot?.link_url;

          // Extract publisher platforms
          const platforms = result.publisher_platform || ["FACEBOOK"];
          const platformStr = platforms.join(", ");

          // Create ad record
          const adId: Id<"ads"> = await ctx.runMutation(
            (internal as any)["ads/functions"].insertAd,
            {
              userId,
              subscriptionId: args.subscriptionId,
              platform: "facebook", // Always facebook for Facebook Ad Library scraper
              adId: archiveId,
              title: pageName,
              description: bodyText || `Ad from ${pageName}`,
              link: linkUrl ?? undefined,
              mediaUrls,
              thumbnailUrl,
              scrapedAt: Date.now(),
              rawData: result, // Store full API response for debugging
            }
          );

          insertedIds.push(adId);
        } catch (error) {
          console.error("Failed to insert ad:", error);
          // Continue processing other ads even if one fails
        }
      }

      return {
        success: true,
        count: insertedIds.length,
        message: `Successfully scraped ${insertedIds.length} ads from Facebook Ad Library`,
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
