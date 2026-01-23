# Code Review: Document Editor Implementation

**Date:** 2026-01-22
**Files Reviewed:**
- `/Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx`
- `/Users/kai/Desktop/projects/ai-whiteboard-chat/convex/documents/functions.ts`

## Stats

- Files Modified: 0
- Files Added: 2 (documents feature files)
- Files Deleted: 0
- New lines: ~394 (documents feature)
- Deleted lines: 0

---

## Issues Found

### CRITICAL

```
severity: critical
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 50-70
issue: Auto-save race condition - stale closure can cause data loss
detail: The debounced save effect uses `document.content` in the comparison (line 54), but 
        `document` is from a real-time Convex subscription that updates independently. When user 
        types rapidly:
        1. User types "abc", content state = "abc"
        2. Debounce timer starts (1s)
        3. Convex sync receives another user's update, document.content = "xyz"
        4. Timer fires, compares content ("abc") !== document.content ("xyz"), saves "abc"
        5. Other user's changes are overwritten
        
        Also: if user types "abc", then types "abcd" before 1s, the first timeout is cleared,
        but `document.content` in the new closure might already be "abc" from a completed save,
        causing comparison to pass when it shouldn't.
suggestion: Use a ref to track "last saved content" instead of comparing to document.content.
            Alternatively, implement optimistic locking with updatedAt timestamp comparison.
```

```
severity: critical
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 54
issue: Stale document reference in async callback causes incorrect comparison
detail: The `document` variable captured in the setTimeout closure can become stale. If Convex 
        pushes a real-time update before the timeout fires, the comparison `content !== document.content` 
        uses the OLD document snapshot, not the current one. This can lead to:
        - Unnecessary saves (content matches new doc but not old)
        - Missed saves (content differs from new doc but matches old)
suggestion: Move the save logic to a separate callback that references current state, or use
            useRef to track the latest document value.
```

### HIGH

```
severity: high
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 39-47
issue: hasInitialized flag prevents re-sync if user switches org mid-session
detail: Once hasInitialized is true, the document's title/content never re-sync from the server.
        If user switches organizations (same document ID different org = 404) or if they 
        navigate away and back, stale local state persists. Also, if document is externally 
        updated (another team member edits), local state will never reflect those changes.
suggestion: Reset hasInitialized when documentId changes. Consider also re-syncing periodically
            or when document._id changes. Add documentId to effect dependency with reset logic.
```

```
severity: high
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 73-87
issue: Title save and content save can race, causing incorrect "saved" status
detail: handleTitleBlur sets saveStatus to "saving" then "saved" independently of the content
        auto-save. If user blurs title while content is saving:
        1. Content starts saving (saveStatus = "saving")
        2. Title blur fires (saveStatus = "saving", no visible change)
        3. Title save completes (saveStatus = "saved")
        4. Content save still in progress but UI shows "Saved"
        This gives false confidence that all changes are saved.
suggestion: Use a save counter or pending saves Set. Only show "Saved" when all pending saves
            complete. Consider coalescing title+content into single save operation.
```

```
severity: high
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 62-65
issue: Error handling sets saveStatus to "idle" which hides the error
detail: When save fails, setting saveStatus to "idle" makes the save indicator disappear.
        User has no indication their changes were NOT saved. They may navigate away thinking
        their work is safe.
suggestion: Add an "error" state to saveStatus. Display error message to user. Consider
            auto-retry logic. At minimum, show a toast notification on save failure.
```

### MEDIUM

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 80
issue: Empty title allowed (falls back to "Untitled Document" only on blur)
detail: Line 80 handles empty title by using "Untitled Document", but this only triggers
        on blur. If user clears title and immediately navigates away (without blur), the
        document could be saved with empty title from a previous content auto-save.
suggestion: Either validate title is non-empty before any save, or handle empty title
            consistently in both title and content save paths.
