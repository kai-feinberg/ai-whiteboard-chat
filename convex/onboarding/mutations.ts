// convex/onboarding/mutations.ts
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";

/**
 * Create 4 pending document records for a new workflow
 */
export const createPendingDocuments = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const documentTypes = ["offer_brief", "copy_blocks", "ump_ums", "beat_map"];

    console.log(`[createPendingDocuments] Creating 4 documents for profile ${args.profileId}`);

    await Promise.all(
      documentTypes.map((type) =>
        ctx.db.insert("generatedDocuments", {
          organizationId: args.organizationId,
          onboardingProfileId: args.profileId,
          documentType: type,
          status: "pending",
          regenerationCount: 0,
        })
      )
    );

    console.log(`[createPendingDocuments] ✅ Created all pending documents`);
  },
});

/**
 * Update document status (used during generation)
 */
export const updateDocumentStatus = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    documentType: v.string(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("generatedDocuments")
      .withIndex("by_profile_and_type", (q) =>
        q
          .eq("onboardingProfileId", args.profileId)
          .eq("documentType", args.documentType)
      )
      .first();

    if (!doc) {
      throw new Error(`Document ${args.documentType} not found for profile ${args.profileId}`);
    }

    await ctx.db.patch(doc._id, {
      status: args.status,
      errorMessage: args.errorMessage,
    });

    console.log(`[updateDocumentStatus] ${args.documentType} -> ${args.status}`);
  },
});

/**
 * Save generated document content and mark as completed
 */
export const saveGeneratedDocument = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    documentType: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("generatedDocuments")
      .withIndex("by_profile_and_type", (q) =>
        q
          .eq("onboardingProfileId", args.profileId)
          .eq("documentType", args.documentType)
      )
      .first();

    if (!doc) {
      throw new Error(`Document ${args.documentType} not found for profile ${args.profileId}`);
    }

    await ctx.db.patch(doc._id, {
      content: args.content,
      status: "completed",
      generatedAt: Date.now(),
      errorMessage: undefined, // Clear any previous errors
    });

    console.log(`[saveGeneratedDocument] ✅ Saved ${args.documentType} (${args.content.length} chars)`);
  },
});

/**
 * Mark onboarding profile as completed
 * Called after all documents have finished (success or failure)
 */
export const markProfileCompleted = internalMutation({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      completedAt: Date.now(),
    });

    console.log(`[markProfileCompleted] ✅ Profile ${args.profileId} marked as completed`);
  },
});

/**
 * Workflow completion handler
 * Called by workflow component when workflow finishes
 */
export const handleWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),
  },
  handler: async (ctx, args) => {
    const { profileId, organizationId } = args.context as {
      profileId: string;
      organizationId: string;
    };

    if (args.result.kind === "success") {
      console.log(`✅ Onboarding workflow completed successfully for profile ${profileId}`);

      // Count successful documents
      const docs = await ctx.db
        .query("generatedDocuments")
        .withIndex("by_profile", (q) => q.eq("onboardingProfileId", profileId as any))
        .collect();

      const completed = docs.filter(d => d.status === "completed").length;
      const failed = docs.filter(d => d.status === "failed").length;

      console.log(`📊 Results: ${completed} completed, ${failed} failed out of ${docs.length} total`);

    } else if (args.result.kind === "failed") {
      console.error(`❌ Onboarding workflow failed for profile ${profileId}`);

    } else if (args.result.kind === "canceled") {
      console.log(`⚠️ Onboarding workflow canceled for profile ${profileId}`);
    }
  },
});
