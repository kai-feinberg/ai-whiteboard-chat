# Code Review: convex/chat/tools.ts - Exa Search Implementation

**Date:** 2026-02-01
**Reviewer:** Claude Opus 4.5
**File:** `/Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts`

## Stats

- Files Modified: 0
- Files Added: 1
- Files Deleted: 0
- New lines: 79
- Deleted lines: 0

## Summary

The implementation is solid and follows the reference pattern from `plans/deep-search.md` correctly. The code matches PRD requirements (US-FWS-001). Minor issues identified below.

---

## Issues Found

### Issue 1

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 57
issue: Redundant fallback for `id` property
detail: Per exa-js types, `id: string` is a required non-nullable field on SearchResult. The fallback `result.id || ""` is unnecessary.
suggestion: Use `id: result.id` directly.
```

### Issue 2

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 59
issue: Redundant fallback for `url` property
detail: Per exa-js types, `url: string` is a required non-nullable field on SearchResult. The fallback `result.url || ""` is unnecessary.
suggestion: Use `url: result.url` directly.
```

### Issue 3

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 58
issue: Inconsistent null handling for `title`
detail: The exa-js type defines `title: string | null`. Using `result.title || ""` handles null correctly but differs from the ExaSearchResult interface which declares `title: string`. This mismatch is fine but should be consistent.
suggestion: No change needed, but consider documenting that null titles become empty strings.
```

### Issue 4

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 34-37
issue: No input validation for query or numResults
detail: The function accepts any string for query (including empty strings) and any number for numResults (including 0, negative numbers, or very large values). The Exa API may handle these, but defensive validation would prevent unnecessary API calls.
suggestion: Add validation:
  - `if (!query.trim()) throw new Error("Search query cannot be empty")`
  - `numResults = Math.min(Math.max(numResults, 1), 100)` to clamp to reasonable range
```

### Issue 5

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 46-50
issue: Missing `livecrawl` option for fresher results
detail: Exa supports a `livecrawl` option that can fetch more recent content. The PRD doesn't require it, but it could be useful for time-sensitive queries.
suggestion: Consider adding as an optional parameter in future iterations.
```

### Issue 6

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 43
issue: New Exa client created on every function call
detail: Creating a new Exa client instance per request is fine for serverless functions, but worth noting for future optimization if this becomes a performance bottleneck.
suggestion: No change needed for Convex serverless environment. This is informational only.
```

---

## Positive Observations

1. **Error handling is well-structured** - Distinguishes between auth errors (401), rate limits (429), and generic errors
2. **Fail-safe defaults** - Uses sensible defaults for optional fields (undefined instead of empty strings for optional fields)
3. **Follows reference pattern** - Implementation matches `plans/deep-search.md` exactly
4. **Clean type definitions** - ExaSearchResult interface is well-documented
5. **Correct API usage** - Uses `searchAndContents` with `text: true`, `type: "auto"` as required by PRD

---

## Verification

No tests to run for this isolated function. Type checking should be performed via `pnpm typecheck`.

---

## Recommendation

**Approve with minor suggestions.** The implementation is correct and follows established patterns. Consider adding input validation (Issue 4) as a defensive measure before production use.
