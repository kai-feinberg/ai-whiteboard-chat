# User Ads Onboarding & Tag System

## Overview
Allow orgs to submit Facebook Ad Library URL during onboarding, scrape all their ads (active + inactive), store separately from competitor ads, and apply dynamic AI tagging for competitive intelligence and gap analysis.

---

## 1. Database Design

### Updated: `onboardingProfiles` Table
```typescript
onboardingProfiles: defineTable({
  organizationId: v.string(),
  websiteUrl: v.optional(v.string()),
  vslTranscript: v.string(),
  productDescription: v.string(),
  marketDescription: v.string(),
  targetBuyerDescription: v.string(),

  // NEW: Facebook Ad Library integration
  facebookAdLibraryUrl: v.optional(v.string()), // User's FB Ad Library page URL
  facebookPageId: v.optional(v.string()),       // Extracted page ID
  facebookPageName: v.optional(v.string()),     // Extracted page name
  adsLastScrapedAt: v.optional(v.number()),     // Last scrape timestamp
  adsScrapeStatus: v.optional(v.string()),      // "pending" | "scraping" | "completed" | "failed"
  adsScrapeError: v.optional(v.string()),       // Error message if scrape failed
  totalAdsScraped: v.optional(v.number()),      // Count of ads imported

  workflowId: v.optional(v.string()),
  completedAt: v.optional(v.number()),
  createdBy: v.string(),
})
  .index("by_organization", ["organizationId"])
```

### New: `userAds` Table
```typescript
userAds: defineTable({
  organizationId: v.string(),
  onboardingProfileId: v.id("onboardingProfiles"), // Link to profile

  // Ad identification
  platform: v.string(),           // "facebook" (expandable later)
  adId: v.string(),               // Platform's unique ad ID (archive_id)

  // Ad content
  title: v.string(),
  description: v.string(),
  link: v.optional(v.string()),

  // Media
  mediaUrls: v.array(v.string()), // External URLs initially
  thumbnailUrl: v.optional(v.string()),
  mediaStorageIds: v.optional(v.array(v.id("_storage"))), // Future: Convex storage
  thumbnailStorageId: v.optional(v.id("_storage")),

  // Metadata
  scrapedAt: v.number(),
  rawData: v.optional(v.any()),   // Full API response for debugging

  // Campaign info (from Facebook)
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
  isActive: v.optional(v.boolean()),
  displayFormat: v.optional(v.string()), // "VIDEO", "CAROUSEL", "SINGLE_IMAGE", etc.
  ctaText: v.optional(v.string()),
  publisherPlatforms: v.optional(v.array(v.string())), // ["FACEBOOK", "INSTAGRAM"]

  // Tagging
  tagIds: v.optional(v.array(v.id("adTags"))), // Reference to adTags junction table
  aiTagsGeneratedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_profile", ["onboardingProfileId"])
  .index("by_platform_and_ad_id", ["platform", "adId"]) // Deduplication
  .index("by_scraped_at", ["scrapedAt"])
```

### New: `tagDefinitions` Table
```typescript
tagDefinitions: defineTable({
  organizationId: v.string(),
  category: v.string(),           // "concept", "angle", "hook", "demographic", "emotion", "objective"
  value: v.string(),              // "problem-agitation", "millennials", "urgency", etc.
  description: v.optional(v.string()), // Help text for AI/users
  createdBy: v.string(),          // "ai" | userId
  usageCount: v.number(),         // Denormalized count for performance
  lastUsedAt: v.optional(v.number()),
})
  .index("by_organization", ["organizationId"])
  .index("by_org_and_category", ["organizationId", "category"])
  .index("by_org_category_value", ["organizationId", "category", "value"]) // Unique lookup
```

### New: `adTags` Table (Inverted Index)
```typescript
adTags: defineTable({
  adId: v.union(v.id("ads"), v.id("userAds")), // Support both competitor & user ads
  adType: v.string(),             // "user" | "competitor"
  organizationId: v.string(),
  tagDefinitionId: v.id("tagDefinitions"),

  // Denormalized for fast queries (avoid JOINs)
  category: v.string(),
  value: v.string(),

  // Metadata
  confidence: v.optional(v.number()), // AI confidence 0-1
  addedBy: v.string(),            // "ai" | userId
  addedAt: v.number(),
})
  .index("by_ad", ["adId"])
  .index("by_organization", ["organizationId"])
  .index("by_org_and_tag", ["organizationId", "tagDefinitionId"])
  .index("by_org_category_value", ["organizationId", "category", "value"]) // Fast tag filtering
  .index("by_org_adtype_category", ["organizationId", "adType", "category"]) // Gap analysis
```

