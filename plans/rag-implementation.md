# RAG Implementation for Ad Intelligence Search

## 1. Database Design

### Adjusted Tables

**ads table** - Add AI analysis fields:
- `aiTags: v.optional(v.array(v.string()))` - AI-generated categorical tags
- `videoTranscript: v.optional(v.string())` - Full transcript from video content
- `imageDescription: v.optional(v.string())` - AI-generated description of images
- `ragEntryId: v.optional(v.string())` - RAG namespace entry ID
- `ragIndexedAt: v.optional(v.number())` - Timestamp of RAG indexing
- `aiAnalysisCompleted: v.optional(v.boolean())` - Flag for completed analysis

### New Indexes
- `by_ai_tags` on ads table - Convex supports array field indexing for fast tag filtering

### Queries

**analyzeAndIndexAd (action)**
- Input: `{ adId: Id<"ads"> }`
- Output: `{ tags: string[], transcript?: string, imageDesc?: string, ragEntryId: string }`
- Purpose: Generate transcripts, image descriptions, tags, and index in RAG

**searchSemantic (action)**
- Input: `{ query: string, filters?: { tags?, platform?, pageId? }, limit?: number }`
- Output: `{ results: Ad[], scores: number[] }`
- Purpose: Vector search through RAG with metadata filters

**searchByTags (query)**
- Input: `{ tags: string[], userId: Id<"users"> }`
- Output: `Ad[]`
- Purpose: Fast inverted index lookup by tags (OR operation)

**getAvailableTags (query)**
- Input: `{ userId: Id<"users"> }`
- Output: `{ tag: string, count: number }[]`
- Purpose: Aggregate all unique tags for filter UI

## 2. Data Flow

### AI Analysis & Indexing Flow
1. Ad scraped → stored with media in Convex storage (already implemented)
2. Schedule `analyzeAndIndexAd` action immediately via `ctx.scheduler.runAfter(0, ...)`
3. Action processes ad:
   - **For videos**: Extract video URL → call Whisper API → get transcript
   - **For images**: Extract image URLs → call GPT-4 Vision API → get descriptions
   - **Generate tags**: Combine title + description + transcript + image descriptions → prompt GPT-4o-mini → get 5-8 tags
4. Build searchable content string:
   ```
   Title: {ad.title}
   Description: {ad.description}
   Transcript: {videoTranscript}
   Visual Content: {imageDescription}
   Tags: {aiTags.join(", ")}
   ```
5. Add to RAG:
   - Namespace: `ads-${userId}`
   - Key: `ad-${adId}` (for deduplication/updates)
   - Text: Combined content string
   - FilterValues:
     - `tags` (one filter per tag for OR search)
     - `platform` (facebook, google, etc.)
     - `pageId` (advertiser identifier)
6. Update ad record with analysis results

### Search Flow (Semantic)
1. User types natural language: "carousel ads about AI tools with product demos"
2. Frontend calls `searchSemantic` action
3. RAG performs vector search:
   - Query embedding generated from user input
   - Filters applied (tags, platform, advertiser)
   - Results ranked by cosine similarity
4. Extract ad IDs from RAG results
5. Query full ad records with advertiser data
6. Return sorted results with relevance scores

### Search Flow (Tag-Based)
1. User selects tags: ["saas", "video", "b2b"]
2. Frontend calls `searchByTags` query
3. Use `by_ai_tags` index for fast lookup (OR operation)
4. Filter by userId for ownership
5. Return matching ads

## 3. User Flows

### Admin/User Flow - Automatic Analysis
- Scrape ads via subscription
- See "Analyzing..." badge on new ads
- After 10-30s (depending on media), tags/analysis complete
- No manual intervention needed

### User Flow - Semantic Search
- Navigate to `/search` page
- Type: "video ads for productivity tools targeting developers"
- Apply optional filters: tags, platform, advertiser
- See results ranked by relevance with scores
- Click to view full ad details

### User Flow - Tag Filtering
- View ads at `/ads` dashboard
- See tag cloud in sidebar (all tags + counts)
- Click tags to filter (multi-select, OR logic)
- Results update in real-time
- Clear filters to reset

## 4. UI Components

### AdTagBadges (new)
- **Purpose**: Display AI tags as clickable pills
- **Location**: Ad cards, ad detail page
- **Key interactions**: Click tag → filter by that tag
- **Data**: `ad.aiTags`

### AnalysisIndicator (new)
- **Purpose**: Show analysis status (analyzing, completed, failed)
- **Location**: Ad card corner badge
- **Key interactions**: None (visual indicator only)
- **Data**: `ad.aiAnalysisCompleted`, `ad.ragIndexedAt`

