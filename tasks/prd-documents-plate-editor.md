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
- [x] Initialize editor with document content (handle null/undefined as `EMPTY_VALUE`)
- [x] Implement debounced auto-save (1000ms delay) using `onChange` callback
- [x] Track save status (idle/saving/saved) and display in header
- [x] Handle title editing on blur via separate mutation call
- [x] Loading state shows spinner while document fetches
- [x] 404 state handled (existing behavior)
- [x] Content persists on page refresh (verified working)
- [x] `pnpm typecheck` passes

---

## Functional Requirements

- **FR-DOC-1:** Document content stored as Plate JSON Value (`v.any()` in schema)
- **FR-DOC-2:** Editor supports: H1-H6, paragraphs, bullet lists, numbered lists, blockquotes
- **FR-DOC-3:** Editor supports marks: bold, italic, strikethrough, underline, inline code
- **FR-DOC-4:** Content auto-saves with 1000ms debounce via `updateDocument` mutation
- **FR-DOC-5:** Save status visible in header: 'idle' → 'saving' → 'saved'
- **FR-DOC-6:** Title saves on blur via separate mutation call
- **FR-DOC-7:** New documents created with `EMPTY_PLATE_VALUE: [{ type: 'p', children: [{ text: '' }] }]`
- **FR-DOC-8:** Document list page unchanged

## Non-Goals (Out of Scope)

- AI assistant integration (future)
- Comments and suggestions (future)
- Media uploads/images (future)
- Tables, columns, math equations
- Table of contents
- Real-time collaboration (single-user only)
- Export to PDF/DOCX
- Document templates
- Version history
- Migration of existing markdown content (user will delete test data)

## Implementation Notes

### Persistence Strategy

**Content Storage:**

- Stored as Plate JSON Value in Convex `documents` table
- Field type: `v.optional(v.any())` - optional to handle legacy documents
- Empty content default: `[{ type: 'p', children: [{ text: '' }] }]`

**Auto-Save Mechanism:**

- Debounced 1000ms via React useEffect
- Status tracking: 'idle' → 'saving' → 'saved'
- Refs track last saved content to prevent redundant saves
- Error handling with toast notifications

**State Management:**

- Parent component (`$documentId.tsx`) manages `content` state
- `DocumentEditor` is controlled component (receives `initialValue` and `onChange`)
- `usePlateEditor` initialized once with `initialValue`
- Editor re-renders when parent passes new `initialValue` (via key prop pattern)

**Edge Cases Handled:**

- Documents with `null`/`undefined` content → defaults to `EMPTY_VALUE`
- Rapid typing → debounce prevents excessive mutation calls
- Concurrent saves → `pendingSavesRef` counter prevents status flicker
- Navigation away → React cleanup ensures pending saves complete

## Design Considerations

- Editor should feel lightweight and fast (minimal UI chrome)
- Use existing `Editor` and `EditorContainer` components for consistency
- Toolbar: Consider minimal fixed toolbar vs floating toolbar vs none (markdown shortcuts only)
- For MVP: Start with no visible toolbar
- Future: Add floating toolbar on text selection, keyboard shortcuts, and autoformat

## Technical Considerations

### Schema Change

```typescript
// convex/documents/functions.ts

// Schema field
content: v.optional(v.any()) // Plate Value type (array of nodes)

// createDocument accepts optional content
createDocument({
  args: {
    title: v.string(),
    content: v.optional(v.any()), // undefined or Plate Value
  },
})

// updateDocument accepts optional content
updateDocument({
  args: {
    documentId: v.id('documents'),
    title: v.optional(v.string()),
    content: v.optional(v.any()),
  },
})
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

Parent component manages state and debounced save:

```typescript
// In $documentId.tsx
const [content, setContent] = React.useState<Value>(EMPTY_VALUE)
const [saveStatus, setSaveStatus] = React.useState<'saved' | 'saving' | 'idle'>('idle')

// Debounced auto-save effect
React.useEffect(() => {
  const timeoutId = setTimeout(async () => {
    setSaveStatus('saving')
    await updateDocument({ documentId, content })
    setSaveStatus('saved')
  }, 1000)
  return () => clearTimeout(timeoutId)
}, [content])

// Editor component
<DocumentEditor
  initialValue={content}
  onChange={(value) => {
    setContent(value)
    setSaveStatus('idle')
  }}
/>
```

### Default Empty Value

```typescript
const EMPTY_VALUE: Value = [{ type: 'p', children: [{ text: '' }] }]
```

Used when:

- Creating new documents (passed to `createDocument`)
- Loading documents with null/undefined content

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
Creating document (index.tsx):
  ↓
Click "New Document" button
  ↓
createDocument({ title: 'Untitled Document', content: EMPTY_PLATE_VALUE })
  ↓
Navigate to /documents/{id}

Editing document ($documentId.tsx):
  ↓
Load: getDocument(id) → { title, content: Value | undefined }
  ↓
Initialize state: content = document.content ?? EMPTY_VALUE
  ↓
Render: <DocumentEditor initialValue={content} onChange={handleChange} />
  ↓
User types → onChange → setContent(value) + setSaveStatus('idle')
  ↓
useEffect debounce 1000ms → updateDocument({ documentId, content })
  ↓
On success: setSaveStatus('saved')

Title editing:
  ↓
Input onBlur → updateDocument({ documentId, title })
```

## File Structure

```
src/features/documents/
├── components/
│   └── document-editor.tsx       # Plate.js editor wrapper
├── plugins/
│   └── document-editor-kit.ts    # Plugin configuration

src/routes/documents/
├── index.tsx                     # Document list + creation
└── $documentId.tsx               # Editor page with persistence logic

convex/documents/
└── functions.ts                  # CRUD operations with JSON content
```

## Open Questions

1. Should we add a minimal toolbar or rely solely on keyboard shortcuts? → **MVP: No toolbar**
2. Should there be a read-only view mode toggle? → **Future enhancement**
3. Should we show character/word count? → **Future enhancement**

## Summary

The Plate.js editor migration is **complete** and **fully functional**:

- Content persists correctly as Plate JSON in Convex
- Auto-save works with 1000ms debounce
- Save status (idle/saving/saved) visible in header
- Empty documents initialize with placeholder paragraph
- Title editing saves on blur
- Loading and error states handled
- TypeScript type checking passes

**Known Limitations:**

- No visible toolbar (keyboard shortcuts only)
- No autoformat/markdown shortcuts
- No read-only view mode
- Single-user editing only (no real-time collaboration)
