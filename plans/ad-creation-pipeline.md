# Ad Creation Pipeline - Implementation Plan

## 1. Database Design

### New Tables

**createdAds**
- `organizationId: v.string()` - Org ownership
- `createdBy: v.string()` - User ID
- `name: v.string()` - Auto-generated from filters (e.g., "Social Proof - Testimonial - Bold")
- `conceptId: v.id("adConcepts")` - Selected concept
- `angleId: v.id("adAngles")` - Selected angle
- `styleId: v.id("adStyles")` - Selected style
- `hookId: v.id("adHooks")` - Selected hook
- `selectedDesireIds: v.array(v.id("targetDesires"))` - Multi-select desires
- `selectedBeliefIds: v.array(v.id("targetBeliefs"))` - Multi-select beliefs
- `pipelineStage: v.string()` - "to_do" | "in_progress" | "ready_for_review" | "asset_creation" | "ready_to_publish" | "published"
- `campaignId: v.optional(v.string())` - Future campaign grouping
- `createdAt: v.number()`
- `updatedAt: v.number()`
- Indexes: `by_organization`, `by_pipeline_stage`, `by_created_at`

**adDocuments**
- `organizationId: v.string()` - Org ownership
- `adId: v.id("createdAds")` - Parent ad
- `documentType: v.string()` - "details" | "copy" | "asset_brief" | "notes"
- `documentId: v.string()` - ProseMirror doc ID (e.g., "doc_ad_123_copy")
- `documentVersion: v.number()` - Incremented by AI edits
- `createdAt: v.number()`
- Indexes: `by_ad`, `by_organization`, `by_document_id`

**adConcepts** (filtering options)
- `name: v.string()` - Display name
- `description: v.string()` - Search/description text
- `organizationId: v.optional(v.string())` - null = global, set = org-specific
- Indexes: `by_organization`
- Similar tables: `adAngles`, `adStyles`, `adHooks` (identical structure)

**documentTemplates** (markdown templates)
- `templateType: v.string()` - "ad_details" | "ad_copy" | "ad_asset_brief" | "ad_notes"
- `templateContent: v.string()` - Markdown with {{placeholders}}
- `organizationId: v.optional(v.string())` - null = global default
- Indexes: `by_template_type`, `by_organization`

### Queries

**getCreatedAds**
- Input: None (uses org from identity)
- Output: Array of ads with populated concept/angle/style/hook names
- Purpose: Load ads table for pipeline view

**getCreatedAdById**
- Input: `adId`
- Output: Single ad with full details + populated filter names + desires/beliefs arrays
- Purpose: Load ad detail page

**getAdDocuments**
- Input: `adId`
- Output: Array of 4 documents with documentId, type, version
- Purpose: Power document tab switcher in chat editor

**getAdFilteringOptions** (4 separate queries)
- Input: None (returns global + org-specific)
- Output: Array of concepts/angles/styles/hooks with name + description
- Purpose: Load card selection UI in wizard

**getDocumentTemplate**
- Input: `templateType`
- Output: Template markdown content
- Purpose: Render templates during ad creation

**getAdThreadMessages**
- Input: `threadId`
- Output: Messages array with streaming support (reuses agent pattern)
- Purpose: Load chat history in `/ads/[id]/chat`

### Mutations

**createAd**
- Input: `conceptId, angleId, styleId, hookId, selectedDesireIds[], selectedBeliefIds[]`
- Output: `adId`
- Purpose: Create ad record after wizard completion
- Side effects: Calls internal action to initialize 4 ProseMirror docs with templates

**updatePipelineStage**
- Input: `adId, newStage`
- Output: Updated ad
- Purpose: Change pipeline stage from table/detail page

**deleteAd**
- Input: `adId`
- Output: Success
- Purpose: Delete ad and cleanup documents

**seedAdFilteringOptions** (admin only)
- Input: None
- Output: Count of seeded items
- Purpose: Populate concepts/angles/styles/hooks tables (idempotent)

**seedDocumentTemplates** (admin only)
- Input: None
- Output: Count of seeded templates
- Purpose: Populate templates table (idempotent)

### Actions

