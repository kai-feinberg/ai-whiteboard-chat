# PRD: Filtered Web Search & TikTok Search Tools

## Introduction

Add two AI agent tools to the chat functionality: **Filtered Web Search** and **TikTok Search**. These tools enable users to ask questions that require real-time web research or social media insights, with the AI automatically searching and synthesizing information.

**Filtered Web Search** searches via Exa API, then uses Claude Haiku to filter out promotional, spam, and paywalled content before returning curated results.

**TikTok Search** searches TikTok via Scrape Creators API for keyword queries, returning video metadata with transcripts for the AI to synthesize creator insights.

Both tools include rich UI rendering of results as collapsible card grids with full tool state visualization (loading, success, error).

## Goals

- Enable AI to search the web for current information with automatic quality filtering
- Enable AI to search TikTok for creator insights and social media perspectives
- Provide transparent UI showing both accepted and filtered-out results
- Render results as visual cards in a collapsible grid layout
- Integrate seamlessly with existing chat/agent infrastructure
- All functionality verified via agent-browser automated testing

## User Stories

---

---

### US-UI-003: Create Web Search Results Card Component

**Description:** As a user, I want to see accepted web search results as cards with article metadata.

**Required Reading:**
- `src/components/ai-elements/read-link-tool.tsx` → card pattern
- `plans/deep-search.md` → web card design reference

**Acceptance Criteria:**
- [ ] Create `WebSearchCard` component in `src/components/ai-elements/web-search-results.tsx`
- [ ] Card displays: featured image (if available), favicon, title (linked), author, date, summary
- [ ] Handle HTML entities in titles/summaries (decode `&amp;`, `&lt;`, etc.)
- [ ] Format dates as relative (Today, 3d ago, 2w ago, Jan 2024)
- [ ] Handle missing images gracefully (hide image section)
- [ ] Clicking card opens article URL in new tab
- [ ] `pnpm typecheck` passes
- [ ] **Use agent-browser to test**: cards render with correct data, links work

---

### US-UI-004: Create Web Search Results Grid with Rejected Section

**Description:** As a user, I want to see accepted results in a grid and filtered-out results in a collapsed section for transparency.

**Required Reading:**
- `src/components/ui/collapsible.tsx` → nested collapsible pattern

**Acceptance Criteria:**
- [ ] Create `WebSearchTool` wrapper component
- [ ] Shows two-phase loading: "Searching web..." → "Filtering results..."
- [ ] Accepted results in responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- [ ] Entire accepted results section is collapsible with "X results found" header
- [ ] Below accepted results: collapsed "X results filtered out" section
- [ ] Filtered section shows: title, rejection reason, muted styling
- [ ] Hidden entirely if no rejected results
- [ ] Error state if search failed
- [ ] `pnpm typecheck` passes
- [ ] **Use agent-browser to test**: loading phases show, grid renders, rejected section expands

---

### US-UI-005: Integrate Tool Components into Message Rendering

**Description:** As a developer, I need to render the new tool components when tool calls appear in chat messages.

**Required Reading:**
- `src/components/ai-elements/message.tsx` or conversation rendering code
- `src/components/ai-elements/tool.tsx` → existing tool display pattern

**Acceptance Criteria:**
- [ ] Detect `searchTikTok` and `filteredWebSearch` tool calls in message parts
- [ ] Render `TikTokSearchTool` for searchTikTok calls
- [ ] Render `WebSearchTool` for filteredWebSearch calls
- [ ] Pass correct props: state, input, output from tool part
- [ ] Falls back to generic tool display for unknown tools
- [ ] `pnpm typecheck` passes
- [ ] **Use agent-browser to test**: send message that triggers each tool, verify custom UI renders

---

### US-INT-001: End-to-End Integration Test - TikTok Search

**Description:** As a developer, I need to verify the complete TikTok search flow works in a real browser session.

**Required Reading:**
- `agent-browser` skill documentation
- `scripts/browser-login.sh`