```

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/documents/functions.ts
line: 132-137
issue: updateDocument allows saving empty title via content-only update
detail: If args.title is undefined, the existing title is preserved. But if content is
        updated while title is empty (from a bug or edge case), the empty title persists.
        The mutation doesn't validate that the resulting document has a valid title.
suggestion: Add validation that rejects empty titles, or auto-populate with "Untitled Document"
            in the mutation itself for consistency.
```

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 26
issue: orgId from useAuth() is separate from beforeLoad context check
detail: beforeLoad validates context.orgId exists, but component uses useAuth().orgId which
        could theoretically differ (though unlikely). More importantly, if Clerk's org context
        changes after page load, the component could be in an inconsistent state.
suggestion: Consider using the same source of truth consistently. Either pass orgId through
            route context or rely solely on useAuth().
```

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 28-30
issue: Type assertion on documentId bypasses validation
detail: `documentId as Id<"documents">` assumes the URL param is a valid Convex ID. A malformed
        ID would cause a query error. While Convex handles this gracefully, the error message
        might be confusing ("Document not found" vs "Invalid document ID").
suggestion: Consider validating the ID format before the query, or catching the specific
            Convex ID validation error to show appropriate UI.
```

### LOW

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 70
issue: updateDocument in useEffect dependency array causes re-registration on every render
detail: Including updateDocument (a Convex mutation hook) in deps may cause the effect to
        re-run unnecessarily if the mutation reference isn't stable. While Convex typically
        memoizes these, it's safer to exclude it or wrap in useCallback.
suggestion: Remove updateDocument from deps array (it's stable) or explicitly document why
            it's included.
```

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/$documentId.tsx
line: 148-151
issue: Title onChange sets saveStatus to "idle" which clears "Saved" indicator prematurely
detail: Setting saveStatus to "idle" on every keystroke removes visual feedback. User may
        be confused about whether their previous changes were saved when indicator disappears.
suggestion: Consider keeping "Saved" until actual changes are pending, or use "Modified"
            state to indicate unsaved changes.
```

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/documents/functions.ts
line: 64-66
issue: getDocument throws for wrong org instead of returning null
detail: For non-existent documents, function returns null. For wrong-org documents, it throws.
        This inconsistency means frontend can't distinguish "doesn't exist" from "access denied"
        for error handling.
suggestion: Return null for both cases, or throw specific error types that frontend can
            distinguish.
```

---

## Security Assessment

**Organization Ownership: PASSED**
- All backend functions correctly check `identity.organizationId`
- All mutations verify `document.organizationId !== organizationId` before writes
- getDocument properly filters by org ownership

**Authentication: PASSED**
- beforeLoad hook validates both userId and orgId
- Backend functions throw on missing authentication
- No exposed secrets or API keys

---

## Edge Cases Analysis

| Scenario | Behavior | Status |
|----------|----------|--------|
| Empty title | Falls back to "Untitled Document" on blur | PARTIAL - only on blur |
| Rapid typing | Debounce works but race condition possible | ISSUE |
| Document deleted while editing | Query returns null, shows 404 | OK |
| Org switch mid-edit | Stale state persists | ISSUE |
| Network failure on save | Error logged, status goes idle | ISSUE |
| Browser tab close with unsaved | No warning, changes lost | MISSING |

---

## Recommendations

1. **Fix race conditions (CRITICAL):** Implement optimistic locking or use refs to track last-saved state

2. **Improve error handling (HIGH):** Add "error" state with user-visible feedback and retry option

3. **Add unsaved changes warning:** Implement beforeunload handler to warn users of unsaved work

4. **Coalesce saves:** Merge title and content into single debounced save to simplify state management

5. **Consider conflict resolution:** For team collaboration, implement last-write-wins with conflict detection or operational transforms

---

## Positive Observations

- Clean component structure with clear separation of concerns
- Proper use of Convex real-time queries
- Good loading and 404 states
- Backend security is solid with proper org ownership checks
- Debounce pattern is correct conceptually
