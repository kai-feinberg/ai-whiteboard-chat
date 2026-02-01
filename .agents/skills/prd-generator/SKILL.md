---
  name: prd                                                                                                   
  description: Generate a Product Requirements Document (PRD) for a new feature. Use when planning a feature, starting a new project, or when asked to create a PRD. 
  Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out.
---         
# PRD Generator

Create detailed Product Requirements Documents that are clear, actionable, and suitable for implementation.

---

## The Job

1. Receive a feature description from the user
2. Ask 3-5 essential clarifying questions (with lettered options)
3. Generate a structured PRD based on answers
4. Save to `/tasks/prd-[feature-name].md`

**Important:** Do NOT start implementing. Just create the PRD.

---

## Step 1: Clarifying Questions

Ask only critical questions where the initial prompt is ambiguous. Focus on:

- **Problem/Goal:** What problem does this solve?
- **Core Functionality:** What are the key actions?
- **Scope/Boundaries:** What should it NOT do?
- **Success Criteria:** How do we know it's done?

### ASK CLARIFYING QUESTIONS WITH THE AskUserQuestion Tool.

## Step 2: PRD Structure

Generate the PRD with these sections:

### 1. Introduction/Overview
Brief description of the feature and the problem it solves.

### 2. Goals
Specific, measurable objectives (bullet list).

### 3. User Stories
Each story needs:
- **Title:** Short descriptive name
- **Description:** "As a [user], I want [feature] so that [benefit]"
- **Acceptance Criteria:** Verifiable checklist of what "done" means

Each story should be small enough to implement in one focused session.

**Format:**
```markdown
### US-001: [Title]
**Description:** As a [user], I want [feature] so that [benefit].

**Required Reading:**
Specific files or skills to load into context

**Acceptance Criteria:**
- [ ] Specific verifiable criterion
- [ ] Another criterion
- [ ] `pnpm typecheck` (mostly) passes
- [ ] **[UI/Completed functionality stories only]** Verify in browser using agent-browser skill
```

**Important:**
- Acceptance criteria must be verifiable, not vague. "Works correctly" is bad. "Button shows confirmation dialog before deleting" is good.
- **For any story where we need to test functionality start by saying**: "Use the agent-browser to test the following functionality. Read the skill before beginning."

### 4. Functional Requirements
Numbered list of specific functionalities:
- "FR-1: The system must allow users to..."
- "FR-2: When a user clicks X, the system must..."

Be explicit and unambiguous.

### 5. Non-Goals (Out of Scope)
What this feature will NOT include. Critical for managing scope.

### 6. Design Considerations

### 7. Technical Considerations (Optional)
- Known constraints or dependencies
- Integration points with existing systems
- Existing code snippets to reference

### 8. Data Flow
A brief explanation for how data will flow through this feature and be rendered to the user (when will it trigger, what functions will be called, what UI will be used, etc)

### 9. Open Questions
Remaining questions or areas needing clarification.

---

## Writing for Junior Developers

The PRD reader may be a junior developer or AI agent. Therefore:

- Be explicit and unambiguous
- Avoid jargon or explain it
- Provide enough detail to understand purpose and core logic
- Number requirements for easy reference
- Use concrete examples where helpful

---

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/tasks/`
- **Filename:** `prd-[feature-name].md` (kebab-case)

---

## Example PRD

```markdown
# PRD: Filtered Deep Search

## Introduction

AI tool that searches the web using Exa API, then filters results through Haiku to remove promotional content, spam, and paywalled articles before returning them to the agent. This gives users curated, high-quality search results while showing transparency about what was filtered out.

The filtering step uses Haiku to evaluate each result's summary against configurable criteria. Accepted articles return full text to the AI for synthesis; rejected articles are shown to users in a collapsed UI section for transparency.

## Goals

- Enable high-quality web search via Exa API as an agent tool
- Automatically filter out low-value content (promo, spam, paywalls)
- Show users both accepted and rejected results for transparency
- Return rich context (full article text) to AI for better responses
- Design for future user-configurable filter rules

## User Stories

### US-WS-001: Implement Exa search integration

**Description:** As a developer, I need to integrate the Exa API to search the web and retrieve article content with summaries.

**Required Reading:**
- `convex/agent/_FEATURE.md` → existing tool patterns
- `convex/agent/tools.ts` → searchTikTok implementation for reference

**Acceptance Criteria:**
- [ ] Install `exa-js` package
- [ ] Create `fetchExaSearch` helper in `convex/agent/tools.ts`
- [ ] Function calls `exa.searchAndContents()` with query, `text: true`, `type: "auto"`
- [ ] Returns array of results with: id, title, url, publishedDate, author, text, image, favicon
- [ ] Handles API errors gracefully (rate limits, invalid key)
- [ ] `pnpm run typecheck` passes

---

### US-WS-002: Implement Haiku filtering step

**Description:** As a developer, I need to filter search results through Haiku to remove low-quality content based on article summaries.

**Required Reading:**
- `convex/agent/index.ts` → OpenRouter/model config patterns
- `convex/agent/tools.ts` → how tools call external services

