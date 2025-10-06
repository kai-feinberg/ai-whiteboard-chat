import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all subscriptions for the current user
export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return subscriptions;
  },
});

// Get a single subscription by ID
export const getById = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const subscription = await ctx.db.get(args.id);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Verify ownership
    if (subscription.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return subscription;
  },
});

// Create a new subscription
export const create = mutation({
  args: {
    searchTerm: v.optional(v.string()),
    company: v.optional(v.string()),
    platform: v.string(),
    frequency: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Validate: must have either searchTerm or company
    if (!args.searchTerm && !args.company) {
      throw new Error("Must provide either searchTerm or company");
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId,
      searchTerm: args.searchTerm,
      company: args.company,
      platform: args.platform,
      frequency: args.frequency,
      isActive: true,
      lastScrapedAt: undefined,
    });

    return subscriptionId;
  },
});

// Update an existing subscription
export const update = mutation({
  args: {
    id: v.id("subscriptions"),
    searchTerm: v.optional(v.string()),
    company: v.optional(v.string()),
    platform: v.optional(v.string()),
    frequency: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const subscription = await ctx.db.get(args.id);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Verify ownership
    if (subscription.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

// Delete a subscription
export const remove = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const subscription = await ctx.db.get(args.id);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Verify ownership
    if (subscription.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create example subscriptions for testing
export const createExamples = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const examples = [
      {
        userId,
        searchTerm: "SaaS software",
        company: undefined,
        platform: "facebook",
        frequency: "daily",
        isActive: true,
      },
      {
        userId,
        searchTerm: undefined,
        company: "Shopify",
        platform: "facebook",
        frequency: "weekly",
        isActive: true,
      },
      {
        userId,
        searchTerm: "AI tools",
        company: undefined,
        platform: "google",
        frequency: "daily",
        isActive: true,
      },
    ];

    const ids = await Promise.all(
      examples.map((example) => ctx.db.insert("subscriptions", example))
    );

    return ids;
  },
});
