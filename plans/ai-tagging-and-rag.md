# AI Tagging & RAG Semantic Search

## 1. Database Design

### New/Adjusted Tables

**ads table** - Add AI tagging fields:
- `aiTags: v.optional(v.array(v.string()))` - AI-generated categorical tags
- `aiTagsGeneratedAt: v.optional(v.number())` - Timestamp of tagging
- `ragEntryId: v.optional(v.string())` - Reference to RAG namespace entry
- `ragIndexedAt: v.optional(v.number())` - Timestamp of RAG indexing

### New Indexes
- `by_ai_tags` on ads table (for inverted index pattern) - Convex supports array field indexing

### Queries

**analyzeAndTagAd (action)**
- Input: `adId: Id<"ads">`
- Output: `{ tags: string[], entryId: string }`
- Purpose: Generate AI tags from ad content, add to RAG, update ad record

**searchAdsBySemantic (action)**
- Input: `query: string`, `filters?: { tags?: string[], platform?: string, advertiserId?: string }`, `limit?: number`
- Output: `{ results: SearchResult[], text: string, entries: SearchEntry[] }`
- Purpose: Vector search through RAG with optional tag-based metadata filters

**searchAdsByTags (query)**
- Input: `tags: string[]`, `userId: string`
- Output: `Ad[]`
- Purpose: Fast inverted index lookup by AI tags (OR operation)

**getAvailableTags (query)**
- Input: `userId: string`
- Output: `{ tag: string, count: number }[]`
- Purpose: Return all unique tags for filter UI with counts

## 2. Data Flow

### Tagging Flow (On Scrape)
1. `scrapeFromFacebookAdLibrary` inserts ad → returns `adId`
2. Immediately schedule `analyzeAndTagAd(adId)` via `ctx.scheduler.runAfter(0, ...)`
3. `analyzeAndTagAd`:
   - Reads ad from DB
   - Constructs prompt with ad title, description, ctaText, displayFormat, advertiser info
   - Calls OpenAI/Claude to generate 3-8 categorical tags (industry, format, emotion, cta-type, etc.)
   - Parses structured JSON response
4. Adds ad content to RAG:
   - Namespace: `ads-${userId}` (per-user search isolation)
   - Key: `ad-${adId}` (for updates/deduplication)
   - Text: Combined title + description + cards content
   - FilterValues: `[{ name: "tags", value: tag }]` for each tag (OR search)
   - FilterValues: `[{ name: "platform", value: ad.platform }]`
   - FilterValues: `[{ name: "pageId", value: ad.pageId }]`
5. Updates ad record with `aiTags`, `aiTagsGeneratedAt`, `ragEntryId`, `ragIndexedAt`

### Search Flow (Semantic)
1. User enters natural language query: "Show me carousel ads about productivity tools"
2. Frontend calls `searchAdsBySemantic(query, filters)`
3. RAG performs vector search with:
   - Namespace: `ads-${userId}`
   - Query: User's natural language
   - Filters: Applied as metadata filters (tags, platform, pageId)
   - Limit: 20 results
4. Returns matching ad chunks with scores
5. Frontend displays ads sorted by relevance score

### Search Flow (Tag-Based)
1. User selects tags from filter UI: ["ecommerce", "video", "urgency"]
2. Frontend calls `searchAdsByTags(tags)`
3. Query uses inverted index `by_ai_tags` for fast lookup
4. Returns all ads matching ANY selected tag (OR operation)
5. Frontend displays ads grouped by relevance

### Key Transformations
- Ad content → embeddings via OpenAI `text-embedding-3-small`
- Ad metadata → structured tags (JSON array of strings)
- Tags → RAG filter values (one filter per tag for OR search)
- Vector search results → ad IDs → full ad records with advertiser data

## 3. User Flows

### Admin/User Flow - Tagging (Automatic)
- Scrape ads via existing flow
- See "Analyzing..." badge on newly scraped ads
- After 5-10s, tags appear on ad cards
- No manual intervention required

### User Flow - Semantic Search
- Navigate to `/search` page (new route)
- Enter natural language: "carousel ads for SaaS companies"
- Apply optional filters: tags, platform, advertiser
- See results ranked by semantic similarity
- Click ad to view full details

### User Flow - Tag Filtering
- View ads dashboard
- See tag cloud/filter sidebar with all available tags + counts
- Click tags to filter (multi-select, OR operation)
- Results update in real-time via Convex
- Clear filters to see all ads

## 4. UI Components

### AdTagBadges (new component)
- **Purpose**: Display AI-generated tags as pills on ad cards
- **Location**: ad-card-view.tsx, ad detail page
- **Key interactions**: Click tag to filter by that tag
- **Data requirements**: `ad.aiTags: string[]`

