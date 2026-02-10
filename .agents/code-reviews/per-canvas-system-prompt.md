# Code Review: Per-Canvas System Prompt Feature

**Date:** 2026-02-10
**Reviewer:** Claude Opus 4.6
**Branch:** main (unstaged changes)

## Stats

- Files Modified: 4
- Files Added: 0
- Files Deleted: 0
- New lines: ~106
- Deleted lines: ~3

## Files Reviewed

1. `convex/schema.ts` -- Added `systemPrompt` field to canvases table
2. `convex/canvas/functions.ts` -- Added `systemPrompt` to `updateCanvas` mutation
3. `convex/canvas/chat.ts` -- Added `getCanvasInternal` query, injected canvas prompt into system message
4. `src/routes/canvas/$canvasId/index.tsx` -- Settings gear icon, Sheet UI for editing prompt

---

## Issues Found

### 1. Cannot clear a saved system prompt

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/canvas/$canvasId/index.tsx
line: 942-948
issue: Saving an empty string persists "" to the database, which is truthy and will show the dot indicator + inject an empty "# Canvas Instructions" section into the system message
detail: When a user clears the textarea and saves, `systemPromptDraft` is "" (empty string). This gets saved to the DB via `updateCanvas({ systemPrompt: "" })`. In the backend chat.ts line 829, `if (canvasDoc?.systemPrompt)` is falsy for "" so the prompt section won't be injected (good), BUT in the frontend line 864, `canvasData?.canvas?.systemPrompt` is also falsy for "" so the dot indicator won't show (also good). However, the field remains set to "" in the database rather than being cleared to undefined. This is cosmetically fine now but semantically dirty -- if the truthiness check ever changes (e.g., checking `!== undefined` instead), it would break. Consider normalizing: save `undefined` when the string is empty.
suggestion: In the save handler, normalize: `systemPrompt: systemPromptDraft.trim() || undefined`. Or in the backend, normalize before patching.
```

### 2. No loading/disabled state on Save button during mutation

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/src/routes/canvas/$canvasId/index.tsx
line: 941-956
issue: Save button has no loading state while the mutation is in flight
detail: If the network is slow or the mutation takes time, the user can click Save multiple times, or may think nothing happened. Other mutation handlers in this file use toast for feedback which is good, but there's no visual indication on the button itself that work is in progress.
suggestion: Track a `saving` state: `const [saving, setSaving] = useState(false)`, set it true before await, false in finally block, and pass `disabled={saving}` to the Button. Optionally show a Loader2 spinner.
```

---

## Checks Passed (No Issues)

### Schema (`convex/schema.ts`)
- `systemPrompt: v.optional(v.string())` is correct -- optional field, backward compatible with existing canvas documents.

### updateCanvas mutation (`convex/canvas/functions.ts`)
- Auth check: present and correct (checks identity, organizationId, canvas ownership).
- The `if (args.systemPrompt !== undefined)` guard follows the same pattern as `title` and `description`. Consistent.
- Uses `ctx.db.patch` which only updates provided fields. Correct.

### getCanvasInternal query (`convex/canvas/chat.ts`)
- Validates org ownership: `canvas.organizationId !== args.organizationId` returns null if mismatch. Correct.
- Returns null (not throwing) for missing/unauthorized canvas. This is appropriate for an internal query since the caller handles null gracefully via optional chaining (`canvasDoc?.systemPrompt`).
- Uses `internalQuery` -- not exposed to the client. Correct security posture.

### Prompt composition order (`convex/canvas/chat.ts`)
- Order is: (1) Org Business Context, (2) Canvas Instructions, (3) Agent Role/Instructions, (4) Attached Node Context.
- This hierarchy makes sense: org-wide context is broadest, canvas narrows scope, agent is most specific role, and attached context is reference material.
- Each section uses `---` separator and markdown headers for clear delineation. Good.

### canvasData?.canvas?.systemPrompt access pattern
- `getCanvasWithNodes` returns `{ canvas, nodes, edges }` where `canvas` is the raw doc from `ctx.db.get()`.
- `canvasData` can be `undefined` (loading) or `null` (canvas not found). The `?.` chain handles both.
- The canvas doc will include `systemPrompt` when set (it's in the schema). Correct.

### Full-screen chat path
- The full-screen chat route (`/canvas/$canvasId/chat.tsx`) uses `api.canvas.chat.sendMessage` -- the same action that now includes the canvas system prompt. So full-screen chat also benefits from this feature. Consistent.

### Dot indicator UI
- Shows when `canvasData?.canvas?.systemPrompt` is truthy. An empty string is falsy, so this won't show a false positive if the prompt was "cleared" to "". Correct.
- Positioned with `absolute top-1 right-1` inside a `relative` container. Standard pattern.

### TypeScript
- No new type errors introduced (confirmed via `npx tsc --noEmit`). All errors are pre-existing.

---

## Summary

The implementation is clean and well-structured. The prompt composition hierarchy is logical, org ownership is validated in the new internal query, and the UI flow (gear icon -> sheet -> textarea -> save) works correctly. The two issues found are low-to-medium severity: the empty-string normalization is a hygiene concern, and the missing loading state on Save is a minor UX gap. Neither is a blocker.
