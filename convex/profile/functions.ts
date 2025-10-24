import { query } from "../_generated/server";

// Get current user profile information
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
      return {
        viewer: null,
        email: null,
      };
    }

    return {
      viewer: identity.name ?? identity.email ?? null,
      email: identity.email ?? null,
    };
  },
});

// Get onboarding profile and generated documents for current organization
export const getOnboardingData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { profile: null, documents: [] };
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      return { profile: null, documents: [] };
    }

    // Get profile for current organization
    const profile = await ctx.db
      .query("onboardingProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    if (!profile) {
      return { profile: null, documents: [] };
    }

    // Get all generated documents for this profile
    const documents = await ctx.db
      .query("generatedDocuments")
      .withIndex("by_profile", (q) => q.eq("onboardingProfileId", profile._id))
      .collect();

    // Sort in consistent order: offer_brief, copy_blocks, ump_ums, beat_map
    const typeOrder = ["offer_brief", "copy_blocks", "ump_ums", "beat_map"];
    const sortedDocuments = documents.sort((a, b) => {
      return typeOrder.indexOf(a.documentType) - typeOrder.indexOf(b.documentType);
    });

    return {
      profile,
      documents: sortedDocuments,
    };
  },
});
