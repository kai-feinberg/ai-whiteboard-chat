# PRD: Documents Plate.js Editor Migration

## Introduction

Migrate the documents feature from a basic Textarea to a full Plate.js rich text editor. Currently, documents store plain text/markdown in a simple string field. This migration will:

1. Replace the Textarea with a Plate.js editor
2. Change the storage format from string to JSON (Plate Value type)
3. Enable core rich text formatting (headings, lists, bold, italic, code, blockquotes)
4. Support real-time auto-save with debouncing

This enables users to create properly formatted documents with visual styling instead of raw markdown.

## Goals

- Replace Textarea with Plate.js editor in document editor page
- Store content as Plate JSON Value instead of markdown string
- Enable core formatting: headings (H1-H6), lists (bullet, numbered), bold, italic, strikethrough, code, blockquotes
- Maintain existing auto-save behavior with debouncing
- Keep existing document list UI unchanged

## User Stories

### US-DOC-001: Update Convex schema and functions for JSON content

**Description:** As a developer, I need to update the Convex schema to store Plate JSON content instead of markdown strings.

**Status:** ✅ COMPLETED (2026-02-18)

**Acceptance Criteria:**

- [x] Change `content` field type from `v.string()` to `v.any()` in schema
- [x] Update `createDocument` to accept optional `content: v.any()`
- [x] Update `updateDocument` to accept `content: v.any()`
- [x] `getDocument` returns JSON content correctly
- [x] All functions maintain organization scoping and auth checks
- [x] `pnpm typecheck` passes

---

### US-DOC-002: Create document-specific Plate editor component

**Description:** As a developer, I need to create a reusable Plate editor component specifically for documents with core formatting plugins only.

**Status:** ✅ COMPLETED (2026-02-18)

**Acceptance Criteria:**

- [x] Create `src/features/documents/components/document-editor.tsx`
- [x] Component accepts props: `initialValue: Value`, `onChange: (value: Value) => void`, `readOnly?: boolean`
- [x] Create `src/features/documents/plugins/document-editor-kit.ts` with subset of plugins:
  - BasicBlocksKit (headings, paragraphs, blockquotes)
  - BasicMarksKit (bold, italic, strikethrough, code, underline)
  - ListKit (bullet and numbered lists)
  - AutoformatKit (markdown shortcuts like `# `, `* `, `1. `)
  - BlockPlaceholderKit (placeholder text)
- [x] Exclude: AI, comments, suggestions, media uploads, tables, TOC, columns, math
- [x] Use `Editor` and `EditorContainer` from existing UI components
- [x] Component is controlled (value managed by parent)
- [x] `pnpm typecheck` passes

---

### US-DOC-003: Create document editor page with Plate integration

**Description:** As a user, I want to edit documents with a rich text editor that auto-saves my changes.

**Status:** ✅ COMPLETED (2026-02-18)

**Acceptance Criteria:**

- [x] Replace Textarea with DocumentEditor component
- [x] Initialize editor with document content (handle null/undefined as empty array)
- [x] Implement debounced auto-save (1000ms delay) using `onChange` callback
- [x] Track save status (saving/saved) and display in header
- [x] Handle title editing on blur (existing behavior)
- [x] Loading state shows skeleton while document fetches
- [x] 404 state handled (existing behavior)
- [x] `pnpm typecheck` passes
- [ ] Verify in browser using agent-browser skill:
  - Create new document
  - Add formatted text (heading, bold, list)
  - Verify auto-save triggers
  - Refresh page and confirm content persists

**Note:** Browser verification blocked by Plate.js persistence issue - see `tasks/document-persistence-issue.md` for details. The editor works for the current session but content doesn't load when navigating back to a document.

---

### US-DOC-004: Update document creation with default content

**Description:** As a user, when I create a new document, it should open with an empty Plate editor ready for input.

**Required Reading:**

- `convex/documents/functions.ts` → `createDocument` function
- `src/routes/documents/index.tsx` → document list and creation

**Acceptance Criteria:**

- [ ] New documents created with default empty Plate value: `[{ type: 'p', children: [{ text: '' }] }]`
- [ ] Document opens immediately in editor (existing behavior)
- [ ] `pnpm typecheck` passes

---

### US-DOC-005: Add read-only document view mode

**Description:** As a user, I want to view documents in read-only mode without accidentally editing them.

**Required Reading:**

- `src/components/ui/editor.tsx` → `EditorView` component
- Plate.js docs on read-only mode

**Acceptance Criteria:**

- [ ] Add `readOnly` prop to DocumentEditor component
- [ ] When `readOnly={true}`, render using `EditorView` instead of `Editor`
- [ ] Read-only mode shows formatted content without editing capability
- [ ] (Optional) Add toggle button in header to switch between edit/view modes
- [ ] `pnpm typecheck` passes
- [ ] Verify in browser using agent-browser skill

