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

(All Link Reading Tool stories completed - see completed-stories.md)

---

### Feature 2: Documents System

(All Document System stories completed - see completed-stories.md)

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

(US-CHAT-001 completed - see completed-stories.md)

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
3. ~~**US-DOC-003** - Documents list page (user-visible)~~ ✅ DONE
4. ~~**US-DOC-004** - Document editor (core functionality)~~ ✅ DONE
5. ~~**US-LR-001** - readLink tool (independent)~~ ✅ DONE
6. ~~**US-LR-002** - Unsupported URL handling (polish)~~ ✅ DONE
7. ~~**US-LR-003** - Tool display in chat UI (user-visible)~~ ✅ DONE
8. ~~**US-CHAT-002** - Chat hub query (foundation for UI)~~ ✅ DONE
9. ~~**US-CHAT-001** - Chat hub page (user-visible)~~ ✅ DONE
10. **US-NAV-001** - Dashboard chat links (quick win)