### Updated: `ads` Table (Competitor Ads)
```typescript
ads: defineTable({
  // ... all existing fields unchanged ...

  // ADD tagging support
  tagIds: v.optional(v.array(v.id("adTags"))),
  aiTagsGeneratedAt: v.optional(v.number()),
})
  // ... all existing indexes unchanged ...
```

---

## 2. Data Flow

### Onboarding + Scrape Flow

1. **User submits onboarding form** with FB Ad Library URL
   - Frontend: Onboarding form with new "Facebook Ad Library URL" field
   - Backend: `submitOnboardingForm` mutation (enhanced)

2. **Workflow orchestration** (parallel execution):
   - **Track A**: Generate marketing documents (existing flow unchanged)
   - **Track B (NEW)**: Scrape user ads workflow
     - Step 1: `scrapeUserAds` action - Call ScrapeCreators API
     - Step 2: `generateUserAdTags` action (parallel) - Tag each ad with AI

3. **Scrape execution** (`scrapeUserAds` action):
   - Extract page ID from URL or hit API directly with URL
   - Call ScrapeCreators Facebook Ad Library API
   - Parse response, extract all ads (active + inactive)
   - Insert each ad into `userAds` table
   - Update `onboardingProfiles` with scrape status/counts
   - Return `{ adsScraped: number, adIds: Id<"userAds">[] }`

4. **Tag generation** (`generateUserAdTags` action - per ad):
   - Fetch ad from `userAds`
   - Fetch org's existing `tagDefinitions` (seed AI context)
   - Build AI prompt with ad content + existing tag vocabulary
   - **Use Convex Agent `generateObject`** with Zod schema (guaranteed valid JSON)
   - For each tag in response:
     - Check if `tagDefinition` exists (query `by_org_category_value` index)
     - If not exists: Insert new `tagDefinition` with `usageCount: 1`
     - If exists: Increment `usageCount` and update `lastUsedAt`
   - Insert `adTags` junction records linking ad to tag definitions
   - Update `userAds.tagIds` and `aiTagsGeneratedAt`

### Tag Generation with Convex Agent

```typescript
import { z } from "zod/v3";
import { AgentManager } from "@convex-dev/agent";

// Zod schema for tag generation
const TagSchema = z.object({
  category: z.enum(["concept", "angle", "hook", "demographic", "emotion", "objective"]),
  value: z.string().describe("Lowercase, hyphenated tag value (e.g., 'problem-agitation-solution')"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
});

const TagResponseSchema = z.object({
  tags: z.array(TagSchema).describe("2-4 tags per category, only include if confidence >0.6"),
  reasoning: z.string().optional().describe("Brief explanation of tag choices"),
});

// System prompt for tagging
const TAGGING_SYSTEM_PROMPT = `You are an expert ad analyst specializing in direct response marketing and competitive intelligence.

Analyze the provided ad and categorize it using these dimensions:

**CONCEPT** - The core marketing concept/framework:
Examples: problem-agitation-solution, transformation-story, before-after, social-proof-heavy, education-based, scarcity-driven

**ANGLE** - The specific positioning angle:
Examples: cost-savings, time-savings, status-prestige, fear-of-missing-out, contrarian, beginner-friendly, advanced-expert

**HOOK** - The attention-grabbing mechanism:
Examples: question-hook, shocking-stat, bold-claim, story-opening, relatable-pain-point, curiosity-gap

**DEMOGRAPHIC** - Target audience signals:
Examples: millennials, gen-z, small-business-owners, enterprise, parents, students, remote-workers, developers

**EMOTION** - Primary emotional trigger:
Examples: urgency, fear, excitement, trust, curiosity, inspiration, humor, aspirational

**OBJECTIVE** - Apparent campaign goal:
Examples: lead-generation, direct-purchase, brand-awareness, retargeting, event-registration, content-download

