# Target Desires & Beliefs System - Implementation Plan

## 1. Database Design

### New Tables
**targetDesires**
- `organizationId: v.string()` - Org ownership
- `profileId: v.id("onboardingProfiles")` - Links to profile
- `text: v.string()` - Desire text (e.g., "Feel respected by peers")
- `category: v.optional(v.string())` - Optional AI-generated grouping
- Indexes: `by_profile`, `by_organization`

**targetBeliefs**
- Identical structure to targetDesires
- Indexes: `by_profile`, `by_organization`

### Queries

**getTargetDesires**
- Input: `profileId`
- Output: Array of desires (insertion order)
- Purpose: Load desires for display/selection
- Auth: Verify org ownership of profile

**getTargetBeliefs**
- Input: `profileId`
- Output: Array of beliefs (insertion order)
- Purpose: Load beliefs for display/selection
- Auth: Verify org ownership of profile

### Mutations

**upsertTargetDesires** (internal)
- Input: `profileId`, `organizationId`, `items[]` (text + category)
- Purpose: Batch replace after AI generation (delete all existing + insert new)

**upsertTargetBeliefs** (internal)
- Input: `profileId`, `organizationId`, `items[]` (text + category)
- Purpose: Batch replace after AI generation (delete all existing + insert new)

### Actions

**generateTargetDesires**
- Input: `profileId`
- Purpose: AI generates 10-15 desires using `generateObject` with zod schema
- Context: Uses profile data + completed documents (build_a_buyer, pain_core_wound, offer_brief)
- Pattern: Fetch profile + documents → generateObject → upsertTargetDesires mutation
- Schema: `z.object({ items: z.array(z.object({ text, category })) })`

**generateTargetBeliefs**
- Input: `profileId`
- Purpose: AI generates 10-15 beliefs using `generateObject` with zod schema
- Context: Uses profile data + completed documents (build_a_buyer, pain_core_wound, offer_brief)
- Pattern: Fetch profile + documents → generateObject → upsertTargetBeliefs mutation
- Schema: `z.object({ items: z.array(z.object({ text, category })) })`

## 2. Data Flow

1. User submits onboarding form → profile created
2. Workflow triggers 7 document generations in parallel
3. **WAIT** for all 7 documents to complete (success or failure)
4. Workflow then triggers 2 list generations in parallel
5. Each list generation action:
   - Fetches profile data
   - Fetches completed documents (build_a_buyer, pain_core_wound, offer_brief)
   - Builds enriched context with document content
   - Calls AI with `generateObject`
   - Receives structured array: `[{ text, category }]`
   - Calls upsert mutation (delete old + insert new)
6. UI reactively updates as items are inserted
7. User views generated items on onboarding page
8. Future: User selects items in ad creation flow (React state only)

## 3. User Flows

### Onboarding Form Submission
- Fill form → click "Generate Documents"
- See 7 documents generating in real-time (parallel)
- Once documents complete, see 2 item lists start generating
- Lists appear when complete (10-15 items each)
- Items display in generated order with category labels

### Future: Selecting Items for Ad Creation
- Navigate to ad creation flow
- See separate sections: "Target Desires" and "Target Beliefs"
- Check relevant items for this ad (local state)
- Submit ad → selected items sent to backend

## 4. UI Components

**Desires and Beliefs Displays** (onboarding page, read-only)
- Purpose: Show generated desires/beliefs after onboarding
- Data: `getTargetDesires` + `getTargetBeliefs` queries
- Display: Two card sections with bullet lists, optional category badges
- Location: Below document cards on onboarding page

**Future: TargetDesiresSelector** (ad creation)
- Purpose: Checkbox list for selecting desires
- Data: `getTargetDesires` query, local useState for selections

**Future: TargetBeliefsSelector** (ad creation)
- Purpose: Checkbox list for selecting beliefs
- Data: `getTargetBeliefs` query, local useState for selections

## 5. Patterns to Reuse

### AI Generation with generateObject + Document Context
```typescript
// Fetch profile
const profile = await ctx.runQuery(internal.onboarding.queries.getProfileById, { profileId });

// Fetch completed documents for enriched context
const documents = await ctx.runQuery(internal.onboarding.queries.getGeneratedDocumentsByProfile, { profileId });
const buildABuyer = documents.find(d => d.documentType === "build_a_buyer");
const painCoreWound = documents.find(d => d.documentType === "pain_core_wound");
const offerBrief = documents.find(d => d.documentType === "offer_brief");

// Build enriched context
const enrichedContext = `
PROFILE DATA:
${buildProfileContext(profile)}

${buildABuyer?.content ? `\nBUILD-A-BUYER DOCUMENT:\n${buildABuyer.content}` : ""}
${painCoreWound?.content ? `\nPAIN & CORE WOUND ANALYSIS:\n${painCoreWound.content}` : ""}
${offerBrief?.content ? `\nOFFER BRIEF:\n${offerBrief.content}` : ""}
`;

const result = await generateObject({
  model,
  schema: itemsSchema,
  prompt: systemPrompt + enrichedContext,
  temperature: 0.7,
});

await ctx.runMutation(internal.onboarding.mutations.upsertTargetDesires, {
  profileId,
  organizationId: profile.organizationId,
  items: result.object.items,
});
```