**Acceptance Criteria:**
- [ ] Start dev server with `pnpm dev`
- [ ] Run `./scripts/browser-login.sh` to authenticate
- [ ] Navigate to chat page, create new thread if needed
- [ ] Send message: "Search TikTok for best productivity tips"
- [ ] **Verify**: Loading spinner appears with "Searching TikTok..."
- [ ] **Verify**: TikTok cards render in horizontal scroll grid
- [ ] **Verify**: Cards show thumbnail, creator handle, engagement stats
- [ ] **Verify**: Expanding a card shows transcript
- [ ] **Verify**: "Open on TikTok" link opens correct URL
- [ ] **Verify**: AI synthesizes response referencing creator insights

---

### US-INT-002: End-to-End Integration Test - Filtered Web Search

**Description:** As a developer, I need to verify the complete filtered web search flow works in a real browser session.

**Required Reading:**
- `agent-browser` skill documentation

**Acceptance Criteria:**
- [ ] Using same browser session from US-INT-001
- [ ] Send message: "Search the web for best practices for remote work"
- [ ] **Verify**: Two-phase loading: "Searching web..." then "Filtering results..."
- [ ] **Verify**: Accepted results render as cards with images/titles/dates
- [ ] **Verify**: "X results filtered out" section appears if any rejected
- [ ] **Verify**: Expanding rejected section shows titles + rejection reasons
- [ ] **Verify**: Clicking card opens source article
- [ ] **Verify**: AI synthesizes response citing accepted sources

---

### US-INT-003: End-to-End Collapse/Expand UI Test

**Description:** As a developer, I need to verify the collapsible card grid UI works correctly.

**Required Reading:**
- `agent-browser` skill documentation

**Acceptance Criteria:**
- [ ] After tools complete (from US-INT-001/002), results should be visible
- [ ] **Verify**: Clicking header collapses the results section
- [ ] **Verify**: Clicking header again expands the section
- [ ] **Verify**: Animation is smooth (not jumpy)
- [ ] **Verify**: Individual TikTok cards can expand/collapse independently
- [ ] **Verify**: Rejected web results section expands/collapses independently

## Functional Requirements

- **FR-1:** The `filteredWebSearch` tool MUST search the web via Exa API when the agent determines web research is needed
- **FR-2:** The `filteredWebSearch` tool MUST fetch full article text (not just metadata) from Exa
- **FR-3:** Each web result MUST be evaluated by Claude Haiku against filter criteria (promotional, spam, paywalled)
- **FR-4:** Rejected web results MUST include the rejection reason in the output
- **FR-5:** Accepted web results MUST include full article text for AI context
- **FR-6:** The `searchTikTok` tool MUST search TikTok via Scrape Creators API for keyword queries
- **FR-7:** TikTok results MUST include video transcripts (or "[No speech detected]" if unavailable)
- **FR-8:** Frontend MUST display loading states during tool execution
- **FR-9:** Frontend MUST render accepted web results as interactive cards in a collapsible grid
- **FR-10:** Frontend MUST render rejected web results in a collapsed section with count and reasons
- **FR-11:** Frontend MUST render TikTok results as cards with thumbnails, stats, and expandable transcripts
- **FR-12:** AI MUST synthesize responses using the tool results (article text / transcripts)
- **FR-13:** Results sections MUST be collapsible/expandable by user preference

## Non-Goals (Out of Scope)

- User-configurable filter criteria UI (future enhancement)
- Domain restriction for web search (searching all domains)
- TikTok creator search (by @handle) - only keyword search
- TikTok content filtering (no Haiku filtering for TikTok)
- Caching search results across sessions
- Saving/bookmarking individual results
- Full article view within the app (links to source)
- Multi-query search (one query per tool call)

## Design Considerations

**TikTok Cards:**
- Horizontal scrollable grid for compact view
- Thumbnail aspect ratio 9:16 (TikTok native)
- Stats row: Eye icon (views), Heart icon (likes), Share icon (shares)
- Collapsed: thumbnail + @handle + stats
- Expanded: + transcript + "Open on TikTok" button