Rules:
- Use lowercase, hyphenated format
- Include 2-4 tags per category (prioritize by confidence)
- Only include tags with confidence >0.6
- Create new tag values if existing ones don't fit well
- Be specific and actionable`;

// Generate tags for an ad using Convex Agent
export const generateUserAdTags = internalAction({
  args: { adId: v.id("userAds") },
  handler: async (ctx, args) => {
    // Fetch ad
    const ad = await ctx.runQuery(internal.userAds.queries.getById, { adId: args.adId });
    if (!ad) throw new Error("Ad not found");

    // Fetch existing tags for context
    const existingTags = await ctx.runQuery(
      internal.tags.queries.getTagDefinitions,
      { organizationId: ad.organizationId }
    );

    // Build user prompt
    const userPrompt = `
EXISTING TAG VOCABULARY (prefer these if applicable):
${JSON.stringify(existingTags.reduce((acc, t) => {
  if (!acc[t.category]) acc[t.category] = [];
  acc[t.category].push(t.value);
  return acc;
}, {} as Record<string, string[]>), null, 2)}

AD TO ANALYZE:
Title: ${ad.title}
Description: ${ad.description}
CTA: ${ad.ctaText || "None"}
Format: ${ad.displayFormat || "Unknown"}
Platforms: ${ad.publisherPlatforms?.join(", ") || "Unknown"}
Active: ${ad.isActive ? "Yes" : "No"}

Analyze this ad and generate tags.`;

    // Use Convex Agent to generate structured tags
    const agent = new AgentManager(components.agent);
    const thread = await agent.createThread(ctx);

    const result = await thread.generateObject({
      prompt: userPrompt,
      system: TAGGING_SYSTEM_PROMPT,
      schema: TagResponseSchema,
    });

    // Process tags and create/update tag definitions
    await ctx.runMutation(internal.tags.mutations.processTags, {
      adId: args.adId,
      adType: "user",
      organizationId: ad.organizationId,
      tags: result.tags,
    });

    return { success: true, tagsGenerated: result.tags.length };
  },
});

// Mutation to process and persist tags
export const processTags = internalMutation({
  args: {
    adId: v.union(v.id("ads"), v.id("userAds")),
    adType: v.string(), // "user" | "competitor"
    organizationId: v.string(),
    tags: v.array(v.object({
      category: v.string(),
      value: v.string(),
      confidence: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const tagDefinitionIds: Id<"tagDefinitions">[] = [];
    const adTagIds: Id<"adTags">[] = [];

    for (const tag of args.tags) {
      // Check if tag definition already exists
      const existingDef = await ctx.db
        .query("tagDefinitions")
        .withIndex("by_org_category_value", q =>
          q.eq("organizationId", args.organizationId)
           .eq("category", tag.category)
           .eq("value", tag.value)
        )
        .first();

      let tagDefId: Id<"tagDefinitions">;

      if (existingDef) {
        // Update existing definition
        await ctx.db.patch(existingDef._id, {
          usageCount: existingDef.usageCount + 1,
          lastUsedAt: Date.now(),
        });
        tagDefId = existingDef._id;
      } else {
        // Create new tag definition
        tagDefId = await ctx.db.insert("tagDefinitions", {
          organizationId: args.organizationId,
          category: tag.category,
          value: tag.value,
          description: undefined,
          createdBy: "ai",
          usageCount: 1,
          lastUsedAt: Date.now(),
        });
      }

      tagDefinitionIds.push(tagDefId);

      // Create adTags junction record
      const adTagId = await ctx.db.insert("adTags", {
        adId: args.adId,
        adType: args.adType,
        organizationId: args.organizationId,
        tagDefinitionId: tagDefId,
        category: tag.category,
        value: tag.value,
        confidence: tag.confidence,
        addedBy: "ai",
        addedAt: Date.now(),
      });

      adTagIds.push(adTagId);
    }

    // Update ad with tag references
    await ctx.db.patch(args.adId, {
      tagIds: adTagIds,
      aiTagsGeneratedAt: Date.now(),
    });

    return { success: true, tagDefinitionIds };
  },
});
```

---

## 3. User Flows

### Onboarding Flow (Enhanced)

1. Navigate to `/onboarding`
2. Fill existing form fields (VSL, product, market, buyer)
3. **NEW**: Paste Facebook Ad Library URL in new field
   - Placeholder: "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&view_all_page_id=YOUR_PAGE_ID"
   - Optional field (can skip if no FB ads yet)
