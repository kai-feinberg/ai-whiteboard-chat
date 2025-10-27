// convex/onboarding/mutations.ts
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";

/**
 * Create 7 pending document records for a new workflow
 */
export const createPendingDocuments = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const documentTypes = [
      "offer_brief",
      "copy_blocks",
      "ump_ums",
      "beat_map",
      "build_a_buyer",
      "pain_core_wound",
      "competitors"
    ];

    console.log(`[createPendingDocuments] Creating 7 documents for profile ${args.profileId}`);

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
 * Create pending analysis records for all documents
 */
export const createPendingAnalysis = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const documentTypes = [
      "offer_brief",
      "copy_blocks",
      "ump_ums",
      "beat_map",
      "build_a_buyer",
      "pain_core_wound",
      "competitors"
    ];

    console.log(`[createPendingAnalysis] Creating 7 analysis records for profile ${args.profileId}`);

    await Promise.all(
      documentTypes.map((type) =>
        ctx.db.insert("documentAnalysis", {
          organizationId: args.organizationId,
          onboardingProfileId: args.profileId,
          documentType: type,
          status: "pending",
          completeness: 0,
          suggestions: [],
          missingElements: [],
          regenerationCount: 0,
        })
      )
    );

    console.log(`[createPendingAnalysis] ✅ Created all pending analysis records`);
  },
});

/**
 * Update analysis status
 */
export const updateAnalysisStatus = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    documentType: v.string(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("documentAnalysis")
      .withIndex("by_profile_and_type", (q) =>
        q
          .eq("onboardingProfileId", args.profileId)
          .eq("documentType", args.documentType)
      )
      .first();

    if (!analysis) {
      throw new Error(`Analysis ${args.documentType} not found for profile ${args.profileId}`);
    }

    await ctx.db.patch(analysis._id, {
      status: args.status,
      errorMessage: args.errorMessage,
    });

    console.log(`[updateAnalysisStatus] ${args.documentType} -> ${args.status}`);
  },
});

/**
 * Save analysis results
 */
export const saveAnalysisResults = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    documentType: v.string(),
    completeness: v.number(),
    suggestions: v.array(v.string()),
    missingElements: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("documentAnalysis")
      .withIndex("by_profile_and_type", (q) =>
        q
          .eq("onboardingProfileId", args.profileId)
          .eq("documentType", args.documentType)
      )
      .first();

    if (!analysis) {
      throw new Error(`Analysis ${args.documentType} not found for profile ${args.profileId}`);
    }

    await ctx.db.patch(analysis._id, {
      completeness: args.completeness,
      suggestions: args.suggestions,
      missingElements: args.missingElements,
      status: "completed",
      analysisGeneratedAt: Date.now(),
      errorMessage: undefined,
    });

    console.log(`[saveAnalysisResults] ✅ Saved ${args.documentType} analysis (${args.completeness}% complete)`);
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

/**
 * Upsert target desires (batch replace)
 * Internal mutation - called from generation actions
 */
export const upsertTargetDesires = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    organizationId: v.string(),
    items: v.array(
      v.object({
        text: v.string(),
        category: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    console.log(`[upsertTargetDesires] Replacing desires for profile ${args.profileId}`);

    // Delete all existing desires
    const existing = await ctx.db
      .query("targetDesires")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();

    await Promise.all(existing.map((item) => ctx.db.delete(item._id)));

    console.log(`[upsertTargetDesires] Deleted ${existing.length} existing desires`);

    // Insert new batch
    await Promise.all(
      args.items.map((item) =>
        ctx.db.insert("targetDesires", {
          organizationId: args.organizationId,
          profileId: args.profileId,
          text: item.text,
          category: item.category,
        })
      )
    );

    console.log(`[upsertTargetDesires] ✅ Inserted ${args.items.length} new desires`);
  },
});

/**
 * Upsert target beliefs (batch replace)
 * Internal mutation - called from generation actions
 */
export const upsertTargetBeliefs = internalMutation({
  args: {
    profileId: v.id("onboardingProfiles"),
    organizationId: v.string(),
    items: v.array(
      v.object({
        text: v.string(),
        category: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    console.log(`[upsertTargetBeliefs] Replacing beliefs for profile ${args.profileId}`);

    // Delete all existing beliefs
    const existing = await ctx.db
      .query("targetBeliefs")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();

    await Promise.all(existing.map((item) => ctx.db.delete(item._id)));

    console.log(`[upsertTargetBeliefs] Deleted ${existing.length} existing beliefs`);

    // Insert new batch
    await Promise.all(
      args.items.map((item) =>
        ctx.db.insert("targetBeliefs", {
          organizationId: args.organizationId,
          profileId: args.profileId,
          text: item.text,
          category: item.category,
        })
      )
    );

    console.log(`[upsertTargetBeliefs] ✅ Inserted ${args.items.length} new beliefs`);
  },
});
