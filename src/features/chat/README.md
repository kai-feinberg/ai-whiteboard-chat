# Chat Feature

Reusable chat component with multi-thread support using Convex AI Agent component.

## Architecture

### Backend (`convex/chat/functions.ts`)

**Thread Management:**
- `createChatThread` - Create new chat thread for organization
- `listThreads` - Get all threads for organization (sorted by most recent)
- `getThread` - Get specific thread by ID
- `updateThreadTitle` - Update thread title
- `deleteThread` - Delete a thread

**Messaging:**
- `sendMessage` - Send message to AI with streaming support
- `listMessages` - Get messages for thread with streaming deltas

**Key Features:**
- Multi-tenant: All threads scoped to `organizationId`
- Multiple threads per organization
- Real-time streaming with word-by-word deltas
- Auto-updates thread timestamp on new messages

### Frontend Components

**Chat Component** (`components/Chat.tsx`)
- Reusable chat interface
- Props:
  - `variant`: "fullscreen" | "compact" (for canvas nodes)
  - `messages`: UIMessage array
  - `onSendMessage`: Message send handler
  - `isStreaming`: Streaming status
  - `streams`: Stream deltas array
- Features:
  - Smooth text streaming with `useSmoothText`
  - Auto-scrolling conversation
  - Loading states
  - Empty state

**ThreadSidebar Component** (`components/ThreadSidebar.tsx`)
- Thread list with sidebar UI
- Create new threads
- Select threads
- Delete threads
- Shows last updated date

### Routes

**Playground Page** (`/playground`)
- Full-screen chat interface
- Thread sidebar + chat area
- Auto-selects first thread on load
- Handles thread creation/deletion
- Organization-scoped access

## Usage

### Creating a New Thread

```typescript
const createThreadAction = useAction(api.chat.functions.createChatThread);

const result = await createThreadAction({
  title: "My Chat Thread",
});
// Returns: { threadId, agentThreadId, title }
```

### Loading Messages with Streaming

```typescript
const { results: messages, streams } = useUIMessages(
  api.chat.functions.listMessages,
  selectedThread?.agentThreadId ? { agentThreadId: selectedThread.agentThreadId } : "skip",
  {
    initialNumItems: 50,
    stream: true,
  }
);

const isStreaming = messages?.some((m) => m.status === "streaming") ?? false;
```

### Sending Messages

```typescript
const sendMessageAction = useAction(api.chat.functions.sendMessage);

await sendMessageAction({
  threadId: selectedThreadId,
  message: "Hello AI!",
});
```

### Using Chat Component

**Fullscreen:**
```tsx
<Chat
  messages={messages}
  onSendMessage={handleSendMessage}
  isStreaming={isStreaming}
  streams={streams}
  variant="fullscreen"
/>
```

**Compact (for canvas nodes):**
```tsx
<Chat
  messages={messages}
  onSendMessage={handleSendMessage}
  isStreaming={isStreaming}
  streams={streams}
  variant="compact"
  className="h-96"
/>
```

## Database Schema

**threads table:**
```typescript
{
  agentThreadId: string,      // Agent component thread ID
  userId: string,             // Creator user ID
  organizationId: string,     // Clerk organization ID
  title?: string,             // Thread title
  createdAt: number,          // Creation timestamp
  updatedAt: number,          // Last update timestamp
}
```

**Indexes:**
- `by_user`: [userId]
- `by_organization`: [organizationId]
- `by_org_updated`: [organizationId, updatedAt] - For sorted list

## Agent Configuration

Located in `convex/chat/functions.ts`:

```typescript
const chatAgent = new Agent(components.agent, {
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

## Streaming Configuration

Word-by-word streaming with 100ms throttle:

```typescript
saveStreamDeltas: {
  chunking: "word",
  throttleMs: 100,
}
```

## Authentication

All functions check:
1. User is authenticated (`ctx.auth.getUserIdentity()`)
2. Organization is selected (`identity.organizationId`)
3. Data belongs to user's organization (ownership checks)

## Future Enhancements

- [ ] Add canvas node variant of Chat component
- [ ] Auto-generate thread titles from first message
- [ ] Thread search/filter
- [ ] Export chat history
- [ ] Custom agent configurations per thread
- [ ] Attach context (files, images) to messages