4. Submit form
5. See dual progress indicators:
   - **Marketing Documents**: 4 documents generating (existing)
   - **Your Ads**: "Scraping ads... 0/?" → "15 ads imported, generating tags..." → "✓ Complete"
6. Navigate to new "Your Ads" section

### Your Ads Dashboard Flow

1. Navigate to `/your-ads` (new route)
2. See gallery/table of imported ads with tags
3. Click tag badges to filter ads by that tag
4. See tag distribution sidebar:
   - **Concepts You Use**: problem-agitation-solution (8), transformation-story (5)
   - **Hooks You Use**: shocking-stat (6), question-hook (4)
   - **Demographics You Target**: small-business (10), enterprise (3)
5. Click "Analyze Gaps" button
6. See comparison view:
   - **What You Do**: Top concepts/angles/hooks
   - **What Competitors Do**: Top concepts/angles/hooks
   - **Unexplored Opportunities**: Tags competitors use heavily but you don't

---

## 4. UI Components

### `AdLibraryUrlInput` (new)
- **Purpose**: Input field for FB Ad Library URL on onboarding form
- **Location**: `/onboarding` page, after VSL transcript field
- **Interactions**: Paste URL, validate format, show helper text
- **Validation**: Optional field, must be valid FB URL if provided

### `AdScrapeProgress` (new)
- **Purpose**: Real-time progress indicator during ad scraping
- **Location**: Onboarding page, below form after submission
- **Displays**:
  - Status: "Scraping ads...", "Generating tags...", "Complete"
  - Count: "15 ads imported"
  - Errors: Show error message if scrape fails
- **Data**: Polls `onboardingProfiles.adsScrapeStatus` + `totalAdsScraped`

### `YourAdsGallery` (new route/feature)
- **Purpose**: Display user's own ads separate from competitors
- **Location**: New route `/your-ads` or tab in dashboard
- **Displays**:
  - Grid/table of user ads
  - Tag badges on each ad (clickable to filter)
  - Filter sidebar by tag category
  - Sort by date, performance (future), tags
- **Data**: Query `getUserAds` with filters

### `TagBadge` (reusable component)
- **Purpose**: Render individual tag with color coding by category
- **Props**: `{ category, value, clickable, onRemove }`
- **Styling**: Category-specific colors (concept=blue, hook=green, etc.)
- **Interactions**: Click to filter, hover for description

### `TagDistributionPanel` (new)
- **Purpose**: Show breakdown of tags used by user vs competitors
- **Location**: Sidebar on Your Ads page
- **Displays**:
  - Grouped by category (Concepts, Hooks, Demographics, etc.)
  - Usage counts per tag
  - Visual indicator: user-only, competitor-only, both
- **Data**: Query `getTagDistribution`

### `GapAnalysisDashboard` (new)
- **Purpose**: Strategic intelligence - what competitors do that user doesn't
- **Location**: New route `/strategy-gaps` or modal
- **Displays**:
  - **Unexplored Concepts**: Tags competitors use heavily but user doesn't
  - **Unexplored Angles**: Similar analysis for angles
  - **Unexplored Demographics**: Untapped audience segments
  - Ranked by competitor usage frequency
- **Data**: Query `analyzeTagGaps`

---

## 5. Convex Functions

### Mutations

**`submitOnboardingForm` (enhanced)**
- Input: All existing fields + `facebookAdLibraryUrl?: string`
- Updates `onboardingProfiles` with new FB Ad Library fields
- Starts dual workflows: documents + ads scraping
- Output: `{ profileId, documentWorkflowId, adsWorkflowId? }`

**`processTags` (internal mutation)**
- Input: `{ adId, adType, organizationId, tags: Array<{ category, value, confidence }> }`
- For each tag:
  - Query `tagDefinitions` by `by_org_category_value` index
  - If tag definition doesn't exist: Insert new with `{ organizationId, category, value, usageCount: 1, createdBy: "ai" }`
  - If tag definition exists: Increment `usageCount`, update `lastUsedAt`
  - Insert `adTags` junction record with `{ adId, adType, organizationId, tagDefinitionId, category, value, confidence, addedBy: "ai" }`
  - Collect all `adTags` IDs
- Update ad's `tagIds` array with new junction record IDs
- Update ad's `aiTagsGeneratedAt` timestamp
- Return `{ success: true, tagDefinitionIds: Id<"tagDefinitions">[] }`

