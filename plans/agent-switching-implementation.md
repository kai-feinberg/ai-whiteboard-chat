# Agent Switching System - Implementation Plan

## Overview
Enable users to switch between default agents and org-level custom agents in both chat nodes and fullscreen chat. Agents = name + systemPrompt only. Model stays hardcoded.

---

## 1. Database Design

### New Table: `custom_agents`
```
_id: v.id("custom_agents")
organizationId: v.string()
name: v.string()
systemPrompt: v.string()
isDefault: v.boolean()
createdBy: v.string()
createdAt: v.number()
updatedAt: v.number()
```

**Indexes:**
- `by_organization`: ["organizationId"]
- `by_org_default`: ["organizationId", "isDefault"]

### Queries

**listAgents** (public query)
- Input: none (gets org from auth)
- Output: `[{ id, name, systemPrompt, isDefault, isCustom }]`
- Purpose: Fetch hardcoded defaults + org's custom agents for dropdown

**getAgent** (internal query)
- Input: `agentId: string, organizationId: string`
- Output: `{ name, systemPrompt } | null`
- Purpose: Fetch agent config for message generation

**getDefaultAgent** (public query)
- Input: none
- Output: `agentId: string`
- Purpose: Get org's default or fallback to "default"

### Mutations

**createCustomAgent**
- Input: `{ name, systemPrompt, isDefault? }`
- Output: `{ agentId }`
- Purpose: Create new custom agent for org

**updateCustomAgent**
- Input: `{ agentId, name?, systemPrompt?, isDefault? }`
- Output: `{ success: boolean }`
- Purpose: Edit existing custom agent

**deleteCustomAgent**
- Input: `{ agentId }`
- Output: `{ success: boolean }`
- Purpose: Delete custom agent

---

## 2. Data Flow

### Agent Selection → Message Send
1. Component loads agents via `listAgents` query
2. User selects agent → `agentId` stored in component state
3. User sends message → `agentId` passed to `sendMessage` action
4. Action fetches agent via `getAgent(agentId, organizationId)`
5. Create Agent instance with dynamic `instructions: agent.systemPrompt`
6. Stream response using agent config

### Default Agent Loading
1. Component mounts → call `getDefaultAgent()`
2. Returns org's custom default OR system "default"
3. Set as initial `selectedAgentId` state
4. User can override by selecting different agent

---

## 3. User Flows

### Creating Custom Agent (Settings)
- Navigate to `/settings/agents`
- Click "Create Agent" button
- Fill form: name, system prompt textarea
- Optional: check "Set as default"
- Save → agent appears in all chat dropdowns

### Using Agent in Chat
- Open chat node or fullscreen chat
- Click agent dropdown in prompt input area
- Select agent (default or custom)
- Type message → send
- AI responds using selected agent's system prompt
- Can switch agents mid-conversation

---

## 4. UI Components

### AgentSelector
- **Purpose**: Dropdown to select active agent
- **Interactions**: Click to open, select from grouped list (Default Agents / Custom Agents)
- **Data**: List of agents from `listAgents`, currently selected `agentId`
- **Location**: In PromptInput footer area (above textarea)

### Chat (modified)
- **Purpose**: Pass agent selection to message handler
- **New Props**: `selectedAgentId`, `onAgentChange`
- **Interactions**: Renders AgentSelector, passes `agentId` to `onSendMessage(message, agentId)`

### ChatNode (modified)
- **Purpose**: Manage agent state for chat node
- **State**: `const [selectedAgentId, setSelectedAgentId] = useState(null)`
- **Interactions**: Load default on mount, pass to Chat component

### Fullscreen Chat (modified)
- **Purpose**: Same as ChatNode but for fullscreen route
- **State**: Agent state management
- **Interactions**: Same pattern as ChatNode

### AgentsList (new - settings)
- **Purpose**: Display all custom agents in table
- **Interactions**: Create, edit, delete, set default
- **Data**: Custom agents from `listAgents`, filter `isCustom === true`

### AgentFormModal (new - settings)
- **Purpose**: Create/edit agent form
- **Interactions**: Name input, system prompt textarea, isDefault checkbox, save/cancel
- **Data**: Agent object (if editing), form validation

---

## 5. API Routes

N/A - using Convex queries/mutations/actions only

---

## 6. Patterns to Reuse

### Auth Pattern
- From: `convex/chat/functions.ts:67-76`
- Get identity, extract `organizationId`, validate exists
- Reuse in all agent queries/mutations

### Organization Scoping
- From: `convex/schema.ts` - all tables have `by_organization` index
- Query pattern: `.withIndex("by_organization", q => q.eq("organizationId", orgId))`

