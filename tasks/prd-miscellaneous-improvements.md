# PRD: Miscellaneous Improvements (Q1 2026)

## Introduction

Collection of improvements to enhance AI chat capabilities, document management, and navigation. These features address gaps in the current workflow:

1. **Link Reading Tool** - AI agent tool to extract content from supported platforms during conversation (YouTube, Twitter, TikTok, websites, Facebook ads)
2. **Documents System** - Org-scoped documents for saving notes and organized content ideas (user-controlled CRUD, no AI)
3. **Full-Screen Chat Links** - Quick access to canvas chat from dashboard
4. **Chat Switcher** - Unified chat page for rapidly switching between canvas chats

## Goals

- Enable AI to fetch and summarize content from URLs without creating nodes
- Provide a persistent place to save and edit notes/content (user-managed)
- Reduce friction navigating to ongoing conversations
- Allow users to manage multiple canvas chats without loading full canvas editor

---

## User Stories

### Feature 1: Link Reading Tool

#### US-LR-001: Create readLink AI Tool

**Description:** As a user chatting with AI, I want to paste a URL and have the AI read its content so I can discuss it without creating a node.

**Required Reading:**
- `convex/canvas/chat.ts` → `generateImageTool` pattern (lines 30-100)
- `convex/youtube/functions.ts` → `fetchYouTubeTranscript` extraction logic
- `convex/twitter/functions.ts` → Twitter extraction
- `convex/websites/functions.ts` → Firecrawl extraction
- `convex/tiktok/functions.ts` → TikTok extraction
- `convex/facebook-ads/functions.ts` → Facebook extraction

**Acceptance Criteria:**
- [ ] Create `readLinkTool` in `convex/canvas/chat.ts` using `createTool()`
- [ ] Tool accepts `url: string` argument
- [ ] Tool detects platform from URL (youtube, twitter/x, tiktok, website, facebook)
- [ ] Tool reuses existing extraction logic from respective node functions
- [ ] Tool returns extracted content as structured text (title, content/transcript, author where applicable)
- [ ] Tool handles errors gracefully (unsupported URL, failed fetch, rate limits)
- [ ] Tool is registered in the agent's tools object
- [ ] `pnpm typecheck` passes
- [ ] **Verify in browser using agent-browser skill** - Test by inputing at `http://localhost:3000/canvas/jd7fmnh9mq0s04t9nne70s5zw17zpwgd/chat`

---

#### US-LR-002: Handle Unsupported URLs Gracefully

**Description:** As a user, when I paste an unsupported URL, I want clear feedback about what platforms are supported.

**Required Reading:**
- `convex/canvas/chat.ts` → tool error handling patterns

**Acceptance Criteria:**
- [ ] Tool returns helpful message listing supported platforms when URL not recognized
- [ ] Supported platforms: YouTube, Twitter/X, TikTok, Facebook Ads, general websites (via Firecrawl)
- [ ] Tool does NOT crash or throw unhandled errors
- [ ] `pnpm typecheck` passes
- [ ] **Verify in browser using agent-browser skill** - Test using this link in your prompt input: https://www.youtube.com/watch?v=VZCDQXaLHFc at this route `http://localhost:3000/canvas/jd7fmnh9mq0s04t9nne70s5zw17zpwgd/chat`

---

#### US-LR-003: Display readLink Tool Results in Chat UI

**Description:** As a user, I want to see the extracted link content displayed in the chat so I know what the AI read.

**Required Reading:**
- `src/components/ai-elements/tool.tsx` → existing tool display patterns
- `src/routes/canvas/$canvasId/chat.tsx` → chat message rendering

**Acceptance Criteria:**
- [ ] readLink tool call shows loading state: "Reading link..."
- [ ] Completed tool shows extracted content: title, source platform, truncated preview
- [ ] Display includes link to original URL (clickable)
- [ ] Error states displayed clearly (failed to fetch, unsupported)
- [ ] Styling consistent with existing tool displays (e.g., generateImage)
- [ ] `pnpm typecheck` passes
- [ ] **Verify in browser using agent-browser skill** - Test at `http://localhost:3000/canvas/jd7fmnh9mq0s04t9nne70s5zw17zpwgd/chat`

---

### Feature 2: Documents System

#### US-DOC-003: Create Documents List Page

**Description:** As a user, I want to see all my documents in a dedicated section so I can find and manage them.