### Actions

**`scrapeUserAds`**
- Input: `{ profileId: Id<"onboardingProfiles"> }`
- Fetches profile to get FB Ad Library URL
- Calls ScrapeCreators API
- Parses all ads from response
- Inserts into `userAds` table (dedupe by `platform + adId`)
- Updates profile scrape status
- Returns `{ success: boolean, adsScraped: number, adIds: Id<"userAds">[] }`

**`generateUserAdTags`**
- Input: `{ adId: Id<"userAds"> }`
- Fetches ad and org's existing tag definitions
- Builds AI prompt with ad content + tag vocabulary
- Calls OpenRouter Claude Haiku
- Parses structured JSON response
- Calls `updateAdTags` mutation
- Handles retries on failure
- Returns `{ success: boolean, tagsGenerated: number }`

### Queries

**`getUserAds`**
- Input: `{ filters?: { categories: Record<string, string[]> } }`
- Returns user's ads with tag filtering
- Joins with `adTags` to include tag data
- Generates media URLs from storage IDs
- Supports pagination (future)

**`getTagDefinitions`**
- Input: `{ category?: string }`
- Returns all tag definitions for org
- Optionally filtered by category
- Sorted by `usageCount` descending

**`getTagDistribution`**
- Input: None (uses org from auth)
- Returns tag usage comparison:
  ```typescript
  {
    category: string,
    value: string,
    userCount: number,      // How many user ads have this tag
    competitorCount: number // How many competitor ads have this tag
  }[]
  ```

**`analyzeTagGaps`**
- Input: None (uses org from auth)
- Returns strategic gaps:
  ```typescript
  {
    unexploredConcepts: Array<{ value, competitorUsageCount }>,
    unexploredAngles: Array<{ value, competitorUsageCount }>,
    unexploredHooks: Array<{ value, competitorUsageCount }>,
    unexploredDemographics: Array<{ value, competitorUsageCount }>,
  }
  ```

**`getAdTags`**
- Input: `{ adId: union(Id<"ads">, Id<"userAds">) }`
- Returns tags for specific ad grouped by category

---

## 6. Patterns to Reuse

### Workflow Pattern
- Extend `convex/onboarding/workflow.ts`
- Add parallel track for ad scraping alongside document generation
- Use same retry/error handling patterns

### AI Generation Pattern
- Reuse OpenRouter + Claude Haiku setup from `onboarding/actions.ts`
- Same structured prompting approach
- Same error handling and status updates

### Auth & Organization Scoping
- Always verify `organizationId` from identity
- All queries use `by_organization` index
- Tag data is org-scoped (no cross-org leakage)

### Media Storage Pattern
- Initially: Store external URLs only (fast MVP)
- Phase 2: Download and store in Convex storage
- Reuse pattern from existing `ads` table media handling

---

## 7. Implementation Steps

### Phase 1: Core Scraping (Day 1)
- [ ] Add FB Ad Library field to `onboardingProfiles` schema
- [ ] Create `userAds` table schema
- [ ] Add `scrapeUserAds` action (ScrapeCreators API integration)
- [ ] Update onboarding form UI with URL input
- [ ] Add progress indicator component
- [ ] Test end-to-end scraping flow

### Phase 2: Tag System Foundation (Day 2)
- [ ] Create `tagDefinitions` and `adTags` tables
- [ ] Add `generateUserAdTags` action with AI prompt
- [ ] Implement `updateAdTags` mutation
- [ ] Add tag workflow step to onboarding
- [ ] Build `TagBadge` component
- [ ] Display tags on user ads

### Phase 3: Tag Filtering & Display (Day 3)
- [ ] Create `/your-ads` route
- [ ] Build `YourAdsGallery` component
- [ ] Implement `getUserAds` query with filtering
- [ ] Add `TagDistributionPanel` sidebar
- [ ] Implement `getTagDistribution` query
- [ ] Add tag-based filtering UI

### Phase 4: Gap Analysis (Day 4)
- [ ] Tag existing competitor ads with same system
- [ ] Implement `analyzeTagGaps` query
- [ ] Build `GapAnalysisDashboard` component
- [ ] Add insights/recommendations UI
- [ ] Test with real org + competitor data

---

## 8. API Integration Details

### ScrapeCreators Facebook Ad Library API

**Endpoint**: `GET https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads`