### Agent Creation Pattern
- From: `convex/canvas/chat.ts:12-22` and `convex/chat/functions.ts:13-22`
- Replace hardcoded config with dynamic:
```typescript
const agent = await ctx.runQuery(internal.agents.functions.getAgent, { agentId, organizationId });
new Agent(components.agent, {
  name: agent.name,
  instructions: agent.systemPrompt, // DYNAMIC
  languageModel: 'xai/grok-4-fast-non-reasoning', // STILL HARDCODED
  // ... rest
});
```

### Default Selection Pattern
- From: `src/routes/canvas/$canvasId/chat.tsx:54-58`
- Load default on mount, set state only if not already set

### Dropdown UI Pattern
- From: `src/components/ai-elements/prompt-input.tsx:1183-1236`
- Reuse PromptInputModelSelect components for agent selector
- Styled Select with trigger/content/item/value exports

### State Management Pattern
- From: `src/features/canvas/components/ChatNode.tsx:26-35`
- `useState` for local selection, `useEffect` to sync with props
- Pass down via props to child components

### Mutation Ownership Check
- From: `convex/chat/functions.ts:218-226`
- Get record, verify `organizationId` matches, throw error if not

### isDefault Toggle Pattern
```typescript
// When setting new default, unset all others first
if (args.isDefault) {
  const existing = await ctx.db.query("custom_agents")
    .withIndex("by_org_default", q => q.eq("organizationId", orgId).eq("isDefault", true))
    .collect();
  for (const a of existing) {
    await ctx.db.patch(a._id, { isDefault: false });
  }
}
```

---

## Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Add `custom_agents` table to `convex/schema.ts`
- [ ] Create `convex/agents/functions.ts`
- [ ] Implement `listAgents` with hardcoded defaults
- [ ] Implement `getAgent` (internal)
- [ ] Implement `getDefaultAgent`
- [ ] Implement `createCustomAgent`
- [ ] Implement `updateCustomAgent`
- [ ] Implement `deleteCustomAgent`

### Phase 2: Message Generation
- [ ] Update `convex/canvas/chat.ts` sendMessage - add `agentId` arg
- [ ] Update `convex/canvas/chat.ts` - fetch agent, apply systemPrompt
- [ ] Update `convex/chat/functions.ts` sendMessage - same pattern
- [ ] Test message generation with different agents

### Phase 3: UI Components
- [ ] Create `src/features/agents/components/AgentSelector.tsx`
- [ ] Modify `src/features/chat/components/Chat.tsx` - add props + selector
- [ ] Modify `src/features/canvas/components/ChatNode.tsx` - agent state
- [ ] Modify `src/routes/canvas/$canvasId/chat.tsx` - agent state

### Phase 4: Settings UI
- [ ] Create route `src/routes/settings/agents.tsx`
- [ ] Create `AgentsList` component
- [ ] Create `AgentFormModal` component
- [ ] Add delete confirmation dialog
- [ ] Wire up CRUD operations

### Phase 5: Polish
- [ ] Add PRO tier check (Autumn) for custom agents
- [ ] LocalStorage persistence for last-used agent per canvas
- [ ] Error handling - deleted agent fallback
- [ ] Loading states in AgentSelector
- [ ] Empty states in settings

---

## Hardcoded Default Agents

```typescript
const DEFAULT_AGENTS = [
  {
    id: "default",
    name: "General Assistant",
    systemPrompt: "You are a helpful AI assistant in an infinite canvas workspace. Users may provide context from connected nodes - use this context to inform your responses.",
    isDefault: true,
    isCustom: false,
  },
  {
    id: "ideation",
    name: "Ideation Bot",
    systemPrompt: "You are a creative brainstorming assistant. Help users generate innovative ideas, explore possibilities, and think outside the box. When given context, build upon it to suggest new angles and creative directions.",
    isDefault: false,
    isCustom: false,
  }
];
```

---

## Edge Cases

- No agent selected → fallback to `getDefaultAgent()`
- Deleted agent selected → `getAgent` returns null → fallback to default
- Free tier creates custom agent → Phase 5: add Autumn PRO check
- Switch agent during streaming → disable selector while `isStreaming === true`
- Empty name/prompt → validation error on save
- Multiple defaults → `createCustomAgent` unsets others first
- Default agent deleted → system "default" always available (hardcoded)

---

## Future Enhancements (Post-MVP)

- Model selection dropdown (separate from agent)
- Agent usage analytics (which agents used most)
- Agent templates/presets library
- Share agents across orgs (marketplace)
- Cost preview per agent (if different models)
- Agent versioning/history