**Required Reading:**
- `src/routes/index.tsx` → dashboard patterns (canvas list)
- `src/components/ui/` → UI component patterns
- Use context7 MCP for shadcn/ui patterns

**Acceptance Criteria:**
- [ ] Create route `/documents` at `src/routes/documents/index.tsx`
- [ ] Add "Documents" link in main navigation/header
- [ ] Page lists all org documents with title, last updated date
- [ ] "New Document" button creates empty document and navigates to editor
- [ ] Delete button with confirmation dialog
- [ ] Empty state when no documents exist
- [ ] Loading state while fetching
- [ ] `pnpm typecheck` passes
- [ ] **Verify in browser using agent-browser skill**

---

#### US-DOC-004: Create Document Editor Page

**Description:** As a user, I want to edit a document with basic text/markdown so I can save notes and AI responses.

**Required Reading:**
- `src/routes/canvas/$canvasId.tsx` → route param patterns
- Use context7 MCP for textarea/editor patterns

**Acceptance Criteria:**
- [ ] Create route `/documents/$documentId` at `src/routes/documents/$documentId.tsx`
- [ ] Editable title field (auto-saves on blur or debounced)
- [ ] Large textarea/editor for content (markdown supported)
- [ ] Auto-save content on changes (debounced, ~1s delay)
- [ ] "Saved" / "Saving..." indicator
- [ ] Back button returns to documents list
- [ ] 404 handling if document doesn't exist or wrong org
- [ ] `pnpm typecheck` passes
- [ ] **Verify in browser using agent-browser skill**

---

### Feature 3: Full-Screen Chat Links

#### US-NAV-001: Add Chat Link to Canvas Cards

**Description:** As a user on the dashboard, I want quick access to a canvas's chat without opening the full canvas editor.

**Required Reading:**
- `src/routes/index.tsx` → canvas card rendering
- `src/routes/canvas/$canvasId/chat.tsx` → chat route structure

**Acceptance Criteria:**
- [ ] Add chat icon/button to each canvas card on dashboard
- [ ] Button navigates to `/canvas/{canvasId}/chat`
- [ ] Button has tooltip "Open Chat"
- [ ] Button only appears if canvas has at least one chat node (optional optimization)
- [ ] `pnpm typecheck` passes
- [ ] **Verify in browser using agent-browser skill**

---

### Feature 4: Chat Switcher Page

#### US-CHAT-001: Create Chat Hub Page

**Description:** As a user, I want a dedicated page showing all my canvas chats so I can quickly switch between conversations.

**Required Reading:**
- `src/routes/index.tsx` → list page patterns
- `convex/canvas/functions.ts` → canvas queries
- `convex/chat/functions.ts` → chat node queries

**Acceptance Criteria:**
- [ ] Create route `/chats` at `src/routes/chats/index.tsx`
- [ ] Add "Chats" link in main navigation
- [ ] Page lists all canvases that have chat nodes
- [ ] Each item shows: canvas name, chat node count, last message preview (truncated)
- [ ] Clicking item navigates to `/canvas/{canvasId}/chat`
- [ ] Items sorted by most recent activity
- [ ] Empty state when no chats exist
- [ ] `pnpm typecheck` passes
- [ ] **Verify in browser using agent-browser skill**

---

#### US-CHAT-002: Create Chat Query for Hub

**Description:** As a developer, I need a query that returns canvases with their chat metadata for the chat hub.

**Required Reading:**
- `convex/canvas/functions.ts` → existing canvas queries
- `convex/chat/functions.ts` → chat node queries

**Acceptance Criteria:**
- [ ] Create `listCanvasesWithChats` query in `convex/canvas/functions.ts`
- [ ] Returns canvases that have at least one chat node
- [ ] Includes: canvasId, canvasName, chatNodeCount, lastMessageTimestamp
- [ ] Sorted by lastMessageTimestamp descending
- [ ] Efficiently queries using indexes (no N+1)
- [ ] `pnpm typecheck` passes

---

## Functional Requirements

### Link Reading Tool
- **FR-LR-1:** Tool must detect platform from URL pattern (youtube.com, twitter.com/x.com, tiktok.com, facebook.com/ads/library, other = website)
- **FR-LR-2:** Tool must reuse existing extraction functions, not duplicate logic
- **FR-LR-3:** Tool must return structured text suitable for AI context
- **FR-LR-4:** Tool must not create any database records (read-only operation)
- **FR-LR-5:** Tool invocation must display in chat UI with loading state, extracted content preview, and error handling

