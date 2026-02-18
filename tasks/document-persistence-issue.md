# Document Editor Persistence Issue

## Problem

When navigating away from a document and back, the formatted content (headings, lists, bold, etc.) does not persist - the editor appears empty even though the content was saved to the database.

## Root Cause

The `DocumentEditor` component uses `usePlateEditor` with `initialValue`. This only sets the editor value on **mount**. When React re-renders with new content from Convex (after the component has already mounted), the editor doesn't update because:

1. `usePlateEditor` ignores `value` changes after initial mount
2. The editor maintains its own internal state separate from React props

## Technical Details

**File:** `src/features/documents/components/document-editor.tsx`

```typescript
const editor = usePlateEditor({
  plugins: DocumentEditorKit,
  value: initialValue, // Only used on mount!
})
```

The Plate.js editor is created once with the initial value. Even though `$documentId.tsx` correctly loads content from Convex and passes it via `initialValue`, the editor doesn't reflect changes.

## Potential Solutions

### Option 1: Use `key` to force remount

```typescript
<DocumentEditor
  key={documentId} // Force remount when document changes
  initialValue={content}
  onChange={handleContentChange}
/>
```

**Pros:** Simple, works immediately
**Cons:** Loses editor state (undo history, selection) on every save

### Option 2: Use Plate's controlled mode with `value` prop

Need to investigate if Plate supports fully controlled mode where `value` prop updates the editor content.

### Option 3: Use editor API to set value on changes

```typescript
// In $documentId.tsx, when content loads from Convex:
React.useEffect(() => {
  if (document && editor) {
    editor.setValue(content)
  }
}, [document, editor])
```

**Issue:** Requires exposing `editor` instance from component

## Current Behavior

1. User creates document → opens with empty editor ✓
2. User types "# Heading" → autoformat creates H1 ✓
3. Auto-save triggers → content saved to Convex ✓
4. User navigates away → component unmounts
5. User returns → component remounts with loaded content
6. **Issue:** Editor shows empty instead of saved content

## Verified Working

- Content IS being saved to database (verified in Convex dashboard)
- Content IS being loaded by `$documentId.tsx` (logged correctly)
- The issue is purely in the Plate editor not receiving the loaded value

## Next Steps

1. Research Plate.js controlled mode or `value` prop behavior
2. Check existing editor implementations in codebase (`src/components/editor/plate-editor.tsx`)
3. Consider if `key={documentId}` approach is acceptable for MVP

## Related Files

- `src/routes/documents/$documentId.tsx` - Document editor page
- `src/routes/documents/index.tsx` - Document list page
- `src/features/documents/components/document-editor.tsx` - Plate editor wrapper
- `src/features/documents/plugins/document-editor-kit.ts` - Plugin configuration
- `convex/documents/functions.ts` - Backend CRUD
