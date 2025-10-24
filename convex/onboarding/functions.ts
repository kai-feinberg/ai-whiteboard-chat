// convex/onboarding/functions.ts
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { workflow } from "./workflow";

/**
 * Submit onboarding form and kick off document generation workflow
 * If organization already has a profile, updates it and regenerates documents
 */
export const submitOnboardingForm = mutation({
  args: {
    websiteUrl: v.optional(v.string()),
    vslTranscript: v.string(),
    productDescription: v.string(),
    marketDescription: v.string(),
    targetBuyerDescription: v.string(),
    additionalIdeas: v.optional(v.string()),
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

    console.log(`[submitOnboardingForm] Processing for org: ${organizationId}`);

    // Check if organization already has a profile (one per org)
    const existingProfile = await ctx.db
      .query("onboardingProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    let profileId: Id<"onboardingProfiles">;

    if (existingProfile) {
      console.log(`[submitOnboardingForm] Updating existing profile ${existingProfile._id}`);

      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        websiteUrl: args.websiteUrl,
        vslTranscript: args.vslTranscript,
        productDescription: args.productDescription,
        marketDescription: args.marketDescription,
        targetBuyerDescription: args.targetBuyerDescription,
        additionalIdeas: args.additionalIdeas,
        completedAt: undefined, // Reset completion status
        workflowId: undefined, // Will be set below
      });

      profileId = existingProfile._id;

      // Delete old generated documents (fresh start)
      const oldDocs = await ctx.db
        .query("generatedDocuments")
        .withIndex("by_profile", (q) => q.eq("onboardingProfileId", profileId))
        .collect();

      await Promise.all(oldDocs.map((doc) => ctx.db.delete(doc._id)));
      console.log(`[submitOnboardingForm] Deleted ${oldDocs.length} old documents`);

    } else {
      console.log(`[submitOnboardingForm] Creating new profile`);

      // Create new profile
      profileId = await ctx.db.insert("onboardingProfiles", {
        organizationId,
        createdBy: identity.subject,
        websiteUrl: args.websiteUrl,
        vslTranscript: args.vslTranscript,
        productDescription: args.productDescription,
        marketDescription: args.marketDescription,
        targetBuyerDescription: args.targetBuyerDescription,
        additionalIdeas: args.additionalIdeas,
      });
    }

    // Start workflow to generate documents
    console.log(`[submitOnboardingForm] Starting workflow for profile ${profileId}`);

    const workflowId: string = await workflow.start(
      ctx,
      internal.onboarding.workflow.documentGenerationWorkflow,
      {
        onboardingProfileId: profileId,
        organizationId,
      },
      {
        onComplete: internal.onboarding.mutations.handleWorkflowComplete,
        context: { profileId, organizationId },
      }
    );

    // Store workflow ID on profile for tracking
    await ctx.db.patch(profileId, { workflowId });

    console.log(`[submitOnboardingForm] ✅ Workflow ${workflowId} started`);

    return {
      profileId,
      workflowId,
    };
  },
});