### Documents
- **FR-DOC-1:** Documents must be scoped to organization, not user
- **FR-DOC-2:** All team members in org can view/edit all org documents
- **FR-DOC-3:** Document content stored as plain text/markdown (no rich formatting)
- **FR-DOC-4:** Auto-save must debounce to prevent excessive writes
- **FR-DOC-5:** Documents are fully user-managed (no AI tools for document CRUD)

### Navigation
- **FR-NAV-1:** Chat links must not require loading full canvas state
- **FR-NAV-2:** Chat hub must load quickly with minimal data fetching
- **FR-NAV-3:** Navigation must preserve browser history for back button

---

## Non-Goals (Out of Scope)

- AI tools for document creation/editing (documents are user-managed only)
- Rich text editing (WYSIWYG, formatting toolbar)
- Document sharing outside organization
- Document versioning/history
- Document folders/organization
- Document search
- Real-time collaborative editing (like Google Docs)
- Document templates
- Export documents to PDF/Word
- Link reading for unsupported platforms (LinkedIn, Instagram, etc.)
- Caching extracted link content

---

## Design Considerations

### Documents List
- Similar visual style to canvas list on dashboard
- Card or list view with title + last updated
- Subtle delete button (trash icon) with confirmation

### Document Editor
- Full-width editing area, minimal chrome
- Title as large editable text at top
- Subtle auto-save indicator (checkmark or "Saved" text)
- Consider monospace font option for code-heavy content

### Chat Hub
- List view prioritizing density (many items visible)
- Canvas name prominent, chat preview as secondary text
- Visual indicator for recent activity

---

## Technical Considerations

### Link Reading Tool Integration

Reuse extraction helpers from existing node functions:

| Platform | Source Function | Key Helper |
|----------|----------------|------------|
| YouTube | `convex/youtube/functions.ts` | Scrape Creators API call |
| Twitter | `convex/twitter/functions.ts` | Scrape Creators API call |
| TikTok | `convex/tiktok/functions.ts` | Scrape Creators API call |
| Website | `convex/websites/functions.ts` | Firecrawl API call |
| Facebook | `convex/facebook-ads/functions.ts` | Facebook Ad Library API |

**Pattern:** Extract the API-calling logic into shared helpers that both node creation and the tool can use.

### Documents Schema

```typescript
documents: defineTable({
  organizationId: v.string(),
  title: v.string(),
  content: v.string(), // markdown
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.string(), // userId
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_updated", ["organizationId", "updatedAt"])
```

### Chat Hub Query Optimization

```typescript
// Efficient approach: query chat nodes grouped by canvas
// Then join with canvas data
// Avoid N+1 by batching
```

---

## Data Flow

### Link Reading Tool
```
User sends message with URL
  ↓
AI decides to call readLink tool
  ↓
UI: Shows "Reading link..." loading state
  ↓
Tool: Detect platform from URL
  ↓
Tool: Call appropriate extraction helper (no DB write)
  ↓
UI: Shows extracted content card (title, platform, preview, link)
  ↓
Tool: Return structured content to AI
  ↓
AI: Incorporates content into response
```

### Chat Hub Navigation
```
User navigates to /chats
  ↓
Query: listCanvasesWithChats
  ↓
Display: List of canvases with chat metadata
  ↓
User clicks canvas
  ↓
Navigate: /canvas/{id}/chat (no full canvas load)
```

---

## Open Questions

1. Should the readLink tool support batch URLs (multiple in one call)?
2. Should documents have a "source canvas" reference for context?
3. Should chat hub show individual chat nodes or just canvas-level entries?
4. Rate limiting for link reading tool (Firecrawl/API costs)?

---

## Implementation Order

Recommended sequence for minimal dependencies:

1. ~~**US-DOC-001** - Documents schema (foundation)~~ ✅ DONE
2. ~~**US-DOC-002** - Documents CRUD (enables all doc features)~~ ✅ DONE
3. **US-DOC-003** - Documents list page (user-visible)
4. **US-DOC-004** - Document editor (core functionality)
5. **US-LR-001** - readLink tool (independent)
6. **US-LR-002** - Unsupported URL handling (polish)
7. **US-LR-003** - Tool display in chat UI (user-visible)
8. **US-CHAT-002** - Chat hub query (foundation for UI)
9. **US-CHAT-001** - Chat hub page (user-visible)
10. **US-NAV-001** - Dashboard chat links (quick win)