### SemanticSearchBar (new)
- **Purpose**: Natural language search input
- **Location**: `/search` page header
- **Key interactions**: Text input, submit, clear, loading state
- **Data**: None (just input)

### TagFilterPanel (new)
- **Purpose**: Multi-select tag filter with counts
- **Location**: Sidebar on `/ads` and `/search`
- **Key interactions**: Checkbox multi-select, clear all
- **Data**: `getAvailableTags` query result

### SearchResultCard (new)
- **Purpose**: Ad card with relevance score
- **Location**: `/search` results list
- **Key interactions**: Click to view full ad
- **Data**: Ad + relevance score (0-1)

### TranscriptView (new)
- **Purpose**: Display video transcript with timestamps
- **Location**: Ad detail page, expandable section
- **Key interactions**: Expand/collapse, search within transcript
- **Data**: `ad.videoTranscript`

### ImageDescriptionView (new)
- **Purpose**: Show AI-generated image descriptions
- **Location**: Ad detail page, overlay on image gallery
- **Key interactions**: Hover on image to see description
- **Data**: `ad.imageDescription`

## 5. API Routes (Convex Functions)

### Actions (External AI/RAG calls)

**analyzeAndIndexAd** - `convex/ads/analysis.ts`
- Purpose: Full AI analysis pipeline + RAG indexing
- Input: `{ adId: Id<"ads"> }`
- Output: `{ success: boolean, tags: string[], transcript?: string }`
- Flow: Get ad → transcribe videos → describe images → generate tags → index in RAG → update ad

**transcribeVideo** (internal action) - `convex/ads/analysis.ts`
- Purpose: Extract audio transcript from video
- Input: `{ videoUrl: string }`
- Output: `{ transcript: string }`
- API: OpenAI Whisper API

**describeImages** (internal action) - `convex/ads/analysis.ts`
- Purpose: Generate descriptions for all images
- Input: `{ imageUrls: string[] }`
- Output: `{ description: string }`
- API: OpenAI GPT-4 Vision API

**generateTags** (internal action) - `convex/ads/analysis.ts`
- Purpose: Create categorical tags from all content
- Input: `{ title, description, transcript, imageDesc }`
- Output: `{ tags: string[] }`
- API: OpenAI GPT-4o-mini

**searchSemantic** - `convex/ads/search.ts`
- Purpose: Vector search through RAG
- Input: `{ query: string, filters?: {...}, limit?: number }`
- Output: `{ results: Ad[], scores: number[] }`
- Flow: RAG search → get ad IDs → query ads → join advertisers → return with scores

### Queries (Database reads)

**searchByTags** - `convex/ads/search.ts`
- Purpose: Fast tag-based filtering
- Input: `{ tags: string[], userId: Id<"users"> }`
- Output: `Ad[]`
- Flow: Query by_ai_tags index → filter userId → join advertisers

**getAvailableTags** - `convex/ads/search.ts`
- Purpose: Aggregate unique tags with counts
- Input: `{ userId: Id<"users"> }`
- Output: `{ tag: string, count: number }[]`
- Flow: Get all user ads → extract all tags → count occurrences → sort by count

**getById** (existing, update to include new fields)
- Add: Return `videoTranscript`, `imageDescription`, `aiTags`

### Mutations (Database writes)

**updateAdAnalysis** (internal) - `convex/ads/analysis.ts`
- Purpose: Save AI analysis results to ad record
- Input: `{ adId, aiTags, videoTranscript, imageDescription, ragEntryId, ragIndexedAt }`
- Output: `void`
- Validation: Check userId ownership via getAuthUserId

## 6. Patterns to Reuse

### Auth Pattern (from existing code)
```typescript
import { getAuthUserId } from "@convex-dev/auth/server";

const userId = await getAuthUserId(ctx);
if (userId === null) {
  throw new Error("Not authenticated");
}
```

### Action → Internal Mutation Pattern (from scraping)
- Action does external API work (OpenAI, Whisper, RAG)
- Action calls internal mutation to persist results
- Example: `scrapeFromFacebookAdLibrary` → `insertAd`

### Media Storage Pattern (already implemented)
- Download media via action: `ctx.runAction(internal.ads.functions.storeMediaFromUrl)`
- Store in Convex storage: `ctx.storage.store(blob)`
- Generate URLs in queries: `ctx.storage.getUrl(storageId)`

### RAG Setup Pattern (new)
```typescript
// convex/ads/rag.ts
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { components } from "../_generated/api";

type AdFilterTypes = {
  tags: string;        // Individual tag (for OR search)
  platform: string;    // facebook, google, etc.
  pageId: string;      // Advertiser page ID
};

export const rag = new RAG<AdFilterTypes>(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
  filterNames: ["tags", "platform", "pageId"],
});
```