**Acceptance Criteria:**
- [ ] Create `filterSearchResults` function that takes Exa results + filter criteria
- [ ] Haiku prompt evaluates: promotional/SEO? spam? paywalled?
- [ ] Returns `{ accepted: boolean, reason: string }` for each result
- [ ] Batch/parallel calls to Haiku for performance
- [ ] Returns `{ accepted: Result[], rejected: Result[] }` with rejection reasons
- [ ] `pnpm run typecheck` passes

---

### US-WS-003: Create filteredWebSearch tool

**Description:** As a user, I want the AI to search the web and automatically filter out junk so I get high-quality information.

**Required Reading:**
- `convex/agent/_FEATURE.md` → tool registration pattern
- `convex/agent/tools.ts` → existing tool structure
- Vercel AI SDK docs on `tool()` helper

**Acceptance Criteria:**
- [ ] Define `filteredWebSearch` tool with description, inputSchema, execute function
- [ ] Tool orchestrates: search → filter → return flow
- [ ] Output includes: success, accepted[], rejected[], timing, error handling
- [ ] Register tool in agent definition
- [ ] `pnpm run typecheck` passes

---

### US-WS-004: Render accepted search results

**Description:** As a user, I want to see the accepted search results as cards so I can see what sources the AI is using.

**Required Reading:**
- `src/routes/chat.$threadId.tsx` → existing card rendering patterns
- `src/components/ai-elements/tool.tsx` → tool display components

**Acceptance Criteria:**
- [ ] Tool shows loading state: "Searching web..." then "Filtering results..."
- [ ] Accepted results render as cards: favicon, title (linked), author/date, summary, thumbnail
- [ ] Cards appear in grid/list layout
- [ ] Clicking card opens article in new tab
- [ ] `pnpm run typecheck` passes
- [ ] Verify in browser using agent-browser skill

---

### US-WS-005: Render rejected results with toggle

**Description:** As a user, I want to see what results were filtered out so I understand the filtering and can review if needed.

**Required Reading:**
- `src/routes/chat.$threadId.tsx` → existing tool result patterns
- Use context7 MCP for shadcn/ui Collapsible patterns

**Acceptance Criteria:**
- [ ] Below accepted results, show collapsed section: "X results filtered out"
- [ ] When expanded, shows rejected results with title + rejection reason
- [ ] Collapsed by default, smooth animation
- [ ] Hidden entirely if no rejected results
- [ ] `pnpm run typecheck` passes
- [ ] Verify in browser using agent-browser skill

## Functional Requirements

- **FR-WS-1:** Tool must search web via Exa API when user asks informational questions
- **FR-WS-2:** Tool must fetch article content (not just metadata) from Exa
- **FR-WS-3:** Each result must be evaluated by Haiku against filter criteria
- **FR-WS-4:** Filter criteria must check for: promotional/SEO, spam, paywalled content
- **FR-WS-5:** Accepted results must include full article text for AI context
- **FR-WS-6:** Rejected results must include rejection reason
- **FR-WS-7:** Frontend must display accepted results as interactive cards
- **FR-WS-8:** Frontend must show rejected results in collapsed section with count
- **FR-WS-9:** AI must synthesize response using accepted article content

## Non-Goals (Out of Scope)

- User-configurable filter rules UI (future enhancement)
- Caching search results
- Saving/bookmarking individual articles
- Full article view within the app (links to source)
- Multi-query search (single query per tool call)

## Design Considerations

- Accepted results: prominent card display similar to existing patterns
- Rejected results: subtle, collapsed by default, muted styling
- Loading state should indicate two phases: "Searching..." → "Filtering..."
- Mobile-responsive: cards stack vertically on small screens

## Technical Considerations

### API Integration

| Service | Purpose | Env Variable |
|---------|---------|--------------|
| Exa | Web search + content | `EXA_API_KEY` |
| OpenRouter (Haiku) | Filter evaluation | `OPENROUTER_API_KEY` |

### Exa API Usage

```typescript
import Exa from "exa-js";
const exa = new Exa(process.env.EXA_API_KEY);

const result = await exa.searchAndContents(query, {
  text: true,
  type: "auto"
});
```

### Haiku Filter Prompt Structure

```
Evaluate this search result for quality:
Title: {title} | URL: {url} | Summary: {text.slice(0, 500)}

Check: 1) Promotional content? 2) Spam/low-quality? 3) Paywalled?
Respond: { "accepted": boolean, "reason": string }
```

## Data Flow

```
User sends query
  ↓
Agent calls filteredWebSearch tool
  ↓
Tool: Exa searchAndContents(query) → ~10 results with text
  ↓
Tool: Parallel Haiku calls → { accepted, reason } per result
  ↓
Tool returns: { accepted[], rejected[], timing }
  ↓
Frontend: Renders accepted cards + collapsed rejected section
  ↓
Agent: Synthesizes response from accepted article text
  ↓
Response streams to user below tool cards
```

## Open Questions

1. Should we limit Exa results (e.g., 10) to control API costs?
2. What's the threshold for "too few accepted results" - warn user?
3. Should filter criteria be stored per-thread for consistency?
```

---

## Checklist

Before saving the PRD:

- [ ] Asked clarifying questions with lettered options
- [ ] Incorporated user's answers
- [ ] User stories are small and specific
- [ ] Functional requirements are numbered and unambiguous
- [ ] Non-goals section defines clear boundaries
- [ ] Saved to `/tasks/prd-[feature-name].md`