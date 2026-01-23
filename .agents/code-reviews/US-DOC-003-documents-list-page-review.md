# Code Review: US-DOC-003 Documents List Page

**Date:** 2026-01-22
**Reviewer:** Claude (Automated Logic Review)
**Feature:** Documents List Page

---

## Stats

- Files Modified: 2 (app-sidebar.tsx, routeTree.gen.ts - auto-generated)
- Files Added: 1 (src/routes/documents/index.tsx)
- Files Deleted: 0
- New lines: ~210
- Deleted lines: ~1

---

## Summary

Implementation follows the dashboard pattern closely. Security is handled correctly by backend functions. A few issues identified related to missing route-level auth guard and minor UX inconsistencies.

---

## Issues Found

### Issue 1
```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/index.tsx
line: 20-22
issue: Missing beforeLoad authentication guard
detail: The route does not implement a beforeLoad hook to enforce authentication. Other protected routes like /settings/custom-agents (line 27-34) and /canvas/$canvasId/chat (line 16-19) use beforeLoad to verify context.userId and context.orgId before the component loads. Without this, unauthenticated users may briefly see a flash of content or trigger unnecessary Convex queries before being redirected. The root route's RootComponent handles SignedIn/SignedOut, but this is client-side only. Route-level beforeLoad provides SSR-safe auth enforcement.
suggestion: Add beforeLoad hook to match existing protected route patterns:

export const Route = createFileRoute("/documents/")({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error("Not authenticated");
    }
    if (!context.orgId) {
      throw new Error("No organization selected");
    }
  },
  component: DocumentsPage,
});
```

### Issue 2
```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/index.tsx
line: 38
issue: Navigation to non-existent route on document creation
detail: handleCreateDocument navigates to /documents/${documentId} but US-DOC-004 (document editor page) has not been implemented yet. Users clicking "New Document" will see a 404. This is acceptable during development but should be noted.
suggestion: Either implement US-DOC-004 first, or temporarily disable navigation and show a toast "Document created" without navigating until the editor page exists.
```

### Issue 3
```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/index.tsx
line: 70-72
issue: Navigation to non-existent route on document selection
detail: handleSelectDocument navigates to /documents/${documentId} which does not exist yet. Same issue as above.
suggestion: Same as Issue 2.
```

### Issue 4
```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/index.tsx
line: 27
issue: listMyDocuments query behavior on error
detail: useQuery returns undefined during loading AND when an error occurs. The code only checks for undefined (loading state) but does not handle potential query errors. If the backend throws (e.g., "Not authenticated"), the query will return undefined forever, showing infinite loading skeleton.
suggestion: Consider handling the error case. Convex useQuery pattern allows checking for errors via the options object or by wrapping in try-catch at the mutation level. However, since the backend throws for auth errors, and the root layout handles SignedOut, this is low priority. The real fix is adding beforeLoad (Issue 1) which prevents the query from even running for unauthenticated users.
```

### Issue 5
```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/documents/index.tsx
line: 173
issue: Document title fallback differs from dashboard pattern
detail: Code uses {doc.title || "Untitled"} but createDocument defaults title to "Untitled Document" (line 36). The fallback should be consistent. Either use "Untitled Document" in the UI fallback or use "Untitled" as the create default.
suggestion: Change line 173 to: {doc.title || "Untitled Document"} to match the create default.
```

---

## Positive Observations

1. **Security**: Backend functions (convex/documents/functions.ts) correctly enforce organizationId checks - no client-side-only auth.

2. **Pattern Consistency**: UI structure closely matches src/routes/index.tsx (dashboard) - same Card layout, delete dialog pattern, loading skeletons.

3. **Error Handling**: handleCreateDocument and confirmDelete properly catch errors and display toast messages with specific error info.

4. **UX**: Loading state with skeleton cards is good UX. Empty state is well-designed with clear CTA.

5. **Delete Confirmation**: Uses Dialog component with proper confirmation flow, matching codebase patterns.

6. **Navigation Link**: AppSidebar correctly adds Documents link with FileText icon, positioned appropriately after Dashboard.

---

## Data Flow Analysis

**Create Document Flow:**
1. User clicks "New Document" button
2. handleCreateDocument calls createDocument mutation with title: "Untitled Document"
3. Backend verifies auth + organizationId, inserts document, returns documentId
4. Success: toast + navigate to /documents/{id} (404 until US-DOC-004)
5. Error: toast with error message

**Delete Document Flow:**
1. User clicks trash icon on card
2. handleDeleteDocument sets documentToDelete and opens dialog
3. User confirms via confirmDelete
4. deleteDocument mutation called with documentId
5. Backend verifies auth + org ownership, deletes document
6. Convex real-time updates removes document from list automatically
7. Dialog closes, toast shown

**List Flow:**
1. Component mounts, useQuery(listMyDocuments) subscribes
2. Backend returns all org documents sorted by updatedAt desc
3. Convex handles real-time updates (new docs appear, deleted docs disappear)

---

## Requirements Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Route /documents at src/routes/documents/index.tsx | PASS | Correctly implemented |
| "Documents" link in main navigation | PASS | Added to app-sidebar.tsx |
| Lists all org documents with title, last updated | PASS | Card shows title + updated date |
| "New Document" button creates + navigates | PARTIAL | Creates but navigates to 404 |
| Delete button with confirmation dialog | PASS | Properly implemented |
| Empty state when no documents | PASS | Shows icon + message + CTA |
| Loading state while fetching | PASS | Skeleton cards shown |

---

## Recommendations

1. **High Priority**: Add beforeLoad auth guard (Issue 1) to match other protected routes.

2. **Before Merge**: Either implement US-DOC-004 or stub the route with a "Coming Soon" message to avoid 404.

3. **Optional**: Add aria-label to delete button for accessibility.

---

## Conclusion

Implementation is solid and follows existing codebase patterns. The main concern is the missing route-level auth guard which should be added for consistency with other protected routes. The navigation to non-existent editor page is a known dependency on US-DOC-004.

**Verdict**: Ready for merge after adding beforeLoad auth guard.
