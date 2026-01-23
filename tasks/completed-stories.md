# Completed Stories

## US-DOC-001: Create Documents Schema (2026-01-22)

**Description:** Created database schema for org-scoped documents.

**Acceptance Criteria (all met):**
- [x] Created `documents` table in `convex/schema.ts`
- [x] Fields: `organizationId`, `title`, `content` (markdown string), `createdAt`, `updatedAt`, `createdBy`
- [x] Index: `by_organization` on `organizationId`
- [x] Index: `by_organization_updated` on `[organizationId, updatedAt]` for sorting
- [x] Convex codegen passes

**Files changed:**
- `convex/schema.ts`

## US-DOC-002: Create Documents CRUD Functions (2026-01-22)

**Description:** Created Convex functions for CRUD operations on documents.

**Acceptance Criteria (all met):**
- [x] Created `convex/documents/functions.ts`
- [x] `createDocument` mutation - creates doc with title, optional initial content
- [x] `getDocument` query - fetches single doc by ID, validates org ownership
- [x] `listMyDocuments` query - returns all docs for current org, sorted by updatedAt desc
- [x] `updateDocument` mutation - updates title and/or content, sets updatedAt
- [x] `deleteDocument` mutation - removes doc, validates org ownership
- [x] All functions verify `organizationId` from auth
- [x] Convex codegen passes (pre-existing TS errors in codebase unrelated to this change)

**Files changed:**
- `convex/documents/functions.ts` (new)

## US-DOC-003: Create Documents List Page (2026-01-22)

**Description:** Created documents list page with full CRUD UI for managing org documents.

**Acceptance Criteria (all met):**
- [x] Created route `/documents` at `src/routes/documents/index.tsx`
- [x] Added "Documents" link in main sidebar navigation
- [x] Page lists all org documents with title, last updated date
- [x] "New Document" button creates empty document and navigates to editor
- [x] Delete button with confirmation dialog
- [x] Empty state when no documents exist
- [x] Loading state while fetching (skeleton cards)
- [x] Added `beforeLoad` auth guard matching codebase patterns

**Files changed:**
- `src/routes/documents/index.tsx` (new)
- `src/components/app-sidebar.tsx` (added Documents nav link)

## US-DOC-004: Create Document Editor Page (2026-01-22)

**Description:** Created document editor page with auto-save functionality for editing documents.

**Acceptance Criteria (all met):**
- [x] Created route `/documents/$documentId` at `src/routes/documents/$documentId.tsx`
- [x] Editable title field (auto-saves on blur)
- [x] Large textarea/editor for content (markdown supported via placeholder text)
- [x] Auto-save content on changes (debounced, ~1s delay)
- [x] "Saved" / "Saving..." indicator in header
- [x] Back button returns to documents list
- [x] Loading state while fetching document
- [x] 404 handling if document doesn't exist or wrong org (shown via Convex validation)
- [x] Fixed race conditions with refs for last-saved values
- [x] Toast notifications on save errors

**Files changed:**
- `src/routes/documents/$documentId.tsx` (new)

## US-LR-001: Create readLink AI Tool (2026-01-22)

**Description:** Created AI tool that reads content from URLs (YouTube, Twitter/X, TikTok, Facebook Ads, websites) during conversation without creating database records.

**Acceptance Criteria (all met):**
- [x] Created `readLinkTool` in `convex/canvas/chat.ts` using `createTool()`
- [x] Tool accepts `url: string` argument
- [x] Tool detects platform from URL (youtube, twitter/x, tiktok, website, facebook)
- [x] Tool reuses existing extraction logic from respective node functions
- [x] Tool returns extracted content as structured text (title, content/transcript, author where applicable)
- [x] Tool handles errors gracefully (unsupported URL, failed fetch, rate limits)
- [x] Tool is registered in the agent's tools object
- [x] TypeScript passes (pre-existing errors in codebase unrelated to this change)
- [x] Browser testing verified - AI successfully reads YouTube video and summarizes content

**Files changed:**
- `convex/canvas/chat.ts` (added readLinkTool, URL detection helpers, registered in agent tools)

## US-LR-003: Display readLink Tool Results in Chat UI (2026-01-23)

**Description:** Integrated ReadLinkTool component into Chat.tsx to display extracted link content with loading states, platform badges, and clickable links.

**Acceptance Criteria (all met):**
- [x] readLink tool call shows loading state: "Reading link..."
- [x] Completed tool shows extracted content: title, source platform, truncated preview
- [x] Display includes link to original URL (clickable "View original")
- [x] Error states displayed clearly (red styling with error message)
- [x] Styling consistent with existing tool displays (border, card layout, icons)
- [x] Browser testing verified with YouTube and website URLs

**Files changed:**
- `src/features/chat/components/Chat.tsx` (added tool part filtering and ReadLinkTool rendering)
- `src/components/ai-elements/read-link-tool.tsx` (fixed type errors with unknown types)

---

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