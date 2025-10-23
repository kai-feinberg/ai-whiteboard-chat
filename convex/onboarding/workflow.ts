// convex/onboarding/workflow.ts
import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Workflow Manager for onboarding document generation
 * Configured with retry behavior and parallelism limits
 */
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 4, // Allow all 4 documents to generate in parallel
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 2000,
      base: 2, // Exponential backoff: 2s, 4s, 8s
    },
  },
});

/**
 * Document Generation Workflow
 * Orchestrates the creation of 4 marketing documents in parallel:
 * 1. Offer Brief
 * 2. Copy Blocks
 * 3. UMP/UMS (Universal Mechanism)
 * 4. Beat Map (VSL breakdown)
 */
export const documentGenerationWorkflow = workflow.define({
  args: {
    onboardingProfileId: v.id("onboardingProfiles"),
    organizationId: v.string(),
  },
  handler: async (step, args): Promise<void> => {
    // Step 1: Create 4 pending document records in database
    await step.runMutation(
      internal.onboarding.mutations.createPendingDocuments,
      {
        profileId: args.onboardingProfileId,
        organizationId: args.organizationId
      },
      { name: "create-pending-docs" }
    );

    // Step 2: Generate all 4 documents in parallel
    // Each action handles its own error state and status updates
    await Promise.all([
      step.runAction(
        internal.onboarding.actions.generateOfferBrief,
        { profileId: args.onboardingProfileId },
        {
          name: "generate-offer-brief",
          retry: true // Uses default retry behavior (3 attempts)
        }
      ),

      step.runAction(
        internal.onboarding.actions.generateCopyBlocks,
        { profileId: args.onboardingProfileId },
        {
          name: "generate-copy-blocks",
          retry: true
        }
      ),

      step.runAction(
        internal.onboarding.actions.generateUMPUMS,
        { profileId: args.onboardingProfileId },
        {
          name: "generate-ump-ums",
          retry: true
        }
      ),

      step.runAction(
        internal.onboarding.actions.generateBeatMap,
        { profileId: args.onboardingProfileId },
        {
          name: "generate-beat-map",
          retry: true
        }
      ),
    ]);

    // Step 3: Mark profile as completed (regardless of individual failures)
    await step.runMutation(
      internal.onboarding.mutations.markProfileCompleted,
      { profileId: args.onboardingProfileId },
      { name: "mark-completed" }
    );
  },
});