**Headers**:
```typescript
{
  "x-api-key": process.env.SCRAPE_CREATORS_API_KEY
}
```

**Query Params**:
```typescript
{
  query?: string,           // Search term (optional if using page_id)
  page_id?: string,         // Facebook page ID
  active_status?: "all" | "active" | "inactive",
  trim?: boolean,           // Reduce response size
  limit?: number,           // Results per page (default 50)
  cursor?: string,          // Pagination cursor
}
```

**Response Shape**:
```typescript
{
  searchResults: Array<{
    ad_archive_id: string,
    page_id: string,
    page_name: string,
    snapshot: {
      title?: string,
      body?: { text: string },
      link_url?: string,
      cta_text?: string,
      images?: Array<{
        resized_image_url: string,
        original_image_url: string,
      }>,
      videos?: Array<{
        video_hd_url: string,
        video_sd_url: string,
      }>,
      cards?: Array<{
        title?: string,
        body?: string,
        link_url?: string,
      }>,
    },
    start_date: string,       // ISO date
    end_date?: string,        // ISO date or null if active
    ad_delivery_start_time: string,
    ad_delivery_stop_time?: string,
    publisher_platforms: string[], // ["facebook", "instagram"]
    estimated_audience_size?: {
      lower_bound: number,
      upper_bound: number,
    },
  }>,
  cursor?: string,            // For pagination
}
```

**Error Handling**:
- 401: Invalid API key
- 404: Page not found
- 429: Rate limit exceeded (implement exponential backoff)
- 500: API error (retry with backoff)

---

## 9. MVP Simplifications

**What to build now:**
- Single FB Ad Library URL per org (in onboarding profile)
- Scrape on onboarding submission only (no re-scraping yet)
- Store external media URLs (no download/storage)
- AI tags only (no manual tag editing)
- Basic gap analysis (simple counts)

**What to defer:**
- Multiple ad accounts per org
- Scheduled re-scraping
- Media download to Convex storage
- Manual tag editing/merging
- Advanced analytics (trend analysis, performance correlation)
- Tag confidence refinement
- Export/reporting features
- Multi-platform support (Google, LinkedIn, etc.)

**B2B tolerance:**
- Tags may not be perfect initially (iterate prompt based on feedback)
- Gap analysis is basic (just counts, no ML-based recommendations yet)
- No tag suggestions/autocomplete in filters
- Single scrape per onboarding (manual re-trigger if needed)

---

## 10. Testing Strategy

### Manual Testing Checklist

**Scraping Flow:**
- [ ] Submit onboarding with valid FB Ad Library URL
- [ ] Verify ads appear in `userAds` table
- [ ] Check `onboardingProfiles.totalAdsScraped` updated
- [ ] Test with URL for page with 0 ads (handle gracefully)
- [ ] Test with invalid URL (show error)
- [ ] Test with page that has >50 ads (pagination)

**Tagging Flow:**
- [ ] Verify tags generated for each ad
- [ ] Check `tagDefinitions` populated with org-specific tags
- [ ] Verify `adTags` junction records created
- [ ] Test tag confidence scores stored correctly
- [ ] Verify `usageCount` increments properly

**UI Testing:**
- [ ] Display tags on ad cards with category colors
- [ ] Click tag to filter ads
- [ ] Multi-select tag filtering works (AND logic)
- [ ] Tag distribution panel shows correct counts
- [ ] Gap analysis shows competitor tags user doesn't have

**Edge Cases:**
- [ ] Ad with no description (use title only for tagging)
- [ ] Ad with video only (no images)
- [ ] Very long ad content (>10k chars) - truncate for AI
- [ ] Tag value with special characters (sanitize)
- [ ] Org with 100+ user ads (query performance)
- [ ] Re-scraping same page (dedupe by adId)

---

## 11. Success Metrics

**MVP Success Criteria:**
- User can scrape their FB ads during onboarding (<30s)
- Tags generated for all ads within 60s
- Gap analysis identifies 5+ unexplored strategies
- Filter by tags returns results in <2s
- System handles 100+ ads per org without slowdown

**Future Enhancements:**
- Tag confidence scores improve over time with feedback
- AI learns org-specific tag vocabulary
- Trend detection: "Competitors shifting to video format"
- Performance correlation: "Your video ads outperform carousel"
- Automated recommendations: "Try problem-agitation-solution concept"
