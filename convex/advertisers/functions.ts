import { v } from "convex/values";
import { query, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Internal mutation to upsert advertiser (handles deduplication)
export const upsertAdvertiser = internalMutation({
  args: {
    pageId: v.string(),
    platform: v.string(),
    pageName: v.string(),
    pageLikeCount: v.number(),
    pageCategories: v.array(v.string()),
    pageProfilePictureUrl: v.optional(v.string()),
    pageProfilePictureStorageId: v.optional(v.id("_storage")),
    pageProfileUri: v.optional(v.string()),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if advertiser already exists
    const existing = await ctx.db
      .query("advertisers")
      .withIndex("by_page_id_and_platform", (q) =>
        q.eq("pageId", args.pageId).eq("platform", args.platform)
      )
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        pageName: args.pageName,
        pageLikeCount: args.pageLikeCount,
        pageCategories: args.pageCategories,
        pageProfilePictureUrl: args.pageProfilePictureUrl,
        pageProfilePictureStorageId: args.pageProfilePictureStorageId,
        pageProfileUri: args.pageProfileUri,
        organizationId: args.organizationId,
        lastScrapedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new record
      return await ctx.db.insert("advertisers", {
        ...args,
        lastScrapedAt: Date.now(),
      });
    }
  },
});

// Query to get advertiser by pageId
export const getByPageId = query({
  args: {
    pageId: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advertisers")
      .withIndex("by_page_id_and_platform", (q) =>
        q.eq("pageId", args.pageId).eq("platform", args.platform)
      )
      .first();
  },
});

// Query to get multiple advertisers by pageIds (batch fetch)
export const getByPageIds = query({
  args: {
    pageIds: v.array(v.string()),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const advertisers = await Promise.all(
      args.pageIds.map((pageId) =>
        ctx.db
          .query("advertisers")
          .withIndex("by_page_id_and_platform", (q) =>
            q.eq("pageId", pageId).eq("platform", args.platform)
          )
          .first()
      )
    );
    return advertisers.filter(Boolean);
  },
});

// Query to get all advertisers for a platform
export const getByPlatform = query({
  args: {
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advertisers")
      .withIndex("by_platform", (q) => q.eq("platform", args.platform))
      .collect();
  },
});