**initializeAdDocuments** (internal)
- Input: `adId, organizationId, selectedFilters, selectedDesires, selectedBeliefs`
- Output: Array of 4 documentIds
- Purpose: Create 4 ProseMirror docs and populate with rendered templates
- Flow:
  1. Fetch template markdown for each doc type
  2. Render templates with string replacement ({{concept}} → actual name)
  3. Convert markdown to ProseMirror JSON using TipTap markdown extension
  4. Create 4 ProseMirror docs via canvas sync API
  5. Insert 4 records into adDocuments table

**createAdThreadWithContext** (internal)
- Input: `adId, userId, organizationId`
- Output: `threadId`
- Purpose: Create thread for ad + inject initial assistant message with ad context
- Flow:
  1. Create thread via agent component
  2. Fetch ad details + filters + desires/beliefs
  3. Build context message (markdown formatted)
  4. Save initial assistant message using `saveMessage` from agent SDK
  import { saveMessage } from "@convex-dev/agent";
import { components } from "./_generated/api";

await saveMessage(ctx, components.agent, {
  threadId,
  agentName: "Alex",
  message: { role: "assistant", content: "The human reply" },
});

**sendAdMessage** (public action)
- Input: `adId, message, activeDocumentType`
- Output: Streaming response
- Purpose: Send chat message with active document context
- Context includes: Current active document text (not all 4 docs)

## 2. Data Flow

### Ad Creation Flow
1. User completes wizard → selects filters + desires/beliefs
2. Frontend calls `createAd` mutation → ad record created
3. Mutation triggers `initializeAdDocuments` action → 4 ProseMirror docs created with templates
4. Action triggers `createAdThreadWithContext` → thread created with initial assistant message
5. Frontend redirects to `/ads/[id]/chat`
6. User sees chat with initial context message + document tabs

### Chat Editing Flow
1. User opens `/ads/[id]/chat` → loads thread + messages + 4 document records
2. User selects "Copy" tab → editor loads ProseMirror doc for copy document
3. User sends chat message → action includes active doc text in system prompt
4. AI responds + optionally edits active doc via `setDocumentText` tool
5. ProseMirror sync updates editor in real-time
6. User switches to "Details" tab → editor unmounts/remounts with new documentId

### Pipeline Management Flow
1. User views `/ads` table → query returns all ads with stage
2. User clicks stage dropdown in row → calls `updatePipelineStage` mutation
3. Mutation updates stage + updatedAt timestamp
4. Real-time sync updates table immediately

## 3. User Flows

### Admin Seeding Flow
1. Navigate to `/admin/seed`
2. Click "Seed Concepts" → mutation inserts 10 example concepts
3. Click "Seed Angles" → mutation inserts 10 example angles
4. Click "Seed Styles" → mutation inserts 10 example styles
5. Click "Seed Hooks" → mutation inserts 10 example hooks
6. Click "Seed Templates" → mutation inserts 4 markdown templates
7. Click "Seed All" → runs all 5 mutations sequentially

### Ad Creation Flow (End User)
1. Navigate to `/ads` → click "New Ad" button
2. **Step 1: Concept** - See 10+ concept cards with search box → select one → next
3. **Step 2: Angle** - See 10+ angle cards with search box → select one → next
4. **Step 3: Style** - See 10+ style cards with search box → select one → next
5. **Step 4: Hook** - See 10+ hook cards with search box → select one → next
6. **Step 5: Desires** - See multi-select checkboxes with search → check 2-5 desires → next
7. **Step 6: Beliefs** - See multi-select checkboxes with search → check 2-5 beliefs → next
8. Click "Create Ad" → loading state → redirect to `/ads/[adId]/chat`
9. See initial assistant message with ad context + 4 document tabs

### Chat Editing Flow (End User)
1. Open `/ads/[adId]/chat` → see chat panel + canvas editor
2. Top of canvas shows tabs: [Details] [Copy] [Asset Brief] [Notes]
3. Default active tab: "Copy"
4. Read initial assistant message showing ad context (concept, angle, desires, etc.)
5. Type message: "Write a compelling headline"
6. AI responds and edits the Copy document
7. See real-time updates in editor
8. Switch to "Asset Brief" tab → editor swaps to asset document
9. Type message: "Describe the hero image" → AI edits asset brief