### RAG Add Pattern
```typescript
// In analyzeAndIndexAd action
const searchableContent = `
Title: ${ad.title}
Description: ${ad.description}
${transcript ? `Transcript: ${transcript}` : ''}
${imageDesc ? `Visual Content: ${imageDesc}` : ''}
Tags: ${tags.join(", ")}
`.trim();

const { entryId } = await rag.add(ctx, {
  namespace: `ads-${userId}`,
  key: `ad-${adId}`,
  text: searchableContent,
  filterValues: [
    ...tags.map(tag => ({ name: "tags" as const, value: tag })),
    { name: "platform" as const, value: ad.platform },
    { name: "pageId" as const, value: ad.pageId ?? "" },
  ],
});
```

### RAG Search Pattern
```typescript
// In searchSemantic action
const { results, entries } = await rag.search(ctx, {
  namespace: `ads-${userId}`,
  query: args.query,
  filters: args.filters?.tags?.map(tag => ({ name: "tags", value: tag })) ?? [],
  limit: args.limit ?? 20,
  vectorScoreThreshold: 0.5,
});

// Extract ad IDs from entries
const adIds = entries.map(e => e.key.replace("ad-", ""));
```

### Scheduler Pattern (async processing)
```typescript
// In scrapeFromFacebookAdLibrary, after inserting ad:
await ctx.scheduler.runAfter(
  0, // Run immediately
  internal.ads.analysis.analyzeAndIndexAd,
  { adId: insertedId }
);
```

## 7. Scrappiest MVP Approach

### Phase 1: Install Dependencies & Setup RAG
- Install `@convex-dev/rag` and `@ai-sdk/openai`
- Create `convex/convex.config.ts` with RAG component
- Create `convex/ads/rag.ts` with RAG instance
- Add schema fields to ads table
- Deploy to test RAG installation

### Phase 2: Tag Generation Only (No Transcripts)
- Implement `generateTags` action (text-only: title + description)
- Implement `analyzeAndIndexAd` (tags only, skip video/image analysis)
- Add RAG indexing with tags as filters
- Trigger analysis on ad scrape via scheduler
- Display tags in UI with `AdTagBadges` component
- No filtering yet - just display

### Phase 3: Tag Filtering (No Semantic Search Yet)
- Add `by_ai_tags` index to schema
- Implement `searchByTags` query
- Implement `getAvailableTags` query
- Build `TagFilterPanel` component
- Add filtering to `/ads` page

### Phase 4: Add Semantic Search (Text Only)
- Implement `searchSemantic` action
- Build `/search` route
- Build `SemanticSearchBar` component
- Build `SearchResultCard` component
- Test with text-only queries (no transcript/image desc yet)

### Phase 5: Video Transcription
- Implement `transcribeVideo` action with Whisper API
- Update `analyzeAndIndexAd` to include transcripts
- Re-index existing ads with videos (migration script)
- Build `TranscriptView` component on ad detail page
- Test semantic search with transcript content

### Phase 6: Image Description
- Implement `describeImages` action with GPT-4 Vision
- Update `analyzeAndIndexAd` to include image descriptions
- Re-index existing ads (migration script)
- Build `ImageDescriptionView` component
- Test semantic search with visual content

### Simplifications for MVP
- Use GPT-4o-mini for tagging ($0.15/1M input tokens) - cheap
- Use Whisper API for transcription (~$0.006/minute) - moderate cost
- Use GPT-4 Vision for images (~$0.01/image) - moderate cost
- Limit to 1 image description per ad (first image only)
- Single namespace per user (no per-subscription isolation)
- No tag categories/hierarchy (flat list)
- OR-only filtering (no AND logic)
- No custom chunking (RAG default)
- No reranking (pure vector similarity)
- No confidence scores (simple yes/no for analysis completion)

### Cost Estimates (per 1000 ads)
- **Tagging**: ~$0.02 (avg 200 tokens input, 50 output)
- **Transcription**: ~$0.60 (avg 1 min video per ad)
- **Image Description**: ~$10 (1 image per ad)
- **Embeddings**: ~$0.10 (avg 500 tokens per ad)
- **Total**: ~$11/1000 ads analyzed

## 8. Database Schema Changes

