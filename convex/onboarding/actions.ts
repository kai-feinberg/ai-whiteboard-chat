// convex/onboarding/actions.ts
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
// import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {anthropic} from "@ai-sdk/anthropic";
import { generateText, generateObject } from "ai";
import { z } from "zod";

// const openrouter = createOpenRouter({
//   apiKey: process.env.OPEN_ROUTER_API_KEY,
// });
const model = anthropic("claude-sonnet-4-5-20250929");

// const model = anthropicProvider("anthropic/claude-haiku-4.5");

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

  buildABuyer: `You are a customer research expert specializing in buyer persona development.

Create a detailed Build-A-Buyer analysis with:
1. **Demographics** - Age, income, location, occupation
2. **Psychographics** - Values, beliefs, lifestyle, identity
3. **Pain Points** - Problems, frustrations, fears
4. **Desires** - Goals, aspirations, dream outcomes
5. **Buying Triggers** - What makes them ready to purchase
6. **Objections** - What holds them back

Use markdown formatting. Aim for 400-600 words.`,

  painCoreWound: `You are a marketing psychologist specializing in emotional drivers.

Analyze the customer's pain layers:
1. **Surface Pain** - Obvious problems they're aware of
2. **Deeper Pain** - Underlying issues they may not articulate
3. **Core Wound** - Fundamental emotional wound driving behavior
4. **Pain Amplification** - How pain compounds over time
5. **False Solutions** - What they've tried that didn't work
6. **True Resolution** - How this product addresses the core wound

Use markdown formatting. Aim for 350-500 words.`,

  competitors: `You are a competitive intelligence analyst.

Analyze the competitive landscape:
1. **Direct Competitors** - Same solution, same market
2. **Indirect Competitors** - Different solution, same pain
3. **Competitor Positioning** - How they position themselves
4. **Market Gaps** - What competitors miss
5. **Differentiation Opportunities** - How to stand out
6. **Competitive Advantages** - Unique strengths to emphasize

Use markdown formatting. Aim for 400-600 words.`,
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
 * Generate Build-A-Buyer document
 */
export const generateBuildABuyer = internalAction({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args): Promise<void> => {
    await generateDocument(
      ctx,
      args.profileId,
      "build_a_buyer",
      SYSTEM_PROMPTS.buildABuyer
    );
  },
});

/**
 * Generate Pain & Core Wound document
 */
export const generatePainCoreWound = internalAction({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args): Promise<void> => {
    await generateDocument(
      ctx,
      args.profileId,
      "pain_core_wound",
      SYSTEM_PROMPTS.painCoreWound
    );
  },
});

/**
 * Generate Competitors document
 */
