// convex/ad-creation/mutations.ts
import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Create a new ad after wizard completion
 * Triggers internal action to initialize ProseMirror docs with templates
 */
export const createAd = mutation({
  args: {
    conceptId: v.id("adConcepts"),
    angleId: v.id("adAngles"),
    styleId: v.id("adStyles"),
    hookId: v.id("adHooks"),
    selectedDesireIds: v.array(v.id("targetDesires")),
    selectedBeliefIds: v.array(v.id("targetBeliefs")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch concept/angle/style/hook names to generate ad name
    const concept = await ctx.db.get(args.conceptId);
    const angle = await ctx.db.get(args.angleId);
    const style = await ctx.db.get(args.styleId);
    const hook = await ctx.db.get(args.hookId);

    if (!concept || !angle || !style || !hook) {
      throw new Error("Invalid filter selections");
    }

    // Generate ad name: "Concept - Angle - Style"
    const adName = `${concept.name} - ${angle.name} - ${style.name}`;

    // Create ad record
    const now = Date.now();
    const adId = await ctx.db.insert("createdAds", {
      organizationId,
      createdBy: userId,
      name: adName,
      conceptId: args.conceptId,
      angleId: args.angleId,
      styleId: args.styleId,
      hookId: args.hookId,
      selectedDesireIds: args.selectedDesireIds,
      selectedBeliefIds: args.selectedBeliefIds,
      pipelineStage: "to_do",
      createdAt: now,
      updatedAt: now,
    });

    console.log(`[createAd] Created ad ${adId} with name: ${adName}`);

    // Schedule internal action to initialize documents
    await ctx.scheduler.runAfter(0, internal.adCreation.actions.initializeAdDocuments, {
      adId,
      organizationId,
      userId,
    });

    return adId;
  },
});

/**
 * Update pipeline stage for an ad
 */
export const updatePipelineStage = mutation({
  args: {
    adId: v.id("createdAds"),
    newStage: v.string(),
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

    // Verify ad belongs to current organization
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.organizationId !== organizationId) {
      throw new Error("Ad not found or unauthorized");
    }

    // Update pipeline stage
    await ctx.db.patch(args.adId, {
      pipelineStage: args.newStage,
      updatedAt: Date.now(),
    });

    console.log(`[updatePipelineStage] Updated ad ${args.adId} to stage: ${args.newStage}`);

    return { success: true };
  },
});

/**
 * Delete ad and cleanup documents
 */
export const deleteAd = mutation({
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

    // Delete all documents for this ad
    const documents = await ctx.db
      .query("adDocuments")
      .withIndex("by_ad", (q) => q.eq("adId", args.adId))
      .collect();

    await Promise.all(documents.map((doc) => ctx.db.delete(doc._id)));

    // Delete the ad
    await ctx.db.delete(args.adId);

    console.log(`[deleteAd] Deleted ad ${args.adId} and ${documents.length} documents`);

    return { success: true };
  },
});

/**
 * Seed ad concepts (admin only - idempotent)
 * Deletes all existing global concepts and inserts new ones
 */
export const seedAdConcepts = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete all existing global concepts
    const existing = await ctx.db
      .query("adConcepts")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    await Promise.all(existing.map((c) => ctx.db.delete(c._id)));

    // Insert seed data
    const concepts = [
      { name: "Social Proof", description: "Testimonials, reviews, and user success stories" },
      { name: "Transformation", description: "Before/after results and life-changing outcomes" },
      { name: "Problem-Agitation-Solution", description: "Identify pain point, amplify it, offer solution" },
      { name: "Before/After", description: "Direct comparison of results with clear visual contrast" },
      { name: "Urgency/Scarcity", description: "Limited time offers and exclusive availability" },
      { name: "Authority", description: "Expert endorsements and credentials" },
      { name: "Curiosity Gap", description: "Open loop that demands closure" },
      { name: "Identity Shift", description: "Become the person who has already solved this" },
      { name: "Enemy/Villain", description: "Unite against common enemy or false solution" },
      { name: "Risk Reversal", description: "Guarantee that removes all perceived risk" },
    ];

    await Promise.all(
      concepts.map((c) =>
        ctx.db.insert("adConcepts", {
          name: c.name,
          description: c.description,
          organizationId: undefined,
        })
      )
    );

    console.log(`[seedAdConcepts] Seeded ${concepts.length} concepts`);
    return { count: concepts.length };
  },
});