### SemanticSearchBar (new component)
- **Purpose**: Natural language search input with autocomplete
- **Location**: `/search` page, dashboard header
- **Key interactions**: Text input, submit, clear
- **Data requirements**: None (just input)

### TagFilterPanel (new component)
- **Purpose**: Multi-select tag filter with counts
- **Location**: Dashboard sidebar or top filters
- **Key interactions**: Checkbox select/deselect, clear all
- **Data requirements**: Available tags from `getAvailableTags`

### SearchResultCard (new component)
- **Purpose**: Display search results with relevance scores
- **Location**: `/search` results list
- **Key interactions**: Click to view full ad
- **Data requirements**: Ad + relevance score + snippet

### AdCard/AdTableRow (modified)
- Add `<AdTagBadges />` component
- Add "Analyzing..." loading state when `aiTags === undefined`
- Show generated tags once `aiTagsGeneratedAt` is set

## 5. API Routes (Convex Functions)

### Actions (External AI/RAG calls)

**analyzeAndTagAd**
- Purpose: Generate AI tags and index in RAG
- Input: `{ adId: Id<"ads"> }`
- Output: `{ tags: string[], ragEntryId: string }`
- Pattern: Fetch ad → call OpenAI → call RAG → update ad

**searchAdsBySemantic**
- Purpose: Vector search through RAG with filters
- Input: `{ query: string, filters?: FilterOptions, limit?: number }`
- Output: `{ results: SearchResult[], ads: Ad[] }`
- Pattern: RAG search → extract entryIds → query ads by IDs → join advertisers

### Queries (Database reads)

**searchAdsByTags**
- Purpose: Fast tag-based filtering via inverted index
- Input: `{ tags: string[], userId?: string }`
- Output: `Ad[]`
- Pattern: Query by_ai_tags index → filter by userId → join advertisers

**getAvailableTags**
- Purpose: Get all unique tags for current user's ads
- Input: `{ userId: string }`
- Output: `{ tag: string, count: number }[]`
- Pattern: Query user's ads → aggregate tags → count occurrences

### Mutations (Database writes)

**updateAdTags (internal)**
- Purpose: Update ad with AI tags and RAG reference
- Input: `{ adId, aiTags, ragEntryId, timestamps }`
- Output: `void`
- Pattern: Standard mutation with getAuthUserId verification

## 6. Patterns to Reuse

### Auth Pattern
- Use `getAuthUserId()` in all actions/queries
- Namespace RAG by userId: `ads-${userId}`
- Pattern from `convex/ads/functions.ts::getByUser`

### Action → Mutation Pattern
- Action calls external APIs (OpenAI, RAG)
- Action calls internal mutation to persist results
- Pattern: `scrapeFromFacebookAdLibrary` → `insertAd`

### RAG Setup Pattern (New - from docs)
```typescript
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { components } from "./_generated/api";

type AdFilterTypes = {
  tags: string;           // Individual tag (for OR search)
  platform: string;       // facebook, google, etc.
  pageId: string;         // Advertiser page ID
};

const rag = new RAG<AdFilterTypes>(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
  filterNames: ["tags", "platform", "pageId"],
});
```

### RAG Add Pattern
```typescript
// In analyzeAndTagAd action
const adContent = `${ad.title}\n\n${ad.description}`;
const { entryId } = await rag.add(ctx, {
  namespace: `ads-${userId}`,
  key: `ad-${adId}`,
  text: adContent,
  filterValues: [
    ...tags.map(tag => ({ name: "tags" as const, value: tag })),
    { name: "platform" as const, value: ad.platform },
    { name: "pageId" as const, value: ad.pageId ?? "" },
  ],
});
```

### RAG Search Pattern
```typescript
// In searchAdsBySemantic action
const { results, entries } = await rag.search(ctx, {
  namespace: `ads-${userId}`,
  query: args.query,
  filters: args.filters?.tags?.map(tag => ({ name: "tags", value: tag })) ?? [],
  limit: args.limit ?? 20,
  vectorScoreThreshold: 0.5,
});
```

### AI Tagging Prompt Pattern (New)
```typescript
const prompt = `Analyze this ad and generate 3-8 categorical tags.

Ad Title: ${ad.title}
Description: ${ad.description}
CTA: ${ad.ctaText}
Format: ${ad.displayFormat}
Advertiser: ${advertiser?.pageName}

Generate tags for:
- Industry/vertical (e.g., "saas", "ecommerce", "education")
- Ad format (e.g., "video", "carousel", "single-image")
- Emotional tone (e.g., "urgency", "educational", "inspirational")
- Target audience (e.g., "b2b", "b2c", "developers")
- CTA type (e.g., "signup", "purchase", "learn-more")

