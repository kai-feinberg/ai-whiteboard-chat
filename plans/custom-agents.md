# Custom Agents Implementation Plan

## 1. Database Design

### New Table: `custom_agents`
- `_id`: v.id("custom_agents")
- `organizationId`: v.string() - org-scoped agents
- `name`: v.string() - display name ("VSL Writer", "Ideation Bot")
- `systemPrompt`: v.string() - custom instructions
- `model`: v.string() - which LLM to use (e.g., "xai/grok-4-fast-non-reasoning")
- `isDefault`: v.boolean() - whether this is a default agent
- `createdBy`: v.string() - userId who created it
- `createdAt`: v.number()
- `updatedAt`: v.number()

**Indexes:**
- `by_organization`: ["organizationId"]
- `by_org_defaults`: ["organizationId", "isDefault"]

### Adjusted Tables:
None - chat_nodes already has optional `agentId` field (line 80 in schema.ts)

### Queries:

**listCustomAgents**
- Input: none (gets orgId from auth)
- Output: array of custom_agents for current org
- Purpose: load agents for dropdown selector

**getCustomAgent**
- Input: `agentId: v.id("custom_agents")`
- Output: single agent object
- Purpose: fetch system prompt during message generation

**getDefaultAgent**
- Input: none
- Output: first default agent or null
- Purpose: initial agent selection

### Mutations:

**createCustomAgent**
- Input: `{ name, systemPrompt, model, isDefault? }`
- Output: `{ agentId }`
- Purpose: create new custom agent

**updateCustomAgent**
- Input: `{ agentId, name?, systemPrompt?, model?, isDefault? }`
- Output: success/error
- Purpose: edit existing agent

**deleteCustomAgent**
- Input: `{ agentId }`
- Output: success/error
- Purpose: remove agent

## 2. Data Flow

1. **Agent Selection**: User clicks dropdown in prompt input → loads list of custom agents from DB
2. **Agent State**: Selected agentId stored in local component state, passed to message send handler
3. **Message Send**: agentId included in sendMessage action payload
4. **Prompt Fetch**: sendMessage fetches agent's systemPrompt from DB using agentId
5. **AI Generation**: systemPrompt passed to Agent.streamText() as system parameter

## 3. User Flows

### Admin/User Flow (Agent Creation):
- Navigate to /settings or new /agents page
- Click "Create Custom Agent"
- Fill form: name, system prompt, select model
- Save → agent appears in all chat dropdowns

### End User Flow (Using Agent):
- Open chat node or full-screen chat
- Click agent dropdown in prompt input area
- Select custom agent (e.g., "VSL Writer")
- Type message → send
- AI responds using selected agent's system prompt

## 4. UI Components

### AgentSelector (NEW)
- **Purpose**: Dropdown to select active agent
- **Key Interactions**: Click to open, select agent from list
- **Data Requirements**: List of custom_agents, currently selected agentId
- **Location**: Inside PromptInputHeader or PromptInputFooter

### CustomAgentForm (NEW)
- **Purpose**: Create/edit custom agents
- **Key Interactions**: Input name, system prompt, select model, save
- **Data Requirements**: Agent data (if editing), available models list
- **Location**: Settings page or dedicated /agents route

### Chat Component (MODIFIED)
- **Purpose**: Pass selected agentId to message handler
- **Key Interactions**: Receives agentId from selector, passes to onSendMessage
- **Data Requirements**: agentId state

### PromptInput Component (MODIFIED)
- **Purpose**: Display AgentSelector component
- **Key Interactions**: Host the agent dropdown
- **Data Requirements**: None (container only)

## 5. API Routes

N/A - using Convex functions, not REST

## 6. Patterns to Reuse

### Auth Pattern
- Reuse existing `getUserIdentity()` + `organizationId` validation
- From: convex/agents/actions.ts lines 31-44

### Query Pattern
- Reuse `.withIndex("by_organization")` for org-scoped queries
- From: convex/schema.ts and existing query patterns

### Message Generation Pattern
- Current flow in convex/agents/actions.ts `sendMessage` (lines 20-115)
- Add agent lookup before line 62 system message
- Replace hardcoded systemMessage with fetched agent.systemPrompt

### Model Selection Pattern
- Agent component already supports dynamic models
- Currently hardcoded: `languageModel: 'xai/grok-4-fast-non-reasoning'` (line 14)
- Make Agent instance dynamic or pass model to streamText

### Component State Management
- Use useState for selected agentId (similar to thread selection pattern)
- From: src/routes/canvas/$canvasId/chat.tsx lines 38-61

### Dropdown UI Pattern
- Reuse PromptInputModelSelect components (lines 1183-1236 in prompt-input.tsx)
- Already has styled Select, SelectTrigger, SelectContent, SelectItem

## 7. Implementation Steps

1. **Database Schema** - Add custom_agents table to convex/schema.ts
2. **Backend Functions** - Create convex/agents/functions.ts with CRUD operations
3. **Agent Lookup** - Modify sendMessage to fetch + use custom agent system prompt
4. **AgentSelector Component** - Build dropdown using PromptInputModelSelect pattern
5. **Integrate Selector** - Add AgentSelector to Chat component's PromptInput
6. **Settings UI** - Create CustomAgentForm + list view in settings
7. **Default Agents** - Seed DB with default agents (e.g., "General Assistant")

## 8. Clarifying Questions

**Q1: Where should users manage custom agents?**
- Option A: /settings page with dedicated "Agents" section
- Option B: Separate /agents route
- Option C: Inline modal from chat interface
- **Recommendation**: Option A - /settings with tab for agents (consistent with org settings pattern)

**Q2: Should agentId be persisted per chat_node or per message?**
- Option A: Store on chat_node (all messages in node use same agent)
- Option B: Store per thread (thread locked to one agent)
- Option C: Store per message (user can switch mid-conversation)
- **Recommendation**: Option C - per message (most flexible, allows experimentation)

**Q3: Default agent behavior?**
- What happens if user deletes selected agent?
- **Recommendation**: Fall back to org's default agent, or system default if none

**Q4: Model selection per agent or global?**
- Should each custom agent define its own model?
- **Recommendation**: Yes - different agents may need different capabilities (fast vs. reasoning models)

**Q5: Where in PromptInput should selector appear?**
- Option A: PromptInputHeader (above textarea)
- Option B: PromptInputFooter (below textarea, next to submit)
- Option C: Separate toolbar
- **Recommendation**: Option B - PromptInputFooter using PromptInputModelSelect pattern (lines 1183-1236)

**Q6: Should agent selection persist across sessions?**
- Save last-used agent to localStorage or DB?
- **Recommendation**: Yes - localStorage per canvasId for quick iteration

**Q7: Pricing implications?**
- Different models have different costs - show cost preview?
- **Recommendation**: Phase 2 - show model cost in agent selector tooltip