/**
 * Seed ad angles (admin only - idempotent)
 */
export const seedAdAngles = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete all existing global angles
    const existing = await ctx.db
      .query("adAngles")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    await Promise.all(existing.map((a) => ctx.db.delete(a._id)));

    // Insert seed data
    const angles = [
      { name: "Direct Benefit", description: "Immediate value proposition, no fluff" },
      { name: "Pain Point", description: "Lead with the frustration or problem" },
      { name: "Aspirational", description: "Paint picture of ideal future state" },
      { name: "Contrarian", description: "Challenge conventional wisdom" },
      { name: "Story-Driven", description: "Narrative hook with relatable character" },
      { name: "Data-Driven", description: "Lead with compelling statistics or research" },
      { name: "Question-Based", description: "Start with provocative question" },
      { name: "How-To", description: "Educational angle with actionable steps" },
      { name: "Comparison", description: "Position against alternative or competitor" },
      { name: "Seasonal/Timely", description: "Tie to current event or season" },
    ];

    await Promise.all(
      angles.map((a) =>
        ctx.db.insert("adAngles", {
          name: a.name,
          description: a.description,
          organizationId: undefined,
        })
      )
    );

    console.log(`[seedAdAngles] Seeded ${angles.length} angles`);
    return { count: angles.length };
  },
});

/**
 * Seed ad styles (admin only - idempotent)
 */
export const seedAdStyles = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete all existing global styles
    const existing = await ctx.db
      .query("adStyles")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    await Promise.all(existing.map((s) => ctx.db.delete(s._id)));

    // Insert seed data
    const styles = [
      { name: "Bold & Direct", description: "No-nonsense, commanding tone" },
      { name: "Conversational", description: "Friendly, relatable, casual" },
      { name: "Professional", description: "Polished, corporate, trustworthy" },
      { name: "Playful", description: "Fun, lighthearted, witty" },
      { name: "Luxurious", description: "Premium, exclusive, aspirational" },
      { name: "Urgent", description: "Fast-paced, action-oriented, now-or-never" },
      { name: "Educational", description: "Informative, helpful, teaching-focused" },
      { name: "Empathetic", description: "Understanding, supportive, compassionate" },
      { name: "Controversial", description: "Provocative, edgy, opinion-driven" },
      { name: "Minimalist", description: "Clean, simple, let the product speak" },
    ];

    await Promise.all(
      styles.map((s) =>
        ctx.db.insert("adStyles", {
          name: s.name,
          description: s.description,
          organizationId: undefined,
        })
      )
    );

    console.log(`[seedAdStyles] Seeded ${styles.length} styles`);
    return { count: styles.length };
  },
});

/**
 * Seed ad hooks (admin only - idempotent)
 */
export const seedAdHooks = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete all existing global hooks
    const existing = await ctx.db
      .query("adHooks")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    await Promise.all(existing.map((h) => ctx.db.delete(h._id)));

    // Insert seed data
    const hooks = [
      { name: "Shocking Stat", description: "Open with surprising number or data point" },
      { name: "Bold Promise", description: "Make a clear, confident claim" },
      { name: "Relatable Scenario", description: "Start with situation audience recognizes" },
      { name: "Provocative Question", description: "Ask question that demands attention" },
      { name: "Visual First", description: "Let striking image do the talking" },
      { name: "Pattern Interrupt", description: "Break expected format to grab attention" },
      { name: "Secret Reveal", description: "Promise insider knowledge or hidden truth" },
      { name: "Testimonial Lead", description: "Start with powerful quote from customer" },
      { name: "Problem Callout", description: "Directly name the pain point" },
      { name: "Benefit Headline", description: "Lead with the outcome they want" },
    ];

    await Promise.all(
      hooks.map((h) =>
        ctx.db.insert("adHooks", {
          name: h.name,
          description: h.description,
          organizationId: undefined,
        })
      )
    );

    console.log(`[seedAdHooks] Seeded ${hooks.length} hooks`);
    return { count: hooks.length };
  },
});

