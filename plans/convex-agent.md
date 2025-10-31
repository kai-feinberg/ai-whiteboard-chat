# Chat Playground with Convex Agent - Implementation Guide

## 1. Feature Overview

### Purpose and User Value
AI-powered chat playground using Convex's Agent component. Users can chat with an AI assistant that responds with streaming text.

### Key Functionality
- **Real-time chat**: Send messages to AI, receive streaming responses
- **Streaming text rendering**: Smooth word-by-word text appearance with stream deltas
- **Multi-tenant support**: All data scoped to organizations (Clerk)
- **Authentication**: Clerk integration with organization context

### User Flow
1. User lands on chat playground route
2. System loads or creates thread for their organization
3. User types message in chat input, presses Enter
4. Message sent to backend action
5. AI streams response with deltas visible in real-time
6. User can continue conversation

---

## 2. Architecture

### Data Flow Diagram
```
┌─────────────┐
│   User UI   │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Send message
       ▼
┌─────────────────────────────────────────┐
│      Frontend Route                      │
│  - useQuery(getThread)                   │
│  - useUIMessages(listThreadMessages)     │
│  - useAction(sendMessage)                │
└──────┬──────────────────────────────────┘
       │
       │ 2. Query thread & messages
       ▼
┌──────────────────────────────────────────┐
│     Convex Queries/Actions               │
│  - getThread                             │
│  - listThreadMessages (with streams)     │
│  - sendMessage (action)                  │
└──────┬───────────────────────────────────┘
       │
       │ 3. Stream AI response
       ▼
┌───────────────────────────────────────────┐
│    Agent Component                        │
│  - agent.streamText()                     │
│  - Saves stream deltas automatically      │
└───────────────────────────────────────────┘
```

### Component Interaction Map
```
Route Component
└── ChatPanel
    ├── Conversation (scrollable container)
    │   └── StreamingMessage (individual messages)
    │       └── Response (streamed text with smooth rendering)
    └── PromptInput (message input with submit)
```

### Integration Points
- **Clerk Auth**: Authentication and organization context
- **Convex Agent Component**: AI streaming, message storage, delta management
- **AI SDK (via Agent)**: LLM provider integration (OpenAI/Anthropic/xAI)

---

## 3. Database Schema

### Custom Tables

#### `threads` - Organization to Agent Thread mapping
```typescript
{
  userId: string,          // Stores agentThreadId (architecture quirk)
  organizationId: string,  // Clerk org ID
  title?: string          // Thread name
}
```
**Indexes:**
- `by_user` on `[userId]`
- `by_organization` on `[organizationId]`

**Note:** The `userId` field stores the Agent component's thread ID. This is a workaround - Thread ID mapping is required since Agent component doesn't know about orgs.

### Component Schema (Managed by Convex Agent Component)

The Agent component automatically creates and manages these tables:

- **`messages`**: Stores all chat messages with streaming deltas
- **`threads`**: Agent's internal thread management
- **`streams`**: Tracks streaming state for in-progress responses

**Key Point:** You only need custom tables for organization mapping. The Agent component handles all message storage and streaming.

---

## 4. Core Logic

### Thread Management Pattern
```typescript
// 1. Check if thread exists for organization
// 2. If not, create thread via Agent component
// 3. Store mapping in custom `threads` table
// 4. Return agent thread ID for all operations
```

**Key insight:** You maintain a lightweight mapping table while the Agent component does heavy lifting.

### Streaming Delta Architecture
```typescript
// Convex Agent component provides:
// - Word-by-word text streaming
// - Automatic delta storage
// - syncStreams() query to fetch deltas

// Frontend hook (useUIMessages):
// - Returns regular messages + streams array
// - Streams contain deltas for in-progress messages
// - useSmoothText() renders deltas smoothly
```

### Authentication Pattern
```typescript
// Every backend function must:
// 1. Get user identity from ctx.auth.getUserIdentity()
// 2. Extract organizationId from identity
// 3. Verify organizationId exists
// 4. Use organizationId for all data queries
```

---

## 5. API/Backend Patterns

### Action: `sendMessage`
**Purpose:** Send user message, get AI response with streaming

**Request:**
```typescript
{
  message: string,
  threadId?: string      // Optional, will create if not provided
}
```

**Response:**
```typescript
{
  success: boolean,
  response: string,      // Complete AI response
  threadId: string       // Thread ID for future messages
}
```

**Flow:**
1. Authenticate user, extract `organizationId`
2. Get or create thread for organization
3. Call `agent.streamText()` with streaming deltas enabled
4. Await completion
5. Return result

**Streaming Configuration:**
```typescript
saveStreamDeltas: {
  chunking: "word",     // Word-by-word streaming
  throttleMs: 100       // Save deltas every 100ms
}
```

### Query: `listThreadMessages`
**Purpose:** Fetch thread messages with streaming support

**Request:**
```typescript
{
  threadId: string,
  paginationOpts: PaginationOpts,
  streamArgs: StreamArgs  // For syncing streams
}
```

