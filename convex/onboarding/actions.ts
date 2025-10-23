// convex/onboarding/actions.ts
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
});

const model = openrouter("anthropic/claude-haiku-4.5");

/**
 * System prompts for each document type
 * These are hardcoded for MVP - can be moved to database later
 */
const SYSTEM_PROMPTS = {
  offerBrief: `You are an expert direct response copywriter and marketing strategist analyzing product offers.

Your task is to create a comprehensive Offer Brief that analyzes the product's core promise, unique value proposition, and market positioning.

Structure your analysis as follows:
1. **Core Offer** - What is being sold and the main promise
2. **Unique Value Proposition** - What makes this different from competitors
3. **Target Market** - Who this is for and why they need it
4. **Key Benefits** - Primary benefits and transformations promised
5. **Proof Elements** - What evidence supports the claims
6. **Positioning Strategy** - How this offer should be positioned in the market

Use clear, professional markdown formatting with headers, bullet points, and emphasis where appropriate.
Be thorough but concise - aim for 300-500 words.`,

  copyBlocks: `You are a direct response copywriter specializing in converting copy analysis.

Your task is to extract and organize key copy blocks that can be reused across marketing materials.

Structure your output as follows:
1. **Headlines** - Primary headlines and hooks (5-7 variations)
2. **Sub-Headlines** - Supporting headlines and value statements
3. **Bullet Points** - Key benefit bullets and feature highlights
4. **Calls-to-Action** - Action-oriented CTAs (5+ variations)
5. **Objection Handlers** - Responses to common objections
6. **Social Proof Templates** - Testimonial and credibility elements

Format each section with markdown headers and bullet points.
Make copy blocks actionable and ready to use.
Aim for 400-600 words total.`,

  umpUms: `You are a marketing strategist specializing in Universal Mechanisms - the core believable mechanism behind marketing promises.

Your task is to identify and articulate:
1. **Universal Marketing Promise (UMP)** - The single biggest promise/outcome
2. **Universal Marketing Sell (UMS)** - The unique mechanism that delivers the promise
3. **Mechanism Explanation** - Why this mechanism is believable and different
4. **Supporting Elements** - What makes this mechanism credible

The mechanism should be:
- Unique and proprietary-sounding
- Believable and logical
- Different from obvious solutions
- Emotionally compelling

Use markdown formatting with clear headers.
Aim for 250-400 words.`,

  beatMap: `You are a VSL (Video Sales Letter) analyst specializing in sales psychology and persuasion sequences.

Your task is to create a beat-by-beat breakdown of the sales letter/VSL, identifying:

1. **Hook/Pattern Interrupt** - Opening that grabs attention
2. **Story/Problem Agitation** - Emotional engagement and pain points
3. **Solution Introduction** - When and how the solution appears
4. **Credibility Building** - Authority and proof elements
5. **Mechanism Reveal** - The "secret" or unique approach
6. **Benefits Amplification** - Outcome painting and desire building
7. **Objection Handling** - Addressing doubts and concerns
8. **Scarcity/Urgency** - Time or availability pressure
9. **Call-to-Action** - The ask and close sequence

For each beat, note:
- Timestamp/position (if applicable)
- Key emotional trigger
- Purpose in the sales sequence
- Notable techniques used

Use structured markdown with headers and bullet points.
Aim for 500-800 words.`,
};

/**
 * Generate Offer Brief document
 */
export const generateOfferBrief = internalAction({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args): Promise<void> => {
    await generateDocument(
      ctx,
      args.profileId,
      "offer_brief",
      SYSTEM_PROMPTS.offerBrief
    );
  },
});

/**
 * Generate Copy Blocks document
 */
export const generateCopyBlocks = internalAction({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args): Promise<void> => {
    await generateDocument(
      ctx,
      args.profileId,
      "copy_blocks",
      SYSTEM_PROMPTS.copyBlocks
    );
  },
});

/**
 * Generate UMP/UMS document
 */
export const generateUMPUMS = internalAction({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args): Promise<void> => {
    await generateDocument(
      ctx,
      args.profileId,
      "ump_ums",
      SYSTEM_PROMPTS.umpUms
    );
  },
});

/**
 * Generate Beat Map document
 */
export const generateBeatMap = internalAction({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args): Promise<void> => {
    await generateDocument(
      ctx,
      args.profileId,
      "beat_map",
      SYSTEM_PROMPTS.beatMap
    );
  },
});

/**
 * Shared document generation logic
 * Handles AI call, status updates, and error handling
 */
async function generateDocument(
  ctx: any,
  profileId: Id<"onboardingProfiles">,
  documentType: string,
  systemPrompt: string
): Promise<void> {
  try {
    console.log(`[${documentType}] Starting generation for profile ${profileId}`);

    // Update status to "generating"
    await ctx.runMutation(internal.onboarding.mutations.updateDocumentStatus, {
      profileId,
      documentType,
      status: "generating",
    });

    // Fetch profile data
    const profile = await ctx.runQuery(
      internal.onboarding.queries.getProfileById,
      { profileId }
    );

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Build user prompt from profile data
    const userPrompt = buildUserPrompt(profile, documentType);

    console.log(`[${documentType}] Calling AI model...`);

    // Call AI to generate content
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    const content = result.text;

    console.log(`[${documentType}] Generated ${content.length} characters`);

    // Save completed document
    await ctx.runMutation(internal.onboarding.mutations.saveGeneratedDocument, {
      profileId,
      documentType,
      content,
    });

    console.log(`[${documentType}] ✅ Completed successfully`);
  } catch (error) {
    console.error(`[${documentType}] ❌ Generation failed:`, error);

    // Save error state
    await ctx.runMutation(internal.onboarding.mutations.updateDocumentStatus, {
      profileId,
      documentType,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    // Re-throw so workflow can retry
    throw error;
  }
}

/**
 * Build user prompt from profile data
 * Customizes prompt based on document type and available data
 */
function buildUserPrompt(profile: any, documentType: string): string {
  const baseContext = `
PRODUCT DESCRIPTION:
${profile.productDescription}

MARKET DESCRIPTION:
${profile.marketDescription}

TARGET BUYER:
${profile.targetBuyerDescription}
${profile.websiteUrl ? `\nWEBSITE: ${profile.websiteUrl}` : ""}
${profile.vslTranscript ? `\n\nVSL/SALES LETTER TRANSCRIPT:\n${profile.vslTranscript}` : ""}
`;

  switch (documentType) {
    case "offer_brief":
      return `${baseContext}\n\nBased on the above information, create a comprehensive Offer Brief analyzing this product offer.`;

    case "copy_blocks":
      return `${baseContext}\n\nBased on the above information, extract and create reusable copy blocks for marketing this product.`;

    case "ump_ums":
      return `${baseContext}\n\nBased on the above information, identify the Universal Marketing Promise (UMP) and Universal Marketing Sell (UMS) - the core mechanism that makes this offer unique and believable.`;

    case "beat_map":
      if (!profile.vslTranscript) {
        throw new Error("VSL transcript is required for beat map generation");
      }
      return `${baseContext}\n\nAnalyze the VSL/sales letter transcript above and create a detailed beat-by-beat breakdown of the sales sequence, identifying hooks, emotional triggers, and persuasion tactics.`;

    default:
      return baseContext;
  }
}