**Web Search Cards:**
- Responsive grid: 1/2/3 columns based on viewport
- Featured image at top (aspect-video), hide if missing
- Favicon + title as header
- Author + relative date below
- Summary truncated to 2 lines

**Rejected Results Section:**
- Muted/subtle styling (low contrast)
- Shows title + italic rejection reason
- Collapsed by default, "X results filtered out" trigger

**Loading States:**
- TikTok: "Searching TikTok..." with spinner
- Web: Two phases - "Searching web..." → "Filtering results..."

**Collapsible Behavior:**
- Entire results section has collapse header
- Starts expanded to show results
- User can collapse to minimize space after reviewing

## Technical Considerations

### API Integration

| Service | Purpose | Env Variable |
|---------|---------|--------------|
| Exa | Web search + content | `EXA_API_KEY` |
| Scrape Creators | TikTok search/transcripts | `SCRAPE_CREATORS_API_KEY` |
| OpenRouter (Haiku) | Filter evaluation | `OPENROUTER_API_KEY` (existing) |

### File Structure

```
convex/chat/
  tools.ts              # NEW: Tool implementations (fetchExaSearch, fetchTikTokSearch, etc.)
  functions.ts          # MODIFY: Add tools to agent

src/components/ai-elements/
  tiktok-results.tsx    # NEW: TikTok card + grid components
  web-search-results.tsx # NEW: Web card + grid + rejected section
  message.tsx           # MODIFY: Route tool parts to custom components
```

### Tool Schemas

**searchTikTok Input:**
```typescript
z.object({
  query: z.string().describe("Search query (e.g., 'best umbrellas for rain')")
})
```

**searchTikTok Output:**
```typescript
{
  success: boolean;
  videos: TikTokVideoResult[];
  totalFound?: number;
  message?: string;
  error?: string;
}
```

**filteredWebSearch Input:**
```typescript
z.object({
  query: z.string().describe("Search query for web articles")
})
```

**filteredWebSearch Output:**
```typescript
{
  success: boolean;
  accepted: AcceptedWebResult[];
  rejected: RejectedWebResult[];
  searchTime: number;
  filterTime: number;
  message?: string;
  error?: string;
}
```

### Dependencies to Add

```bash
pnpm add exa-js
```

## Data Flow

```
User sends message
  │
  ▼
Agent (in sendMessage action) processes prompt
  │
  ├─── If web research needed ───────────────────────┐
  │                                                   │
  │    filteredWebSearch tool                         │
  │      │                                            │
  │      ├─ Exa searchAndContents(query)              │
  │      │    → 10 results with text                  │
  │      │                                            │
  │      ├─ Parallel Haiku calls                      │
  │      │    → { accepted, reason } per result       │
  │      │                                            │
  │      └─ Return { accepted[], rejected[] }         │
  │                                                   │
  ├─── If social media needed ───────────────────────┤
  │                                                   │
  │    searchTikTok tool                              │
  │      │                                            │
  │      ├─ Scrape Creators search(query)             │
  │      │    → video metadata                        │
  │      │                                            │
  │      ├─ Parallel transcript fetches               │
  │      │    → WebVTT → plain text                   │
  │      │                                            │
  │      └─ Return { videos[] }                       │
  │                                                   │
  ▼                                                   │
Frontend receives streaming message with tool parts   │
  │                                                   │
  ├─ Tool state: input-streaming → input-available    │
  │    → Show loading UI                              │
  │                                                   │
  ├─ Tool state: output-available                     │
  │    → Render TikTokSearchTool or WebSearchTool     │
  │                                                   │
  ▼                                                   │
AI text streams below tool results                    │
  │                                                   │
  └─ Synthesizes response from tool output            │
```

## Open Questions

1. **Rate limiting:** Should we add client-side debouncing if user rapidly sends search queries?
2. **Result limits:** Is 10 results the right default, or should it be configurable per tool call?
3. **Credit tracking:** Do tool API calls (Exa, Scrape Creators) need separate credit tracking beyond the Haiku/model usage?
4. **Caching:** Should we cache recent searches to avoid duplicate API calls for same query?