**Response:**
```typescript
{
  ...paginatedMessages,  // Regular message list
  streams: Array<{       // In-progress streaming deltas
    messageId: string,
    deltas: Array<Delta>
  }>
}
```

**Flow:**
1. Authenticate, verify organization
2. Call `listUIMessages()` from Agent component
3. Call `syncStreams()` for in-progress deltas
4. Merge and return

**Note:** This query is reactive - re-runs automatically when new deltas arrive.

### Query: `getThread`
**Purpose:** Get thread for organization

**Request:** None (uses auth context)

**Response:**
```typescript
{
  threadId: string  // Agent thread ID
} | null            // If doesn't exist yet
```

**Flow:**
1. Authenticate, extract `organizationId`
2. Query `threads` table for thread
3. Return stored `agentThreadId` (in `userId` field) or null

### Internal Action: `getOrCreateThread`
**Purpose:** Create thread if doesn't exist

**Request:**
```typescript
{
  userId: string,
  organizationId: string
}
```

**Response:** `string` (thread ID)

**Flow:**
1. Check for existing mapping in `threads` table
2. If exists, return `agentThreadId`
3. If not, call `createThread()` from Agent component
4. Save mapping in `threads` table
5. Return new `agentThreadId`

---

## 6. Frontend Structure

### Route Component
**Responsibilities:**
- Load thread on mount
- Load messages with streaming
- Handle message submission

**Key Hooks:**
- `useAuth()` - Get organization context
- `useQuery(getThread)` - Load/watch thread
- `useUIMessages(listThreadMessages)` - Load messages with streams
- `useAction(sendMessage)` - Send messages to AI

**State Management:**
- `isStreaming` - Derived from messages (any with status "streaming")
- `messages` - Reactive list from `useUIMessages`
- `streams` - Delta arrays from `useUIMessages`

### Component: `ChatPanel`
**Responsibilities:**
- Display message list in scrollable container
- Show prompt input with submit button

**Props:**
```typescript
{
  messages: UIMessage[],
  onSendMessage: (message: string) => Promise<void>,
  isStreaming?: boolean,
  streams?: StreamDelta[]
}
```

### Component: `StreamingMessage`
**Responsibilities:**
- Render individual message with smooth text streaming
- Handle assistant and user messages

**Hook: `useSmoothText`**
```typescript
const [visibleText] = useSmoothText(message.text, {
  startStreaming: message.status === "streaming"
});
// Gradually reveals text character-by-character for smooth effect
```

### Shared UI Components
- `Conversation` / `ConversationContent` - Chat scrollable container
- `Message` / `MessageContent` - Individual message wrapper
- `Response` - AI response text display
- `PromptInput` / `PromptInputTextarea` / `PromptInputSubmit` - Message input

---

## 7. Key Code Snippets

### Creating Agent
```typescript
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";

export const chatAgent = new Agent(components.agent, {
  name: "Chat Assistant",
  instructions: `You are a helpful AI assistant...`,
  languageModel: 'xai/grok-4-fast-non-reasoning',
  maxSteps: 10,
  callSettings: {
    maxRetries: 2,
    temperature: 0.7,
  },
});
```

### Streaming AI Response with Deltas
```typescript
const result = await chatAgent.streamText(
  ctx,
  { threadId },
  {
    prompt: userMessage,
  },
  {
    saveStreamDeltas: {
      chunking: "word",
      throttleMs: 100,
    },
  }
);

// Await final text (streaming happens in background)
const responseText = await result.text;
```

### Authentication in Backend Functions
```typescript
export const sendMessage = action({
  args: { message: v.string(), threadId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Extract organization ID
    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected");
    }

    // Use organizationId for all operations...
  },
});
```

---

## 8. Configuration

### Environment Variables
```bash
# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_JWT_ISSUER_DOMAIN=your-domain.clerk.accounts.dev

# Convex
CONVEX_DEPLOYMENT=prod:your-deployment
CONVEX_URL=https://....convex.cloud

# AI Provider (for Convex Agent component)
# Set in Convex dashboard environment variables:
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
```

### Convex Configuration

**convex.json:**
```json
{
  "functions": "convex/",
  "components": [
    {
      "name": "agent",
      "path": "node_modules/@convex-dev/agent"
    }
  ]
}
```

**Authentication Setup (convex/auth.config.ts):**
```typescript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
};
```

### Required Dependencies

**Frontend:**
```json
{
  "@convex-dev/agent": "^0.2.11",
  "@clerk/tanstack-react-start": "^0.26.3",
  "convex": "^1.27.3"
}
```

**Backend (Convex):**
```json
{
  "@convex-dev/agent": "^0.2.11"
}
```

### Agent Language Model Configuration
```typescript
// In agent.ts:
languageModel: 'xai/grok-4-fast-non-reasoning'

// Supported formats:
// - 'openai/gpt-4'
// - 'anthropic/claude-3-5-sonnet-20241022'
// - 'xai/grok-4-fast-non-reasoning'
```

