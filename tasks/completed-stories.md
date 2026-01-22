# Completed Stories

## US-DOC-001: Create Documents Schema (2026-01-22)

**Description:** Created database schema for org-scoped documents.

**Acceptance Criteria (all met):**
- [x] Created `documents` table in `convex/schema.ts`
- [x] Fields: `organizationId`, `title`, `content` (markdown string), `createdAt`, `updatedAt`, `createdBy`
- [x] Index: `by_organization` on `organizationId`
- [x] Index: `by_organization_updated` on `[organizationId, updatedAt]` for sorting
- [x] Convex codegen passes

**Files changed:**
- `convex/schema.ts`

## US-DOC-002: Create Documents CRUD Functions (2026-01-22)

**Description:** Created Convex functions for CRUD operations on documents.

**Acceptance Criteria (all met):**
- [x] Created `convex/documents/functions.ts`
- [x] `createDocument` mutation - creates doc with title, optional initial content
- [x] `getDocument` query - fetches single doc by ID, validates org ownership
- [x] `listMyDocuments` query - returns all docs for current org, sorted by updatedAt desc
- [x] `updateDocument` mutation - updates title and/or content, sets updatedAt
- [x] `deleteDocument` mutation - removes doc, validates org ownership
- [x] All functions verify `organizationId` from auth
- [x] Convex codegen passes (pre-existing TS errors in codebase unrelated to this change)

**Files changed:**
- `convex/documents/functions.ts` (new)
