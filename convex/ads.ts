import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all ads for the current user
export const getByUser = query({
  args: {
    platform: v.optional(v.string()),
    subscriptionId: v.optional(v.id("subscriptions")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let adsQuery = ctx.db
      .query("ads")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject));

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const ad = await ctx.db.get(args.id);

    if (!ad) {
      throw new Error("Ad not found");
    }

    // Verify ownership
    if (ad.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    return ad;
  },
});

// Get ads by subscription ID
export const getBySubscription = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
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
    if (!subscription || subscription.userId !== identity.subject) {
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify subscription ownership
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const examples = [
      {
        userId: identity.subject,
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
        userId: identity.subject,
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
        userId: identity.subject,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const ad = await ctx.db.get(args.id);
    if (!ad) {
      throw new Error("Ad not found");
    }

    // Verify ownership
    if (ad.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