---

### US-DOC-006: Add keyboard shortcuts and autoformatting

**Description:** As a user, I want to use markdown shortcuts and keyboard shortcuts for formatting.

**Required Reading:**

- `src/components/editor/plugins/autoformat-kit.tsx` → existing autoformat rules
- `src/components/editor/plugins/basic-marks-kit.tsx` → mark shortcuts

**Acceptance Criteria:**

- [ ] Markdown shortcuts work:
  - `# ` → H1, `## ` → H2, etc.
  - `* ` or `- ` → bullet list
  - `1. ` → numbered list
  - `> ` → blockquote
  - `\`code\`` → inline code (if supported by autoformat)
- [ ] Keyboard shortcuts work:
  - `Cmd/Ctrl+B` → bold
  - `Cmd/Ctrl+I` → italic
  - `Cmd/Ctrl+U` → underline
  - `Cmd/Ctrl+E` → inline code (if configured)
- [ ] `pnpm typecheck` passes
- [ ] Verify in browser using agent-browser skill

## Functional Requirements

- **FR-DOC-1:** Document content must be stored as Plate JSON Value format
- **FR-DOC-2:** Editor must support: H1-H6, paragraphs, bullet lists, numbered lists, blockquotes
- **FR-DOC-3:** Editor must support marks: bold, italic, strikethrough, underline, inline code
- **FR-DOC-4:** Changes must auto-save with 1000ms debounce
- **FR-DOC-5:** Save status must be visible in header (saving/saved)
- **FR-DOC-6:** Title editing must save on blur (existing behavior)
- **FR-DOC-7:** New documents must initialize with empty paragraph
- **FR-DOC-8:** Document list page must remain unchanged
- **FR-DOC-9:** Markdown autoformat shortcuts must work during typing
- **FR-DOC-10:** Keyboard shortcuts must work for marks

## Non-Goals (Out of Scope)

- AI assistant integration (future)
- Comments and suggestions (future)
- Media uploads/images (future)
- Tables, columns, math equations
- Table of contents
- Real-time collaboration
- Export to PDF/DOCX
- Document templates
- Version history
- Migration of existing markdown content (user will delete test data)

## Design Considerations

- Editor should feel lightweight and fast (minimal UI chrome)
- Use existing `Editor` and `EditorContainer` components for consistency
- Toolbar: Consider minimal fixed toolbar vs floating toolbar vs none (markdown shortcuts only)
- For MVP: Start with no visible toolbar, rely on keyboard/autoformat shortcuts
- Future: Add floating toolbar on text selection

## Technical Considerations

### Schema Change

```typescript
// Before
content: v.string()

// After
content: v.any() // Plate Value type (array of nodes)
```

### Plate Editor Setup

```typescript
import { usePlateEditor } from 'platejs/react'
import { DocumentEditorKit } from './plugins/document-editor-kit'

const editor = usePlateEditor({
  plugins: DocumentEditorKit,
  value: document.content || [{ type: 'p', children: [{ text: '' }] }],
})
```

### Controlled Editor Pattern

```typescript
<Plate editor={editor} onChange={({ value }) => {
  debouncedSave(value);
}}>
  <EditorContainer>
    <Editor />
  </EditorContainer>
</Plate>
```

### Default Empty Value

```typescript
const EMPTY_VALUE = [{ type: 'p', children: [{ text: '' }] }]
```

### Plugin Subset

Include only from full EditorKit:

- BasicBlocksKit
- BasicMarksKit
- ListKit
- AutoformatKit
- BlockPlaceholderKit
- TrailingBlockPlugin

Exclude:

- AIKit, CopilotKit
- CommentKit, DiscussionKit, SuggestionKit
- MediaKit, DndKit
- TableKit, ColumnKit, MathKit, TocKit
- MentionKit, EmojiKit, DateKit, LinkKit

## Data Flow

```
User navigates to /documents/{id}
  ↓
Convex query: getDocument(id) → { title, content: Value }
  ↓
DocumentEditor receives initialValue
  ↓
usePlateEditor initializes with value
  ↓
User types/formats content
  ↓
onChange fires with new Value
  ↓
Debounce 1000ms → Convex mutation: updateDocument({ documentId, content })
  ↓
Header shows "Saved" status
  ↓
On page leave/reload, final save completes
```

## File Structure

```
src/features/documents/
├── README.md
├── components/
│   └── document-editor.tsx
├── plugins/
│   └── document-editor-kit.ts
└── types.ts

convex/documents/
├── functions.ts (update schema usage)
└── _FEATURE.md (create/update)
```

## Open Questions

1. Should we add a minimal toolbar or rely solely on keyboard shortcuts? → **MVP: No toolbar, keyboard only**
2. Should there be a read-only view mode toggle? → **Optional for MVP**
3. Should we show character/word count? → **Future enhancement**
