// convex/organization/functions.ts
import { v } from "convex/values";
import { query, mutation, internalQuery } from "../_generated/server";

/**
 * Get organization settings
 */
export const getOrganizationSettings = query({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch org settings
    const settings = await ctx.db
      .query("organization_settings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    return settings || null;
  },
});

/**
 * Get organization settings (internal - no auth check)
 */
export const getOrganizationSettingsInternal = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch org settings
    const settings = await ctx.db
      .query("organization_settings")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    return settings || null;
  },
});

/**
 * Update organization settings (creates if doesn't exist)
 */
export const updateOrganizationSettings = mutation({
  args: {
    businessContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Check if settings exist
    const existingSettings = await ctx.db
      .query("organization_settings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        businessContext: args.businessContext,
        updatedAt: Date.now(),
      });
      return { success: true, settingsId: existingSettings._id };
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("organization_settings", {
        organizationId,
        businessContext: args.businessContext,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { success: true, settingsId };
    }
  },
});
