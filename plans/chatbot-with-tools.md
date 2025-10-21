# Chatbot with Tools - Development Plan

## 1. Database Design

### New Tables

**threads** (auto-created by agent component)
- `userId`: string - Links to auth user
- `title`: optional string - Thread name
- `summary`: optional string - Thread description
- `metadata`: optional object - Custom thread data

**messages** (auto-created by agent component)
- `threadId`: string - Links to thread
- `role`: "user" | "assistant" | "tool"
- `content`: string | array - Message content
- `metadata`: optional object - Usage tracking, model info

### Queries

**`threads.list`**
- Input: userId (from auth)
- Output: Array of thread objects with metadata
- Purpose: Display user's chat history

**`threads.get`**
- Input: threadId, userId
- Output: Single thread with messages
- Purpose: Load conversation for chat UI

**`messages.list`**
- Input: threadId, pagination opts
- Output: Paginated messages with role/content
- Purpose: Render chat messages in UI

**`chat.sendMessage`** (mutation)
- Input: threadId, prompt (user message)
- Output: messageId
- Purpose: Save user message and trigger async AI response

**`chat.generateResponse`** (action)
- Input: threadId, promptMessageId
- Output: AI response text
- Purpose: Generate AI reply with tool calls

## 2. Data Flow

1. **User sends message** → Save to messages table → Trigger async response generation
2. **AI processes** → Fetch context from thread → Call tools if needed → Generate response
3. **Tools execute** → Search ads DB → Query subscriptions → Return structured data
4. **Response saved** → Store in messages → Real-time sync to UI via Convex subscriptions
5. **UI updates** → Display streaming/final response with tool results

### Key Transformations

- User input → Message doc with embeddings (for RAG context)
- Tool results → Formatted content in message
- AI response → Saved message with usage metadata
- Thread history → Context window for next generation

## 3. User Flows

### User Flow

1. Navigate to /chat route
2. See list of previous threads (or empty state)
3. Click "New Chat" or select existing thread
4. Type message and hit send
5. See user message appear immediately
6. Watch AI response stream/appear
7. View tool calls (e.g., "Searching ads for 'SaaS'...")
8. Continue conversation with context awareness
9. Access thread history in sidebar

## 4. UI Components

### `ChatLayout`
- **Purpose**: Overall chat page structure with sidebar + main area
- **Interactions**: Create new thread, select thread, delete thread
- **Data**: List of threads from `threads.list`

### `ThreadList` (sidebar)
- **Purpose**: Display user's chat history
- **Interactions**: Click to load thread, delete thread
- **Data**: Thread titles, summaries, last message timestamp

### `ChatWindow`
- **Purpose**: Main chat interface for active thread
- **Interactions**: Send messages, scroll history, view tool calls
- **Data**: Messages from `messages.list`, thread metadata

### `MessageBubble`
- **Purpose**: Render individual message (user/assistant/tool)
- **Interactions**: Copy text, view raw tool results
- **Data**: Message role, content, timestamp, tool call info

### `ChatInput`
- **Purpose**: Textarea for user input with send button
- **Interactions**: Type message, submit (Enter or button), handle loading state
- **Data**: Draft message text, sending status

### `ToolCallIndicator`
- **Purpose**: Show when AI is calling tools (searching ads, etc.)
- **Interactions**: None (display only)
- **Data**: Tool name, args, result preview

## 5. API Routes (Convex Functions)

### `convex/chat/functions.ts`

**`chat.createThread`** (mutation)
- **Purpose**: Create new chat thread
- **Input**: userId (from auth), optional title
- **Output**: threadId

**`chat.listThreads`** (query)
- **Purpose**: Get user's threads
- **Input**: userId
- **Output**: Array of threads with metadata

**`chat.getThread`** (query)
- **Purpose**: Get single thread with messages
- **Input**: threadId, userId
- **Output**: Thread object with messages array

**`chat.sendMessage`** (mutation)
- **Purpose**: Save user message and trigger AI
- **Input**: threadId, prompt
- **Output**: messageId

**`chat.generateResponseAsync`** (internal action)
- **Purpose**: Generate AI response with tools
- **Input**: threadId, promptMessageId
- **Output**: void (saves response to DB)

**`chat.deleteThread`** (mutation)
- **Purpose**: Remove thread and messages
- **Input**: threadId, userId
- **Output**: void

### Tools (for AI agent)

**`searchAds`** (createTool)
- **Purpose**: Let AI search user's ad database
- **Input**: query string, optional filters (platform, date range)
- **Output**: Array of matching ads with metadata

**`getSubscriptions`** (createTool)
- **Purpose**: Let AI view user's subscriptions
- **Input**: None (uses userId from context)
- **Output**: Array of active subscriptions

**`getAdDetails`** (createTool)
- **Purpose**: Get full details of specific ad
- **Input**: adId
- **Output**: Complete ad object with advertiser info

## 6. Patterns to Reuse

### Authentication Pattern
- Use `getAuthUserId(ctx)` consistently (from auth system)
- Check ownership before returning thread/message data
- Pattern from `convex/ads/functions.ts:14-17`

### Message Creation Pattern
- Use `saveMessage` from agent component
- Trigger async response via `ctx.scheduler.runAfter(0, ...)`
- Pattern: Save → Schedule → Generate (from agent docs)

### Query Pattern
- Indexed queries on userId for fast lookups
- Batch fetch related data (similar to ads + advertisers pattern)
- Pattern from `convex/ads/functions.ts:42-57`

### Tool Creation Pattern
```typescript
const searchAds = createTool({
  description: "Search user's ads by query",
  args: z.object({ query: z.string() }),
  handler: async (ctx, args): Promise<Array<Ad>> => {
    const userId = ctx.userId; // Available in tool context
    return await ctx.runQuery(api.ads.search, { userId, query: args.query });
  },
});
```

### Real-time Sync Pattern
- Use Convex subscriptions (like current ad feed)
- UI auto-updates when messages saved
- No manual polling needed

### Error Handling Pattern
- Verify auth in every function
- Check ownership before mutations
- Return structured errors to UI

## Implementation Notes

- **MVP Scope**: Single agent with 2-3 basic tools (search ads, get subscriptions)
- **No streaming initially**: Show loading state, then full response (add streaming later)
- **Manual thread management**: No auto-titles (user sets or default to "New Chat")
- **Simple UI**: Focus on functionality over polish
- **Reuse components**: Data table, cards, etc. from existing features
