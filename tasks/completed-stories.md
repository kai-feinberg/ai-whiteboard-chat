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

## US-LR-002: Handle Unsupported URLs Gracefully (2026-01-23)

**Description:** Improved error handling for the readLink tool to provide helpful feedback about supported platforms when URLs fail or are invalid.

**Acceptance Criteria (all met):**
- [x] Tool returns helpful message listing supported platforms when URL not recognized
- [x] Supported platforms: YouTube, Twitter/X, TikTok, Facebook Ads, general websites (via Firecrawl)
- [x] Tool does NOT crash or throw unhandled errors
- [x] Convex typecheck passes (pre-existing frontend errors unrelated)
- [x] Browser testing verified - AI responds helpfully with supported platforms when given invalid URL

**Files changed:**
- `convex/canvas/chat.ts` (added SUPPORTED_PLATFORMS_MSG constant, updated 3 error messages)

---

## US-CHAT-002: Create Chat Query for Hub (2026-01-23)

**Description:** Created a Convex query that returns canvases with their chat metadata for the chat hub.

**Acceptance Criteria (all met):**
- [x] Created `listCanvasesWithChats` query in `convex/canvas/functions.ts`
- [x] Returns canvases that have at least one chat node
- [x] Includes: canvasId, canvasName, chatNodeCount, lastMessageTimestamp
- [x] Sorted by lastMessageTimestamp descending
- [x] Efficiently queries using indexes (no N+1 - uses batch Promise.all for canvases and threads via by_canvas index)
- [x] Convex typecheck passes

**Implementation Notes:**
- Queries canvas_nodes by organization and filters for nodeType="chat"
- Groups nodes by canvasId and counts them
- Batch fetches canvases and threads using Promise.all
- Uses threads.by_canvas index to get ALL thread activity (not just selectedThreadId)
- Falls back to canvas.updatedAt if no threads exist

**Files changed:**
- `convex/canvas/functions.ts` (added listCanvasesWithChats query)

---

## US-CHAT-001: Create Chat Hub Page (2026-01-23) - SUPERSEDED BY US-NAV-001

**Description:** Created dedicated chat hub page for quickly switching between canvas conversations without loading full canvas editor.

**Status:** REMOVED - Replaced by US-NAV-001 which adds chat button directly to canvas cards on dashboard. The `/chats` route was deleted and sidebar link removed.

**Original Acceptance Criteria (all were met before removal):**
- [x] Created route `/chats` at `src/routes/chats/index.tsx`
- [x] Added "Chats" link in main navigation (sidebar)
- [x] Page lists all canvases that have chat nodes
- [x] Each item shows: canvas name, chat node count, relative time (e.g., "32m ago")
- [x] Clicking item navigates to `/canvas/{canvasId}/chat`
- [x] Items sorted by most recent activity (lastMessageTimestamp descending)
- [x] Empty state when no chats exist (MessageSquare icon + "No chats yet")
- [x] Loading state with skeleton cards

**Files changed (then deleted):**
- `src/routes/chats/index.tsx` (DELETED in US-NAV-001)
- `src/components/app-sidebar.tsx` (Chats nav link REMOVED in US-NAV-001)

---

## US-NAV-001: Add Chat Link to Canvas Cards (2026-01-23)

**Description:** Added quick access chat button to canvas cards on the dashboard, allowing users to jump directly to canvas chat without opening the full canvas editor. This replaces the separate `/chats` page with a more direct workflow.

**Acceptance Criteria (all met):**
- [x] Added chat icon/button (MessageSquare) to each canvas card on dashboard
- [x] Button navigates to `/canvas/{canvasId}/chat`
- [x] Button has tooltip "Open Chat" (via title attribute)
- [x] Button only appears if canvas has at least one chat node (optional optimization implemented)
- [x] `pnpm typecheck` passes (pre-existing frontend errors unrelated)
- [x] Browser testing verified with agent-browser

**Implementation Notes:**
- Extended `listCanvases` query to include `hasChatNodes` boolean for each canvas
- Query efficiently checks chat nodes in single pass by querying canvas_nodes with nodeType="chat" filter
- Button uses green hover styling to differentiate from rename (blue) and delete (red) buttons
- Removed `/chats` route and sidebar link as this provides equivalent functionality with less navigation
- Also removed now-unused `listCanvasesWithChats` query (dead code after /chats removal)

**Files changed:**
- `convex/canvas/functions.ts` (updated listCanvases to include hasChatNodes, removed listCanvasesWithChats)
- `src/routes/index.tsx` (added MessageSquare button to canvas cards)
- `src/routes/chats/index.tsx` (DELETED)
- `src/components/app-sidebar.tsx` (removed Chats nav link)

---

## US-NAV-002: Add Canvas Switcher Dropdown to Chat Page Header (2026-01-23)

**Description:** Added a dropdown to the chat page header that allows users to quickly switch between different canvas conversations without returning to the dashboard.

**Acceptance Criteria (all met):**
- [x] Dropdown shows in chat page header next to the current canvas name
- [x] Dropdown lists all canvases that have at least one chat node
- [x] Current canvas is visually highlighted in the dropdown (checkmark icon)
- [x] Clicking a canvas navigates to `/canvas/{canvasId}/chat`
- [x] Dropdown shows canvas names sorted by most recent activity (updatedAt desc)
- [x] Loading state while fetching canvas list (spinner)
- [x] Empty state if no other canvases with chats exist ("No other canvases with chats")
- [x] After switching canvas, first thread is automatically selected so chat loads immediately

**Implementation Notes:**
- Created `listCanvasesWithChats` query in `convex/canvas/functions.ts`
- Query efficiently fetches canvases by first getting chat nodes, then batching canvas lookups
- Added organization ownership verification in the query
- Used shadcn DropdownMenu component for the UI
- Button shows canvas title with ChevronDown icon as dropdown trigger
- Added useEffect to reset `selectedThreadId` when `canvasId` changes, triggering auto-select of first thread

**Files changed:**
- `convex/canvas/functions.ts` (added listCanvasesWithChats query)
- `src/routes/canvas/$canvasId/chat.tsx` (added dropdown to header)

---

## US-LR-004: Enhanced Link Reading Tool Loading Indicator and Full Content Modal (2026-01-23)

**Description:** Improved the ReadLinkTool component with a better loading indicator and a modal to view the full extracted content/transcript.

**Acceptance Criteria (all met):**
- [x] Loading state shows spinner icon (Loader2Icon) instead of clock icon
- [x] Loading state displays URL being fetched and progress bar animation
- [x] Loading state card has primary border/background tint for visibility
- [x] "Fetching content..." text displayed during loading
- [x] "View full content" button appears when transcript is longer than 200 characters
- [x] Clicking "View full content" opens modal with full transcript
- [x] Modal shows platform icon, title, author (if available), and scrollable full text
- [x] Modal includes "View original source" link at bottom
- [x] Modal has proper accessibility (DialogDescription for screen readers)

**Implementation Notes:**
- Replaced ClockIcon with Loader2Icon (animate-spin) for clearer loading indicator
- Added progress bar animation with pulse effect
- Used shadcn Dialog component for the full content modal
- Added `getFullText()` helper to extract complete text without truncation
- Hoisted computed values (author, preview, title) to avoid redundant function calls
- Added DialogDescription with sr-only class for accessibility compliance

**Files changed:**
- `src/components/ai-elements/read-link-tool.tsx` (enhanced loading state, added modal)

