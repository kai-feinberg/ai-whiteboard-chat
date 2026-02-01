# Code Review: WebSearchTool Component (US-UI-004)

**Date:** 2026-02-01  
**File:** `/Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx`  
**Reviewer:** Claude Opus 4.5

---

## Stats

- Files Modified: 1
- Files Added: 0
- Files Deleted: 0
- New lines: 222
- Deleted lines: 0

---

## Summary

The `WebSearchTool` component implementation is solid overall. It follows the established TikTok pattern, implements two-phase loading, and handles collapsible sections well. However, there are a few logic errors and PRD deviations that should be addressed.

---

## Issues Found

### Critical

*None*

---

### High Severity

```
severity: high
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx
line: 251-255
issue: Two-phase loading logic is broken - always shows "filtering" when output exists
detail: The loading phase logic checks if searchTime > 0 or filterTime > 0, but during the actual loading state (input-streaming/input-available), output is typically undefined or doesn't have timing data yet. The logic will always show "searching" during loading since output?.searchTime will be undefined. The comment says "searchTime present but filterTime 0 means still filtering" but then hasSearchStarted results in "filtering" phase, not "searching".

More critically, if hasFilterStarted is true, it shows "filtering", but if hasSearchStarted is true (but hasFilterStarted is false), it ALSO shows "filtering". This means the first phase ("searching") can only be shown when NEITHER has started, which defeats the purpose of two-phase indication.

suggestion: The two-phase loading needs access to streaming/partial output during tool execution. If the tool backend sends partial updates with searchTime before filterTime, that data needs to be available. Otherwise, consider using a simpler approach like the TikTok component (single phase) or use elapsed time heuristics. Current logic: hasSearchStarted -> "filtering", hasFilterStarted -> "filtering" - both paths lead to same output.
```

---

### Medium Severity

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx
line: 226
issue: PRD says results should start EXPANDED, not collapsed
detail: PRD states under "Collapsible Behavior": "Starts expanded to show results. User can collapse to minimize space after reviewing." The current implementation sets `isCollapsed = true` (collapsed by default). The comment references TikTokSearchTool pattern, but this may deviate from the PRD for WebSearchTool specifically.
suggestion: Change line 226 from `useState(true)` to `useState(false)` to start expanded per PRD requirements. Verify with product if TikTok pattern is intentionally different.
```

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx
line: 339
issue: Using index as fallback key when result.url may be undefined
detail: The key uses `result.url || index`. If multiple results have undefined URLs, this could cause rendering issues as index alone isn't stable when items reorder. However, in practice, URLs should always be present from Exa API.
suggestion: Consider logging a warning if result.url is missing since it indicates malformed data from the API. The current fallback is acceptable but masks potential upstream issues.
```

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx
line: 192-196
issue: ToolState type duplicated from TikTok component
detail: The ToolState type is defined identically in both tiktok-results.tsx (line 176) and web-search-results.tsx (line 192). This violates DRY and can lead to drift if one is updated.
suggestion: Extract ToolState to a shared types file (e.g., `src/components/ai-elements/types.ts`) and import in both components.
```

---

### Low Severity

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx
line: 344-348
issue: Inconsistent empty state message when results are expanded but empty
detail: When accepted.length === 0 but the collapsible is expanded, it shows the message. However, if a user expands the section expecting results and sees "No results passed quality filters", this is correct behavior but the UX could be improved by showing this info in the collapsed header instead.
suggestion: Consider adding "(no results)" to the header text when accepted.length === 0, e.g., "0 results found" which is already shown. This is acceptable as-is.
```

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx
line: 46-48
issue: XSS potential in decodeHtmlEntities using textarea.innerHTML
detail: The textarea.innerHTML assignment for HTML entity decoding is a common pattern but could theoretically execute scripts if the text contains certain payloads. However, since this is only used for display (not insertion into DOM as HTML), the risk is minimal - React's JSX will escape the decoded output.
suggestion: No change needed - the decoded value is used in JSX text content which escapes it. Just noting for awareness.
```

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/components/ai-elements/web-search-results.tsx
line: 359
issue: Rejected section trigger missing keyboard focus styling
detail: The rejected section CollapsibleTrigger has hover:text-foreground but no explicit focus-visible styling. The main accepted section trigger has focus-visible:ring-2 (indirectly via the parent component).
suggestion: Add `focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded` to the rejected CollapsibleTrigger for consistent keyboard navigation experience.
```

---

## Comparison with TikTokSearchTool Pattern

| Aspect | TikTokSearchTool | WebSearchTool | Consistent? |
|--------|-----------------|---------------|-------------|
| Collapsed by default | Yes (line 204) | Yes (line 226) | Yes |
| ToolState type | Defined locally | Defined locally | Yes (DRY violation) |
| Loading phases | Single phase | Two phases | Different (per PRD) |
| Error handling | Same pattern | Same pattern | Yes |
| Input parsing | Same logic | Same logic | Yes |
| Aria labels | Present | Present | Yes |
| Chevron animation | -rotate-90 when collapsed | -rotate-90 when collapsed | Yes |

---

## Accessibility Review

**Good:**
- Aria-labels on collapsible triggers describing state
- Focus-visible ring on WebSearchCard links
- Semantic button elements for triggers
- Alt text on images with fallback to empty string for favicons (decorative)

**Could Improve:**
- Rejected section trigger lacks explicit focus styling
- Consider `role="region"` with aria-label for the results container
- Screen reader announcements when loading state changes (live region)

---

## Edge Cases Checked

| Edge Case | Handled? | Notes |
|-----------|----------|-------|
| Empty accepted results | Yes | Shows message from output or fallback |
| Empty rejected results | Yes | Section hidden entirely |
| No query in input | Yes | Query display section hidden |
| Image load failure | Yes | imgError state hides image |
| Favicon load failure | Yes | Falls back to GlobeIcon |
| Missing title | Yes | Falls back to "Untitled" |
| Missing summary | Yes | Section hidden |
| Future dates | Yes | formatRelativeDate handles gracefully |
| Invalid dates | Yes | Returns null, section hidden |
| SSR context | Yes | decodeHtmlEntities has SSR guard |

---

## Recommendations

1. **Fix two-phase loading logic** (High) - The current implementation doesn't actually distinguish phases correctly. Either remove the two-phase concept or implement proper partial state streaming from the tool.

2. **Verify collapsed-by-default with product** (Medium) - PRD says "starts expanded" but implementation is collapsed. Clarify intent.

3. **Extract shared ToolState type** (Medium) - Create shared types file to prevent duplication.

4. **Add focus styling to rejected trigger** (Low) - Keyboard accessibility improvement.

---

## Passing Checks

- Responsive grid layout: 1/2/3 columns implemented correctly
- Error state styling and message display
- Collapsible behavior for both accepted and rejected sections
- HTML entity decoding with SSR safety
- Relative date formatting with edge case handling
- Consistent styling with TikTok component pattern
- Image error handling with graceful fallbacks
