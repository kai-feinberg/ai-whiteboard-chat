// convex/onboarding/queries.ts
import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";

/**
 * Get onboarding profile for current organization
 * Returns null if no profile exists yet
 */
export const getOnboardingProfile = query({
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

    const profile = await ctx.db
      .query("onboardingProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    return profile;
  },
});

/**
 * Get profile by ID (internal - used by workflow actions)
 */
export const getProfileById = internalQuery({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId);
  },
});

/**
 * Get all generated documents for a profile
 * Real-time subscription - updates as documents are generated
 */
export const getGeneratedDocuments = query({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Verify profile belongs to current organization
    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.organizationId !== organizationId) {
      throw new Error("Unauthorized - profile belongs to different organization");
    }

    // Fetch all documents for this profile
    const documents = await ctx.db
      .query("generatedDocuments")
      .withIndex("by_profile", (q) => q.eq("onboardingProfileId", args.profileId))
      .collect();

    // Return in consistent order: offer_brief, copy_blocks, ump_ums, beat_map
    const typeOrder = ["offer_brief", "copy_blocks", "ump_ums", "beat_map"];
    return documents.sort((a, b) => {
      return typeOrder.indexOf(a.documentType) - typeOrder.indexOf(b.documentType);
    });
  },
});

/**
 * Get a specific document by type
 */
export const getDocumentByType = query({
  args: {
    profileId: v.id("onboardingProfiles"),
    documentType: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Verify profile belongs to current organization
    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.organizationId !== organizationId) {
      throw new Error("Unauthorized - profile belongs to different organization");
    }

    const document = await ctx.db
      .query("generatedDocuments")
      .withIndex("by_profile_and_type", (q) =>
        q
          .eq("onboardingProfileId", args.profileId)
          .eq("documentType", args.documentType)
      )
      .first();

    return document;
  },
});
