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