---

## 9. Implementation Checklist

### Setup Tasks
- [ ] Install Convex Agent component: `npx convex import @convex-dev/agent`
- [ ] Set up Clerk authentication with Organizations enabled
- [ ] Configure environment variables (Clerk, Convex, AI API keys)
- [ ] Add agent component reference to `convex.json`
- [ ] Create `convex/auth.config.ts` with Clerk JWT configuration

### Backend Implementation Steps
1. **Schema Setup**
   - [ ] Define `threads` table with org index
   - [ ] Run schema push: `npx convex dev`

2. **Agent Setup**
   - [ ] Create `convex/agent.ts` with Agent instance
   - [ ] Configure agent name, instructions, model

3. **Actions & Queries**
   - [ ] Implement `getOrCreateThread` (internal action)
   - [ ] Implement `sendMessage` action with streaming
   - [ ] Implement `getThread` query
   - [ ] Implement `listThreadMessages` query with streams

4. **Mutations**
   - [ ] Create `saveThreadMapping` internal mutation

### Frontend Implementation Steps
1. **Route Setup**
   - [ ] Create chat playground route file
   - [ ] Add organization check (redirect if none)
   - [ ] Set up `useQuery` for thread loading
   - [ ] Set up `useUIMessages` for messages + streams
   - [ ] Set up `useAction` for sending messages
   - [ ] Calculate `isStreaming` state from messages

2. **Chat Components**
   - [ ] Create `ChatPanel` component
   - [ ] Create `StreamingMessage` component
   - [ ] Implement `useSmoothText` hook integration

3. **Layout & UI**
   - [ ] Style chat messages (user vs assistant)
   - [ ] Add loading states (thread loading, message sending)
   - [ ] Add empty states (no messages)

### Testing Requirements
- [ ] **Authentication Flow**
  - [ ] User without org is blocked
  - [ ] Thread creation tied to organization
  - [ ] Multiple org members see same thread

- [ ] **Streaming Behavior**
  - [ ] Text streams smoothly word-by-word
  - [ ] Messages appear in real-time

- [ ] **Edge Cases**
  - [ ] Handle message send during active streaming (disable submit)
  - [ ] Handle network disconnection during stream (reconnect)

### Deployment Considerations
- [ ] Set AI API keys in Convex dashboard (production environment)
- [ ] Configure Clerk production instance
- [ ] Test multi-tenant isolation (org A can't see org B's threads)
- [ ] Monitor Convex function execution times (streaming can be long)
- [ ] Set up error tracking
- [ ] Document rate limits for AI API (handle 429 errors)
- [ ] Set up usage monitoring/limits per organization

---

## 10. Key Gotchas

### Multi-tenant Thread Isolation
**Pattern:** Always use `organizationId` from `identity.organizationId`, never trust client.

```typescript
// ❌ DON'T
const orgId = args.organizationId; // Client could fake this

// ✅ DO
const identity = await ctx.auth.getUserIdentity();
const orgId = identity.organizationId;
```

### Handling Streaming State Across Clients
**Pattern:** Multiple users in same org should see same streaming state.

The `syncStreams()` function fetches current deltas for all users. No special work needed - Convex handles this via reactive queries.

### Agent Thread ID Storage Quirk
**Gotcha:** This codebase stores `agentThreadId` in the `userId` field of `threads` table.

**Reason:** Quick workaround to avoid schema migration during rapid prototyping.

**Better approach:** Add dedicated `agentThreadId` field to schema.

### Performance: Word Chunking Throttle
**Pattern:** Balance responsiveness vs database load.

```typescript
saveStreamDeltas: {
  chunking: "word",    // vs "sentence" or "character"
  throttleMs: 100      // Save every 100ms
}
```

Lower throttle = smoother but more DB writes. Higher = choppier but cheaper.

**Recommendation:** 50-200ms is good range.

---

## 11. Common Issues & Debugging

### Issue: Messages not streaming
**Symptom:** Messages appear all at once instead of word-by-word.

**Debug:**
1. Check `useUIMessages` includes stream args
2. Verify `saveStreamDeltas` is set in `streamText` call
3. Check browser console for streaming logs
4. Verify `message.status === "streaming"` in UI

### Issue: "No organization selected" error
**Symptom:** Backend throws error about missing organization.

**Debug:**
1. Verify `identity.organizationId` is defined (not `identity.orgId`)
2. Check Clerk organization is selected in frontend
3. Verify Clerk JWT contains organization claim
4. Test with `console.log(identity)` in backend function

---

## 12. Further Reading

### Convex Agent Component
- Docs: https://docs.convex.dev/components/agent
- GitHub: https://github.com/get-convex/agent

### Clerk Organizations
- Docs: https://clerk.com/docs/organizations/overview
- Multi-tenancy guide: https://clerk.com/docs/organizations/building-a-multi-tenant-application

---

**End of Implementation Guide**