Return JSON only: { "tags": ["tag1", "tag2", ...] }`;
```

### Inverted Index Query Pattern (Convex feature)
```typescript
// Convex automatically handles array field indexing
// Create index: .index("by_ai_tags", ["aiTags", "userId"])
// Query matches ANY value in array:
const ads = await ctx.db
  .query("ads")
  .withIndex("by_ai_tags", q => q.eq("aiTags", selectedTag))
  .filter(q => q.eq(q.field("userId"), userId))
  .collect();
```

### Scheduler Pattern (Async Processing)
```typescript
// In scrapeFromFacebookAdLibrary action, after inserting ad:
await ctx.scheduler.runAfter(0, internal.ads.analyzeAndTagAd, {
  adId: insertedId,
});
```

## 7. Scrappiest MVP Notes

**Phase 1: AI Tagging Only**
- Start with tagging only, no RAG yet
- Hardcode 5-6 predefined tags, have AI choose from list (cheaper than open-ended)
- Manual "Regenerate Tags" button per ad (no automatic on scrape)
- Display tags, no filtering yet

**Phase 2: Add Inverted Index Search**
- Add `by_ai_tags` index to schema
- Build tag filter UI with checkboxes
- Implement `searchAdsByTags` query
- OR operation only (any selected tag)

**Phase 3: Add RAG Semantic Search**
- Install `@convex-dev/rag` component
- Add RAG indexing in `analyzeAndTagAd`
- Build `/search` page with natural language input
- Display results with relevance scores

**Simplifications**
- Use OpenAI `gpt-4o-mini` for fast, cheap tagging
- Use `text-embedding-3-small` for embeddings (1536 dims)
- Single namespace per user (no per-subscription isolation)
- No tag hierarchy or categories
- No AND filter logic (OR only via multiple filter values)
- No custom chunking (use RAG default chunker)
- No reranking or hybrid search (pure vector)
- Tags stored as simple string array (no weights or confidence scores)

**Environment Variables Needed**
- `OPENAI_API_KEY` - For embeddings and tagging
- Existing `SCRAPE_CREATORS_API_KEY`

**Convex Config**
```typescript
// convex/convex.config.ts (create this file)
import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config";

const app = defineApp();
app.use(rag);

export default app;
```

## 8. Database Schema Changes

```typescript
// In convex/schema.ts, update ads table:
ads: defineTable({
  // ... existing fields ...

  // AI Tagging fields
  aiTags: v.optional(v.array(v.string())),
  aiTagsGeneratedAt: v.optional(v.number()),

  // RAG indexing fields
  ragEntryId: v.optional(v.string()), // EntryId from RAG component
  ragIndexedAt: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_subscription", ["subscriptionId"])
  .index("by_scraped_at", ["scrapedAt"])
  .index("by_platform_and_ad_id", ["platform", "adId"])
  .index("by_page_id", ["pageId"])
  .index("by_ai_tags", ["aiTags"]) // NEW: Inverted index for tags
```

## 9. File Structure

```
convex/
  convex.config.ts (NEW)
  ads/
    functions.ts (MODIFY - add analyzeAndTagAd, searchAdsBySemantic, searchAdsByTags, getAvailableTags)
    rag.ts (NEW - RAG instance setup)
  schema.ts (MODIFY - add aiTags, ragEntryId, etc.)

src/
  features/
    ad-search/ (NEW FEATURE)
      components/
        semantic-search-bar.tsx
        search-result-card.tsx
        tag-filter-panel.tsx
      hooks/
        use-semantic-search.ts
        use-tag-search.ts
      types.ts

    ad-feed/
      components/
        ad-card-view.tsx (MODIFY - add AdTagBadges)
        ad-tag-badges.tsx (NEW)

  routes/
    search.tsx (NEW ROUTE)
```

## 10. Testing Strategy

**Manual Testing**
1. Scrape 5 ads → verify tags generated within 10s
2. Click tag on ad card → verify filter works
3. Search "productivity SaaS" → verify semantic results
4. Apply tag + platform filters → verify combined filtering
5. Search across 50+ ads → verify performance (<2s)

**Edge Cases**
- Ad with no description (use title only)
- Ad with cards (concatenate all card content)
- Very long ad content (>10k chars) - truncate before embedding
- Tags with special chars - sanitize to lowercase, hyphens only
- User with 1000+ ads - test RAG search performance

**B2B Tolerance**
- Tags may not be perfect initially (iterate prompt)
- Users can't edit tags manually (add later if needed)
- Search may return some irrelevant results (tune threshold)
- No tag suggestions/autocomplete (add later)