/**
 * Seed document templates (admin only - idempotent)
 */
export const seedDocumentTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete all existing global templates
    const existing = await ctx.db
      .query("documentTemplates")
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    await Promise.all(existing.map((t) => ctx.db.delete(t._id)));

    // Insert seed templates
    const templates = [
      {
        templateType: "ad_details",
        templateContent: `# Ad Details

**Concept:** {{conceptName}}
**Angle:** {{angleName}}
**Style:** {{styleName}}
**Hook:** {{hookName}}

---

## Target Desires
{{desires}}

## Target Beliefs
{{beliefs}}

---

## Product Information
{{productDescription}}

## Target Buyer
{{targetBuyerDescription}}

---

**Created:** {{createdDate}}`,
      },
      {
        templateType: "ad_copy",
        templateContent: `**Headline**

[Your headline here]

**Copy**

[Your ad copy here]

**Call-to-Action**

[Your CTA here]`,
      },
      {
        templateType: "ad_asset_brief",
        templateContent: `# Asset Brief

**Format:** [Image/Video/Carousel]

**Visual Description:**
[Describe the hero image or video concept]

**Key Elements:**
- [Element 1]
- [Element 2]
- [Element 3]

**Mood/Style:** [Describe tone and aesthetic]`,
      },
      {
        templateType: "ad_notes",
        templateContent: `# Notes & Ideas

[Brainstorming space for creative directions, variations, and team notes]`,
      },
    ];

    await Promise.all(
      templates.map((t) =>
        ctx.db.insert("documentTemplates", {
          templateType: t.templateType,
          templateContent: t.templateContent,
          organizationId: undefined,
        })
      )
    );

    console.log(`[seedDocumentTemplates] Seeded ${templates.length} templates`);
    return { count: templates.length };
  },
});

/**
 * Create ad document record (internal - called by action after ProseMirror doc created)
 */
export const createAdDocumentRecord = internalMutation({
  args: {
    adId: v.id("createdAds"),
    organizationId: v.string(),
    documentType: v.string(),
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("adDocuments", {
      organizationId: args.organizationId,
      adId: args.adId,
      documentType: args.documentType,
      documentId: args.documentId,
      documentVersion: 1,
      createdAt: Date.now(),
    });

    console.log(`[createAdDocumentRecord] Created ${args.documentType} document record`);
  },
});

/**
 * Increment document version (called when AI edits document)
 */
export const incrementDocumentVersion = internalMutation({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("adDocuments")
      .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
      .first();

    if (doc) {
      await ctx.db.patch(doc._id, {
        documentVersion: doc.documentVersion + 1,
      });
      console.log(`[incrementDocumentVersion] ${args.documentId} -> v${doc.documentVersion + 1}`);
    }
  },
});

/**
 * Save ad thread mapping (internal mutation)
 */
export const saveAdThreadMapping = internalMutation({
  args: {
    adId: v.id("createdAds"),
    agentThreadId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Store in threads table with ad reference
    // Store the agentThreadId in userId field (matches playground pattern)
    await ctx.db.insert("threads", {
      userId: args.agentThreadId,
      organizationId: args.organizationId,
      title: `Ad: ${args.adId}`,
    });
    console.log(`[saveAdThreadMapping] Mapped thread ${args.agentThreadId} to ad ${args.adId}`);
  },
});
