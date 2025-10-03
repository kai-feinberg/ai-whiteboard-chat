import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Legacy example table
  numbers: defineTable({
    value: v.number(),
  }),

  // Ad Subscriptions - User's tracked search terms and companies
  subscriptions: defineTable({
    userId: v.string(), // Auth identity subject
    searchTerm: v.optional(v.string()),
    company: v.optional(v.string()),
    platform: v.string(), // "facebook", "google", "linkedin", etc.
    frequency: v.string(), // "daily", "weekly", "realtime"
    isActive: v.boolean(),
    lastScrapedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // Ads - Scraped ad data
  ads: defineTable({
    userId: v.string(), // Auth identity subject
    subscriptionId: v.id("subscriptions"),
    platform: v.string(),
    adId: v.string(), // Platform's unique ad ID
    title: v.string(),
    description: v.string(),
    link: v.optional(v.string()),
    mediaUrls: v.array(v.string()),
    thumbnailUrl: v.optional(v.string()),
    scrapedAt: v.number(),
    rawData: v.optional(v.any()), // Store full platform response
  })
    .index("by_user", ["userId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_scraped_at", ["scrapedAt"]),
});
