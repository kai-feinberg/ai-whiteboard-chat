# Code Review: convex/documents/functions.ts

**Date:** 2026-01-22  
**Reviewer:** Claude Opus 4.5  
**Related Story:** US-DOC-002 (Documents CRUD Functions)

---

## Stats

- Files Modified: 0
- Files Added: 1
- Files Deleted: 0
- New lines: 178
- Deleted lines: 0

---

## Summary

The `convex/documents/functions.ts` file implements CRUD operations for organization-scoped documents. The implementation follows established patterns from `convex/canvas/functions.ts` and adheres to the PRD requirements for US-DOC-002.

---

## Issues Found

### No Critical Issues

Code review passed for security and logic. The implementation correctly:
- Validates authentication in all functions
- Verifies `organizationId` exists and is a string
- Checks organization ownership before returning/modifying data
- Uses proper indexes for queries

---

### Medium Severity

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/documents/functions.ts
line: 19
issue: Unused variable `userId` in createDocument
detail: The `userId` is extracted but stored as `createdBy` - this is fine, but the variable name mismatch could confuse future readers. The canvas pattern uses `userId` directly in the insert.
suggestion: Either rename to match usage or use directly: `createdBy: identity.subject`
```

---

### Low Severity

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/documents/functions.ts
line: 43-69
issue: getDocument naming convention inconsistency
detail: Per CLAUDE.md naming conventions, `get` prefix should guarantee non-null return (throws if null). However, this function returns `null` when document not found (line 60-61), which matches `find` prefix behavior. Compare to canvas `getCanvas` which also returns null - this is a codebase-wide pattern inconsistency.
suggestion: Either rename to `findDocument` or throw error when document is null for consistency with naming conventions. Given canvas uses same pattern, this is acceptable for codebase consistency but worth noting.
```

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/documents/functions.ts
line: 128
issue: Type annotation could be more specific
detail: The `updates` object uses a manual type annotation. This works but could benefit from using Partial<Document> or a more specific type from the schema.
suggestion: Consider using schema-derived types for stronger type safety. Current approach is acceptable.
```

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/documents/functions.ts
line: 141, 175
issue: Return type consistency
detail: `updateDocument` and `deleteDocument` return `{ success: true }` which matches canvas patterns. However, `updateDocument` could optionally return the updated document for client convenience.
suggestion: Keep current pattern for consistency with canvas. Could enhance later if needed.
```

---

## Pattern Compliance Check

| Pattern | Status | Notes |
|---------|--------|-------|
| Auth check (identity null) | PASS | All 5 functions check |
| OrganizationId validation | PASS | All 5 functions validate string type |
| Ownership verification | PASS | get/update/delete verify org matches |
| Index usage | PASS | Uses `by_organization_updated` for listing |
| Error messages | PASS | Clear, user-friendly messages |
| Timestamps | PASS | `createdAt` and `updatedAt` handled |

---

## Comparison with canvas/functions.ts

| Aspect | canvas | documents | Match |
|--------|--------|-----------|-------|
| Auth pattern | Throw if !identity | Throw if !identity | YES |
| OrgId check | `!organizationId \|\| typeof !== "string"` | Same | YES |
| Ownership check | `if (canvas.organizationId !== organizationId)` | Same pattern | YES |
| List query | Uses `by_org_updated` index, order desc | Uses `by_organization_updated` index, order desc | YES |
| Update return | `{ success: true }` | `{ success: true }` | YES |
| Delete return | `{ success: true }` | `{ success: true }` | YES |

---

## Schema Validation

Verified against `convex/schema.ts` (lines 244-254):

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

All fields properly handled in CRUD operations:
- `createDocument`: Sets all required fields
- `getDocument`: Returns full document
- `listMyDocuments`: Uses correct composite index
- `updateDocument`: Updates title/content + updatedAt
- `deleteDocument`: Removes document

---

## PRD Acceptance Criteria Check (US-DOC-002)

- [x] Create `convex/documents/functions.ts`
- [x] `createDocument` mutation - creates doc with title, optional initial content
- [x] `getDocument` query - fetches single doc by ID, validates org ownership
- [x] `listMyDocuments` query - returns all docs for current org, sorted by updatedAt desc
- [x] `updateDocument` mutation - updates title and/or content, sets updatedAt
- [x] `deleteDocument` mutation - removes doc, validates org ownership
- [x] All functions verify `organizationId` from auth

---

## Recommendations

1. **No blocking issues** - Code can proceed to typecheck and integration testing
2. **Consider** adding a `_FEATURE.md` file for the documents feature documenting the functions
3. **Future enhancement**: Consider adding soft delete with `deletedAt` timestamp if document recovery becomes a requirement

---

## Verdict

**Code review passed.** Implementation is correct, secure, and follows codebase patterns. The medium/low severity items are suggestions for consistency rather than bugs.