### Auth & Org Scoping
- Copy from `getOnboardingProfile` and `getGeneratedDocuments`
- Get identity → verify organizationId exists
- Fetch profile → verify profile.organizationId matches identity.organizationId

### Batch Replace Pattern
```typescript
// Delete all existing
const existing = await ctx.db.query("targetDesires")
  .withIndex("by_profile", q => q.eq("profileId", profileId))
  .collect();
await Promise.all(existing.map(item => ctx.db.delete(item._id)));

// Insert new batch
await Promise.all(items.map(item => ctx.db.insert("targetDesires", {
  organizationId,
  profileId,
  text: item.text,
  category: item.category,
})));
```

### Workflow Sequential Execution (in workflow.ts)
```typescript
// Step 2: Generate 7 documents in parallel (existing)
await Promise.all([
  step.runAction(...generateOfferBrief),
  step.runAction(...generateCopyBlocks),
  // ... 5 more
]);

// Step 3: Generate desires/beliefs AFTER documents complete
await Promise.all([
  step.runAction(internal.onboarding.actions.generateTargetDesires,
    { profileId: args.onboardingProfileId },
    { name: "generate-target-desires", retry: true }
  ),
  step.runAction(internal.onboarding.actions.generateTargetBeliefs,
    { profileId: args.onboardingProfileId },
    { name: "generate-target-beliefs", retry: true }
  ),
]);
```

## Implementation Steps

### Phase 1 (MVP - 2 hours)
1. Schema: Add targetDesires + targetBeliefs tables
2. Queries: Create getTargetDesires + getTargetBeliefs + helper to fetch documents by profile
3. Mutations: Create upsertTargetDesires + upsertTargetBeliefs (internal)
4. Actions: Create generateTargetDesires + generateTargetBeliefs with:
   - Document fetching logic
   - Enriched context building
   - zod schemas for structured output
5. Workflow: Add Step 3 with 2 new actions (sequential after Step 2)
6. UI: Add TargetItemsDisplay component to onboarding page

### Phase 2 (Future - Ad Creation Integration)
1. Add selector components to ad creation flow
2. Store selected items in React state
3. Pass selections to ad creation mutation

## AI Prompts & Schemas

### Target Desires

**Schema:**
```typescript
z.object({
  items: z.array(
    z.object({
      text: z.string().describe("Single desire statement (5-15 words)"),
      category: z.enum(["status", "security", "achievement", "belonging", "freedom", "growth"])
        .describe("Primary psychological category"),
    })
  ).min(10).max(15).describe("Generate 10-15 desires"),
});
```

**Prompt:**
```
You are a marketing psychologist analyzing target customer desires.

Based on the product information, buyer persona analysis, and pain/wound insights, generate 10-15 core desires the target customer wants to fulfill.

Focus on:
- Emotional outcomes and identity-level aspirations
- What they want to BECOME or FEEL
- Deep psychological drivers revealed in the pain analysis
- Aspirational states mentioned in the buyer persona

Categorize each as: status, security, achievement, belonging, freedom, or growth.

Examples:
- "Feel respected by peers" (status)
- "Achieve financial independence" (security)
- "Reclaim lost time for what matters" (freedom)
- "Master my chaotic schedule" (achievement)

Use the documents below for deep context about the customer psyche.
```

### Target Beliefs

**Schema:**
```typescript
z.object({
  items: z.array(
    z.object({
      text: z.string().describe("Single belief statement (5-15 words)"),
      category: z.enum(["self_identity", "worldview", "solutions", "obstacles", "values"])
        .describe("Primary belief category"),
    })
  ).min(10).max(15).describe("Generate 10-15 beliefs"),
});
```

**Prompt:**
```
You are a marketing psychologist analyzing target customer beliefs.

Based on the product information, buyer persona analysis, and pain/wound insights, generate 10-15 beliefs the target customer holds.

Focus on:
- Self-perception and identity (how they see themselves)
- Views about the world/market revealed in the documents
- Beliefs about solutions and what works/doesn't work
- Core values and principles they hold
- Limiting beliefs and obstacles they perceive

Categorize each as: self_identity, worldview, solutions, obstacles, or values.

Examples:
- "I'm too busy for manual task management" (self_identity)
- "Quality tools justify premium pricing" (values)
- "Traditional productivity apps always fail me" (solutions)
- "Automation is the only scalable solution" (worldview)
- "I lack the discipline for complex systems" (obstacles)

Use the documents below for deep context about the customer psyche.
```

## Key Benefits of Sequential Execution

1. **Richer Context** - Desires/beliefs generated from detailed buyer analysis, not just raw profile
2. **Better Quality** - AI has full psychological profile from pain_core_wound document
3. **Consistency** - Desires/beliefs align with messaging in other documents
4. **No Redundancy** - Avoids duplicating insights already captured in documents