```typescript
// convex/schema.ts
ads: defineTable({
  // ... existing fields ...

  // AI Analysis fields
  aiTags: v.optional(v.array(v.string())),
  videoTranscript: v.optional(v.string()),
  imageDescription: v.optional(v.string()),

  // RAG indexing fields
  ragEntryId: v.optional(v.string()),
  ragIndexedAt: v.optional(v.number()),
  aiAnalysisCompleted: v.optional(v.boolean()),
})
  .index("by_user", ["userId"])
  .index("by_subscription", ["subscriptionId"])
  .index("by_scraped_at", ["scrapedAt"])
  .index("by_platform_and_ad_id", ["platform", "adId"])
  .index("by_page_id", ["pageId"])
  .index("by_ai_tags", ["aiTags"]) // NEW: Inverted index for fast tag filtering
```

## 9. File Structure

```
convex/
  convex.config.ts (NEW) - RAG component registration

  ads/
    functions.ts (EXISTING) - Keep existing queries/mutations
    analysis.ts (NEW) - AI analysis actions (transcribe, describe, tag, index)
    search.ts (NEW) - Search actions/queries (semantic, tags)
    rag.ts (NEW) - RAG instance configuration

  schema.ts (MODIFY) - Add AI fields to ads table

src/
  features/
    ad-search/ (NEW FEATURE)
      components/
        semantic-search-bar.tsx
        search-result-card.tsx
        tag-filter-panel.tsx
        analysis-indicator.tsx
      hooks/
        use-semantic-search.ts
        use-tag-search.ts
        use-available-tags.ts
      types.ts
      README.md

    ad-feed/
      components/
        ad-card-view.tsx (MODIFY - add AdTagBadges)
        ad-tag-badges.tsx (NEW)
        transcript-view.tsx (NEW)
        image-description-view.tsx (NEW)

  routes/
    search.tsx (NEW ROUTE)
```

## 10. Environment Variables

Add to `.env.local` and Convex dashboard:
```
OPENAI_API_KEY=sk-...           # For Whisper, GPT-4 Vision, GPT-4o-mini, embeddings
```

## 11. Convex Config Setup

```typescript
// convex/convex.config.ts (NEW FILE)
import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config";

const app = defineApp();
app.use(rag);

export default app;
```

## 12. Testing Strategy

### Manual Testing
1. Scrape ad with video → verify transcript generated
2. Scrape ad with images → verify description generated
3. Check tags appear on ad cards
4. Click tag → verify filtering works
5. Search "SaaS productivity" → verify semantic results
6. Apply filters (tags + platform) → verify combined filtering
7. View ad detail → verify transcript/image descriptions display

### Edge Cases
- Ad with no media (text only) → tags from text only
- Ad with multiple videos → transcribe first video only (MVP)
- Ad with 10+ images → describe first image only (MVP)
- Very long transcript (>10k chars) → truncate before embedding
- Special characters in tags → sanitize (lowercase, hyphens)
- Failed transcription → continue with partial analysis
- Rate limit on OpenAI → retry with exponential backoff

### Performance Checks
- Search across 100+ ads → <2s response time
- Tag filtering with 10+ tags → <500ms query time
- RAG indexing per ad → <10s total analysis time

## 13. Migration Strategy

### For Existing Ads
1. Create migration script: `convex/migrations/analyzeExistingAds.ts`
2. Query all ads without `aiAnalysisCompleted: true`
3. Schedule analysis jobs in batches (10 at a time to avoid rate limits)
4. Monitor progress via dashboard query
5. Re-run for failed analyses

```typescript
// Migration script pattern
export const analyzeAllAds = internalAction({
  handler: async (ctx) => {
    const ads = await ctx.runQuery(internal.ads.search.getUnanalyzedAds);

    for (const ad of ads.slice(0, 10)) { // Batch of 10
      await ctx.scheduler.runAfter(0, internal.ads.analysis.analyzeAndIndexAd, {
        adId: ad._id,
      });
    }

    return { processed: ads.length };
  },
});
```

## 14. Key Dependencies

```json
{
  "@convex-dev/rag": "^0.1.0",
  "@ai-sdk/openai": "^0.0.66",
  "ai": "^3.4.33"
}
```

Install via:
```bash
npm install @convex-dev/rag @ai-sdk/openai ai
```

## 15. Success Metrics

### MVP Success Criteria
- 95%+ ads successfully analyzed and indexed
- Search results return in <2s
- Tag filtering works in <500ms
- At least 5 tags per ad on average
- Semantic search returns relevant results (manual validation)

### Future Enhancements (Post-MVP)
- Manual tag editing by users
- Custom tag creation
- Tag autocomplete in search
- Multi-video transcription
- Multi-image descriptions
- Hybrid search (tag + semantic combined ranking)
- Search query suggestions
- Saved searches
- Export search results