### Pipeline Management Flow (End User)
1. Navigate to `/ads` → see table with columns: Name, Concept, Stage, Created Date
2. Find ad in table → click stage dropdown → select "In Progress"
3. Stage updates immediately
4. Click ad name → navigate to `/ads/[adId]` detail page
5. See ad metadata + document previews + stage dropdown
6. Click "Edit in Chat" → navigate to `/ads/[adId]/chat`

## 4. UI Components

### Admin Seeding Page (`/admin/seed`)
- **Purpose**: Populate database with seed data
- **Components**: 6 buttons (Seed Concepts, Angles, Styles, Hooks, Templates, Seed All)
- **Data**: None (triggers mutations)
- **Interactions**: Click button → mutation runs → toast confirmation

### Ad Creation Wizard (`/ads/new`)
- **WizardStepper** - Shows progress breadcrumbs (Step 1/6)
- **FilterSelectionStep** - Card grid with search box
  - Purpose: Select one filter option (concept/angle/style/hook)
  - Data: Query filtering options (concepts/angles/styles/hooks)
  - Interactions: Search filters cards, click card to select, "Back" button, "Next" button
- **DesiresSelectionStep** - Multi-select checkboxes with search
  - Purpose: Select multiple desires (unlimited)
  - Data: Query targetDesires from onboarding profile
  - Interactions: Search filters checkboxes, check/uncheck, "Back", "Next"
- **BeliefsSelectionStep** - Multi-select checkboxes with search
  - Purpose: Select multiple beliefs (unlimited)
  - Data: Query targetBeliefs from onboarding profile
  - Interactions: Search filters checkboxes, check/uncheck, "Back", "Create Ad"

### Ads Table Page (`/ads`)
- **AdsTable** - Data table with sortable columns
  - Purpose: View all ads with pipeline management
  - Data: Query createdAds (with populated filter names)
  - Columns: Name, Concept, Stage (dropdown), Created Date, Actions
  - Interactions: Sort columns, change stage dropdown, click name → detail page, click "Edit in Chat"

### Ad Detail Page (`/ads/[id]`)
- **AdDetailCard** - Shows metadata (concept, angle, style, hook, desires, beliefs)
- **PipelineStageDropdown** - Change stage
- **DocumentPreviews** - Read-only markdown render of all 4 docs
- **Actions** - "Edit in Chat" button → `/ads/[id]/chat`

### Ad Chat Page (`/ads/[id]/chat`)
- **CanvasLayout** - Split panel (chat + editor)
- **DocumentTabs** - Tab switcher at top of canvas
  - Purpose: Switch active document
  - Data: Query adDocuments for ad
  - Interactions: Click tab → editor swaps documentId prop
- **CanvasEditor** - ProseMirror collaborative editor (reuses existing component)
  - Purpose: Edit active document
  - Data: documentId from active tab
  - Interactions: Type, AI edits via tool calls
- **ChatPanel** - Message list + input (reuses existing component)
  - Purpose: Chat with AI about active document
  - Data: Query thread messages with streaming
  - Interactions: Type message, send, see streaming responses

## 5. Patterns to Reuse

### Auth & Org Scoping
- Pattern: Copy from onboarding queries/mutations
- Always get identity → verify organizationId exists
- Index all tables by `by_organization`
- Verify org ownership before mutations

### Document Initialization with Templates
- Pattern: Similar to onboarding document generation but simpler
- Fetch template markdown → string replacement → convert to ProseMirror JSON
- Use TipTap markdown extension for conversion (not AI generation)
- Create ProseMirror doc via canvas sync API

### Thread Creation with Initial Message
- Pattern: Use agent SDK `createThread` + `saveMessage`
- Example from requirements: Initial assistant message with ad context
- Build formatted markdown message with ad metadata
- Save via `saveMessage(ctx, components.agent, { threadId, agentName, message })`

### AI Chat with Document Context
- Pattern: Reuse from existing ai-chat route
- System prompt includes current active document text (not all docs)
- AI has `setDocumentText` tool to edit active doc
- Streaming responses via `canvasAgent.streamText` with delta saving

