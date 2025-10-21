import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

// Get all subscriptions for the current user's organization
export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;
    const orgId = identity.organizationId;

    if (!orgId || typeof orgId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    return subscriptions;
  },
});

// Get a single subscription by ID
export const getById = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;
    const orgId = identity.organizationId;

    if (!orgId || typeof orgId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const subscription = await ctx.db.get(args.id);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Verify organization ownership
    if (subscription.organizationId !== orgId) {
      throw new Error("Unauthorized - subscription belongs to a different organization");
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
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;
    const orgId = identity.organizationId;

    if (!orgId || typeof orgId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Validate: must have either searchTerm or company
    if (!args.searchTerm && !args.company) {
      throw new Error("Must provide either searchTerm or company");
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId,
      organizationId: orgId,
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
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;
    const orgId = identity.organizationId;

    if (!orgId || typeof orgId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const subscription = await ctx.db.get(args.id);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Verify organization ownership
    if (subscription.organizationId !== orgId) {
      throw new Error("Unauthorized - subscription belongs to a different organization");
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
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;
    const orgId = identity.organizationId;

    if (!orgId || typeof orgId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const subscription = await ctx.db.get(args.id);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Verify organization ownership
    if (subscription.organizationId !== orgId) {
      throw new Error("Unauthorized - subscription belongs to a different organization");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create example subscriptions for testing
export const createExamples = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;
    const orgId = identity.organizationId;

    if (!orgId || typeof orgId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const examples = [
      {
        userId,
        organizationId: orgId,
        searchTerm: "SaaS software",
        company: undefined,
        platform: "facebook",
        frequency: "daily",
        isActive: true,
      },
      {
        userId,
        organizationId: orgId,
        searchTerm: undefined,
        company: "Shopify",
        platform: "facebook",
        frequency: "weekly",
        isActive: true,
      },
      {
        userId,
        organizationId: orgId,
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
