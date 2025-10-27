// convex/ad-creation/queries.ts
import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";

/**
 * Get all created ads for current organization
 * Returns ads with populated concept/angle/style/hook names
 */
export const getCreatedAds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch all ads for this organization
    const ads = await ctx.db
      .query("createdAds")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    // Populate concept/angle/style/hook names
    const adsWithNames = await Promise.all(
      ads.map(async (ad) => {
        const concept = await ctx.db.get(ad.conceptId);
        const angle = await ctx.db.get(ad.angleId);
        const style = await ctx.db.get(ad.styleId);
        const hook = await ctx.db.get(ad.hookId);

        return {
          ...ad,
          conceptName: concept?.name || "Unknown",
          angleName: angle?.name || "Unknown",
          styleName: style?.name || "Unknown",
          hookName: hook?.name || "Unknown",
        };
      })
    );

    return adsWithNames;
  },
});

/**
 * Get created ad by ID with full details + populated filter names + desires/beliefs
 */
export const getCreatedAdById = query({
  args: { adId: v.id("createdAds") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch ad
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.organizationId !== organizationId) {
      throw new Error("Ad not found or unauthorized");
    }

    // Populate concept/angle/style/hook names
    const concept = await ctx.db.get(ad.conceptId);
    const angle = await ctx.db.get(ad.angleId);
    const style = await ctx.db.get(ad.styleId);
    const hook = await ctx.db.get(ad.hookId);

    // Fetch desires and beliefs
    const desires = await Promise.all(
      ad.selectedDesireIds.map((id) => ctx.db.get(id))
    );
    const beliefs = await Promise.all(
      ad.selectedBeliefIds.map((id) => ctx.db.get(id))
    );

    return {
      ...ad,
      concept,
      angle,
      style,
      hook,
      desires: desires.filter((d) => d !== null),
      beliefs: beliefs.filter((b) => b !== null),
    };
  },
});

/**
 * Get ad documents for a specific ad
 * Returns array of 4 documents with documentId, type, version
 */
export const getAdDocuments = query({
  args: { adId: v.id("createdAds") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Verify ad belongs to current organization
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.organizationId !== organizationId) {
      throw new Error("Ad not found or unauthorized");
    }

    // Fetch all documents for this ad
    const documents = await ctx.db
      .query("adDocuments")
      .withIndex("by_ad", (q) => q.eq("adId", args.adId))
      .collect();

    // Return in consistent order
    const typeOrder = ["details", "copy", "asset_brief", "notes"];
    return documents.sort((a, b) => {
      return typeOrder.indexOf(a.documentType) - typeOrder.indexOf(b.documentType);
    });
  },
});

/**
 * Get ad concepts (global + org-specific)
 */
export const getAdConcepts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch global concepts (organizationId is undefined/null)
    const globalConcepts = await ctx.db
      .query("adConcepts")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    // Fetch org-specific concepts
    const orgConcepts = await ctx.db
      .query("adConcepts")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    return [...globalConcepts, ...orgConcepts];
  },
});

/**
 * Get ad angles (global + org-specific)
 */
export const getAdAngles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch global angles
    const globalAngles = await ctx.db
      .query("adAngles")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    // Fetch org-specific angles
    const orgAngles = await ctx.db
      .query("adAngles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    return [...globalAngles, ...orgAngles];
  },
});

/**
 * Get ad styles (global + org-specific)
 */
export const getAdStyles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch global styles
    const globalStyles = await ctx.db
      .query("adStyles")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    // Fetch org-specific styles
    const orgStyles = await ctx.db
      .query("adStyles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    return [...globalStyles, ...orgStyles];
  },
});

/**
 * Get ad hooks (global + org-specific)
 */
export const getAdHooks = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch global hooks
    const globalHooks = await ctx.db
      .query("adHooks")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    // Fetch org-specific hooks
    const orgHooks = await ctx.db
      .query("adHooks")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    return [...globalHooks, ...orgHooks];
  },
});

/**
 * Get document template by type
 * Returns global template (org-specific templates for future enhancement)
 */
export const getDocumentTemplate = query({
  args: { templateType: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Check for org-specific template first
    const orgTemplate = await ctx.db
      .query("documentTemplates")
      .withIndex("by_template_type", (q) => q.eq("templateType", args.templateType))
      .filter((q) => q.eq(q.field("organizationId"), organizationId))
      .first();

    if (orgTemplate) {
      return orgTemplate;
    }

    // Fall back to global template
    const globalTemplate = await ctx.db
      .query("documentTemplates")
      .withIndex("by_template_type", (q) => q.eq("templateType", args.templateType))
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .first();

    return globalTemplate;
  },
});

/**
 * Internal query to get template content (used by actions)
 */
export const getTemplateContentInternal = internalQuery({
  args: { templateType: v.string() },
  handler: async (ctx, args) => {
    // Fetch global template only (internal actions don't have org context yet)
    const template = await ctx.db
      .query("documentTemplates")
      .withIndex("by_template_type", (q) => q.eq("templateType", args.templateType))
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .first();

    return template?.templateContent || null;
  },
});

/**
 * Internal query to get ad by ID (for internal actions)
 */
export const getCreatedAdByIdInternal = internalQuery({
  args: { adId: v.id("createdAds") },
  handler: async (ctx, args) => {
    // Fetch ad
    const ad = await ctx.db.get(args.adId);
    if (!ad) {
      return null;
    }

    // Populate concept/angle/style/hook names
    const concept = await ctx.db.get(ad.conceptId);
    const angle = await ctx.db.get(ad.angleId);
    const style = await ctx.db.get(ad.styleId);
    const hook = await ctx.db.get(ad.hookId);

    // Fetch desires and beliefs
    const desires = await Promise.all(
      ad.selectedDesireIds.map((id) => ctx.db.get(id))
    );
    const beliefs = await Promise.all(
      ad.selectedBeliefIds.map((id) => ctx.db.get(id))
    );

    return {
      ...ad,
      concept,
      angle,
      style,
      hook,
      desires: desires.filter((d) => d !== null),
      beliefs: beliefs.filter((b) => b !== null),
    };
  },
});