### Streaming Messages UI
- Pattern: Use `useUIMessages` hook from agent SDK (already in ai-chat.tsx)
- Supports real-time streaming deltas
- Shows "streaming" status on messages
- Auto-updates as AI generates response

### Card Selection with Search
- Pattern: Filter array by search text (name + description)
- Grid layout with hover states
- Highlight selected card
- Disable "Next" until selection made (optional per user preference)

### Multi-Select with Search
- Pattern: Checkbox list filtered by search text
- Track selected IDs in React state
- Show count of selected items
- Search filters visible checkboxes only

### Seeding Pattern (Idempotent)
- Pattern: Delete all existing records for org → insert new records
- Use transactions to ensure atomicity
- Example seed data:
  - Concepts: "Social Proof", "Transformation", "Problem-Agitation-Solution", "Before/After", "Urgency/Scarcity", "Authority", "Curiosity Gap", "Identity Shift", "Enemy/Villain", "Risk Reversal"
  - Templates: Store as markdown strings with {{placeholders}}

### Table with Inline Dropdowns
- Pattern: Use shadcn data-table with custom cell renderers
- Stage cell: Dropdown component inline in row
- On change → call mutation immediately
- Optimistic updates for instant UI feedback

### ProseMirror Document Lifecycle
- Pattern: Editor component receives `documentId` + `documentVersion` as props
- When props change → editor unmounts/remounts with new doc
- Use `useTiptapSync` hook for sync setup
- Show loading state while sync initializes

## 6. Template Examples

### Ad Details Template
```markdown
# Ad Details

**Concept:** {{concept.name}}
**Angle:** {{angle.name}}
**Style:** {{style.name}}
**Hook:** {{hook.name}}

---

## Target Desires
{{#selectedDesires}}
- {{text}} ({{category}})
{{/selectedDesires}}

## Target Beliefs
{{#selectedBeliefs}}
- {{text}} ({{category}})
{{/selectedBeliefs}}

---

## Product Information
{{productDescription}}

## Target Buyer
{{targetBuyerDescription}}

---

**Created:** {{createdDate}}
```

### Ad Copy Template
```markdown
**Headline**

[Your headline here]

**Copy**

[Your ad copy here]

**Call-to-Action**

[Your CTA here]
```

### Asset Brief Template
```markdown
# Asset Brief

**Format:** [Image/Video/Carousel]

**Visual Description:**
[Describe the hero image or video concept]

**Key Elements:**
- [Element 1]
- [Element 2]
- [Element 3]

**Mood/Style:** [Describe tone and aesthetic]
```

### Notes Template
```markdown
# Notes & Ideas

[Brainstorming space for creative directions, variations, and team notes]
```

## 7. Implementation Timeline

### Week 1: Schema + Backend Foundation
- Day 1-2: Schema definitions (all 8 tables), indexes, queries
- Day 3-4: Mutations (create, update, delete, seed), internal actions
- Day 5: Template rendering logic, ProseMirror doc initialization, admin seed page

### Week 2: Ad Creation Flow
- Day 1-2: Wizard UI (6 steps with card selection, search, navigation)
- Day 3: Ads table page with pipeline dropdown, sorting
- Day 4: Ad detail page with metadata display, document previews
- Day 5: Create ad flow end-to-end testing, error handling

### Week 3: Chat Editor Integration
- Day 1-2: Chat route (`/ads/[id]/chat`), thread creation with initial message
- Day 3: Document tabs component, editor swap logic
- Day 4: AI chat action with active doc context, tool calls
- Day 5: End-to-end chat editing, streaming responses, real-time sync testing

## 8. Key Assumptions

- Onboarding profile exists with desires/beliefs populated (add check in wizard)
- ProseMirror canvas sync API matches existing ai-chat pattern
- TipTap markdown extension converts markdown → ProseMirror JSON correctly
- Agent SDK `saveMessage` works for injecting initial assistant messages
- String replacement for templates is sufficient (no Handlebars needed for MVP)
- 4 documents per ad initialized immediately (not lazy loaded)
- AI can only edit active document (not all 4 docs at once)
- No asset upload in Weeks 1-3 (schema fields added but UI deferred)
- No reference ads integration in Weeks 1-3 (schema fields deferred)