export const generateCompetitors = internalAction({
  args: { profileId: v.id("onboardingProfiles") },
  handler: async (ctx, args): Promise<void> => {
    await generateDocument(
      ctx,
      args.profileId,
      "competitors",
      SYSTEM_PROMPTS.competitors
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
${profile.additionalIdeas ? `\n\nADDITIONAL IDEAS/NOTES:\n${profile.additionalIdeas}` : ""}
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

    case "build_a_buyer":
      return `${baseContext}\n\nBased on the above information, create a detailed Build-A-Buyer persona profile for the ideal customer.`;

    case "pain_core_wound":
      return `${baseContext}\n\nBased on the above information, analyze the customer's pain layers from surface problems to core emotional wounds.`;

    case "competitors":
      return `${baseContext}\n\nBased on the above information, analyze the competitive landscape and identify differentiation opportunities.`;

    default:
      return baseContext;
  }
}

/**
 * DOCUMENT ANALYSIS
 * AI-powered quality analysis using generateObject for structured output
 */

const analysisSchema = z.object({
  completeness: z.number().min(0).max(100).describe("Completeness percentage (0-100) - how thorough and complete is this document"),
  suggestions: z.array(z.string()).describe("3-5 specific, actionable improvements to enhance the document quality"),
  missingElements: z.array(z.string()).describe("Critical components or sections that are missing or insufficiently covered"),
});

const ANALYSIS_PROMPTS: Record<string, string> = {
  offer_brief: `Analyze this Offer Brief for completeness and quality. Evaluate:
- Clarity and specificity of the core promise
- Strength of unique value proposition vs competitors
- Quality and credibility of proof elements
- Strategic market positioning
- Actionability for marketing team

Provide objective assessment with specific areas for improvement.`,

  copy_blocks: `Analyze these Copy Blocks for usability and variety. Evaluate:
- Headline diversity and emotional hooks
- CTA strength and variety (5+ variations)
- Objection handling coverage
- Social proof template quality
- Immediate usability for campaigns

Provide specific suggestions for stronger copy elements.`,

  ump_ums: `Analyze the UMP/UMS mechanism for uniqueness and believability. Evaluate:
- How unique and proprietary the mechanism feels
- Believability and logical foundation
- Clear differentiation from obvious solutions
- Emotional resonance of the mechanism
- Specificity vs vague claims

Identify gaps in mechanism articulation.`,

  beat_map: `Analyze this Beat Map for completeness and persuasion flow. Evaluate:
- Coverage of all 9 beat components (hook, story, solution, credibility, mechanism, benefits, objections, urgency, CTA)
- Identification of emotional triggers at each beat
- Analysis of persuasion techniques used
- Sequence logic and flow
- Specificity of timing/positioning notes

Suggest missing beats or weak transitions.`,

  build_a_buyer: `Analyze this Build-A-Buyer persona for depth and usability. Evaluate:
- Specificity of demographics (not generic)
- Depth of psychographics (values, identity, beliefs)
- Clarity of pain points and frustrations
- Articulation of desires and aspirations
- Buying triggers and objections

Identify generic or missing persona elements.`,

  pain_core_wound: `Analyze this Pain & Core Wound analysis for psychological depth. Evaluate:
- Clear progression from surface → deeper → core wound
- Differentiation between each pain layer
- Believability and emotional resonance
- Connection between pain amplification and false solutions
- How well the product addresses the core wound (not just surface)

Point out shallow analysis or missing psychological layers.`,

  competitors: `Analyze this Competitor Analysis for strategic value. Evaluate:
- Coverage of both direct AND indirect competitors
- Quality of competitive positioning analysis
- Identification of specific market gaps
- Actionable differentiation opportunities
- Strategic advantages articulated

Suggest missing competitive angles or generic analysis.`,
};

/**
 * Analyze a single document using AI with structured output
 */
export const analyzeDocument = internalAction({
  args: {
    profileId: v.id("onboardingProfiles"),
    documentType: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      console.log(`[analyzeDocument] Starting analysis for ${args.documentType}`);

      // Update status to "analyzing"
      await ctx.runMutation(internal.onboarding.mutations.updateAnalysisStatus, {
        profileId: args.profileId,
        documentType: args.documentType,
        status: "analyzing",
      });

      // Fetch the document to analyze
      const document = await ctx.runQuery(
        internal.onboarding.queries.getDocumentByTypeInternal,
        { profileId: args.profileId, documentType: args.documentType }
      );

      if (!document || document.status !== "completed" || !document.content) {
        throw new Error("Document not ready for analysis");
      }

      const analysisPrompt = ANALYSIS_PROMPTS[args.documentType] || ANALYSIS_PROMPTS.offer_brief;

      console.log(`[analyzeDocument] Calling AI for ${args.documentType} analysis...`);

      // Use generateObject for structured analysis
      const result = await generateObject({
        model,
        schema: analysisSchema,
        prompt: `${analysisPrompt}\n\n--- DOCUMENT TO ANALYZE ---\n${document.content}\n\nProvide a thorough, objective analysis.`,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      const analysis = result.object;

      console.log(`[analyzeDocument] Analysis complete: ${analysis.completeness}% complete, ${analysis.suggestions.length} suggestions`);

      // Save the analysis
      await ctx.runMutation(internal.onboarding.mutations.saveAnalysisResults, {
        profileId: args.profileId,
        documentType: args.documentType,
        completeness: analysis.completeness,
        suggestions: analysis.suggestions,
        missingElements: analysis.missingElements,
      });

      console.log(`[analyzeDocument] ✅ ${args.documentType} analysis saved`);
    } catch (error) {
      console.error(`[analyzeDocument] ❌ Analysis failed for ${args.documentType}:`, error);

      // Save error state
      await ctx.runMutation(internal.onboarding.mutations.updateAnalysisStatus, {
        profileId: args.profileId,
        documentType: args.documentType,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      // Re-throw so workflow can handle retry
      throw error;
    }
  },
});
