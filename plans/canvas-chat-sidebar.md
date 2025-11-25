# Canvas Chat Sidebar Implementation Plan

## Database Design

**No new tables required** - reuses existing infrastructure:
- `threads` table - already scoped to `canvasId`
- `canvas_nodes` table - chat nodes already exist
- `canvas_edges` table - connection tracking for context gathering

**Queries to reuse:**
- `listCanvasThreads(canvasId)` - returns all threads for canvas
- `createCanvasThread(canvasId, title?, modelId?)` - creates new thread
- `sendMessage(threadId, canvasNodeId, message, agentId?, modelId?)` - sends message with context
- `getNodeContextInternal(canvasNodeId, organizationId)` - gathers context from connected nodes
- `listMessages(agentThreadId)` - loads message history

## Data Flow

1. **User opens canvas** → Canvas route renders, sidebar hidden by default (localStorage state)
2. **User toggles chat sidebar** → Right sidebar slides in, canvas resizes responsively
3. **Sidebar loads threads** → Query `listCanvasThreads`, auto-select first or last active
4. **User sends message** → Gathers context from connected nodes → Sends to AI → Streams response
5. **Context updates** → When nodes/edges change, context query re-runs automatically (Convex reactivity)

**Key transformations:**
- Canvas node connections → Context messages for AI (via `getNodeContextInternal`)
- Agent selection + model selection → System prompt + model override
- Thread state → Persisted to localStorage (selected thread, agent, model per canvas)

## User Flows

**Main user flow:**
1. Open canvas with existing nodes
2. Click "Chat" button in canvas toolbar (top-right)
3. Right sidebar slides in with thread list + chat interface
4. Select existing thread OR create new thread
5. Chat interface shows: ThreadSidebar (left 280px) + Chat area (rest)
6. Connect nodes to provide context → Context indicator updates in ThreadSidebar
7. Select agent/model → Send message → AI responds with context
8. Toggle sidebar closed → Continue editing canvas
9. Reopen sidebar → Same thread/state restored (localStorage)

**Context gathering flow:**
1. User draws edge from YouTube/Website/Text node → Chat node
2. Edge creates connection in DB (`canvas_edges`)
3. Context indicator in ThreadSidebar updates: "Context from 3 connected nodes"
4. User clicks "View Context" → Dialog shows full context that will be sent to AI
5. User sends message → Backend gathers context via edges → Includes in system prompt

## UI Components

### 1. **ChatSidebarButton**
- **Purpose:** Toggle button in canvas toolbar to show/hide chat sidebar
- **Location:** Canvas route top-right (near node add buttons)
- **Interactions:** Click to toggle, shows badge if unread messages exist
- **Data:** Sidebar open state (from localStorage/context)

### 2. **CanvasChatSidebar** (new component)
- **Purpose:** Right sidebar containing full chat interface
- **Layout:** Fixed width (680px) on desktop, full-screen sheet on mobile
- **Contains:** ThreadSidebar (280px) + Chat component (flex-1)
- **Interactions:** Close button, collapsible behavior, drag to resize (future)
- **Data:** Canvas ID, threads, selected thread, messages, context

### 3. **Modified Canvas Layout**
- **Current:** Full-width canvas with left AppSidebar
- **New:** Flex container with canvas (flex-1) + optional right CanvasChatSidebar
- **Responsive:** Canvas resizes when sidebar opens, maintains ReactFlow viewport

### 4. **Reused Components**
- `Chat` component - from `src/features/chat/components/Chat.tsx`
- `ThreadSidebar` - from `src/features/chat/components/ThreadSidebar.tsx`
- `AgentSelector` - agent dropdown (already in Chat)
- `ModelSelector` - model dropdown (already in Chat)

## API Routes

**All existing Convex functions - no new backend code required:**

- `api.canvas.threads.listCanvasThreads` (query)
  - **Input:** `{ canvasId: Id<"canvases"> }`
  - **Output:** `Thread[]`
  - **Purpose:** Load all threads for canvas to display in ThreadSidebar

- `api.canvas.threads.createCanvasThread` (action)
  - **Input:** `{ canvasId, title?, modelId? }`
  - **Output:** `{ threadId, agentThreadId }`
  - **Purpose:** Create new thread when user clicks "New Chat"

- `api.canvas.chat.sendMessage` (action)
  - **Input:** `{ threadId, canvasNodeId, message, agentId?, modelId? }`
  - **Output:** `{ success, response }`
  - **Purpose:** Send message with context from connected nodes

- `api.canvas.nodes.getNodeContext` (query) - **or reuse internal version**
  - **Input:** `{ canvasNodeId }`
  - **Output:** `Array<{ role: "system", content: string }>`
  - **Purpose:** Display context preview in ThreadSidebar

- `api.chat.functions.listMessages` (query via useUIMessages hook)
  - **Input:** `{ threadId: agentThreadId }`
  - **Output:** `UIMessage[]`
  - **Purpose:** Load message history for selected thread

- `api.chat.functions.deleteThread` (mutation)
  - **Input:** `{ threadId }`
  - **Output:** `{ success }`
  - **Purpose:** Delete thread from ThreadSidebar

## Patterns to Reuse

### 1. **Full-screen chat route pattern** (`/canvas/$canvasId/chat`)
- Copy thread management logic (create, select, delete)
- Copy message sending with credit checks
- Copy agent/model state persistence (localStorage)
- Copy context gathering and display

### 2. **Sidebar infrastructure** (`src/components/ui/sidebar.tsx`)
- Use `Sidebar` component with `side="right"`
- NOT using `SidebarProvider` wrapper (conflicts with existing left sidebar)
- Manual state management with useState + localStorage
- Mobile: Use Sheet component instead of Sidebar

### 3. **Chat component reusability**
- Already designed with `variant` prop (fullscreen | compact)
- Reuse exact same component, no modifications needed
- Pass same props: messages, onSendMessage, selectedAgentId, etc.

### 4. **Context gathering from canvas**
- Pattern: Find chat node → Query edges → Fetch connected node data
- Already implemented in `getNodeContextInternal` (reuse via internal call)
- Context updates automatically via Convex reactivity when edges change

### 5. **Credit checking before send**
- Copy pattern from full-screen chat: Check balance → Block if zero → Warn if low
- Use `useCustomer` hook from autumn-js
- Refetch after send to update sidebar credits display

### 6. **Agent/Model persistence**
- localStorage keys: `canvas-agent-${canvasId}`, `canvas-model-${canvasId}`
- Load on mount, persist on change
- Default to "default" agent and "anthropic/claude-haiku-4.5" model

### 7. **Mobile responsive pattern**
- Desktop: Fixed-width sidebar (680px)
- Mobile: Full-screen Sheet overlay (same as existing ThreadSidebar on mobile)
- Use `useIsMobile` hook from `src/hooks/use-mobile.ts`

## Implementation Steps

### Phase 1: Sidebar UI (30 min)
1. Create `src/features/canvas/components/CanvasChatSidebar.tsx`
2. Add sidebar toggle state to canvas route (useState + localStorage)
3. Add toggle button to canvas toolbar (MessageSquare icon)
4. Render sidebar conditionally with slide-in animation

### Phase 2: Chat Integration (20 min)
1. Copy thread management logic from full-screen chat route
2. Wire up ThreadSidebar + Chat components inside CanvasChatSidebar
3. Connect to existing Convex queries/actions (no backend changes)
4. Handle thread selection, creation, deletion

### Phase 3: Context & Messaging (15 min)
1. Find first chat node on canvas for context gathering (or create one if needed)
2. Wire up context query to ThreadSidebar
3. Implement message sending with credit checks
4. Handle agent/model selection with localStorage persistence

### Phase 4: Polish (10 min)
1. Add keyboard shortcut (Cmd+K) to toggle sidebar
2. Add unread badge to toggle button (future enhancement)
3. Test responsive behavior (canvas resize, mobile sheet)
4. Add loading/error states

## Technical Considerations

**Canvas resize handling:**
- ReactFlow handles viewport recalculation automatically
- Use CSS transitions for smooth sidebar open/close (300ms)
- Canvas width: `calc(100% - 680px)` when sidebar open

**State management:**
- Sidebar open state: localStorage + useState (per-canvas)
- Selected thread: localStorage + useState (per-canvas)
- Agent/model: localStorage (per-canvas, matches full-screen pattern)

**Performance:**
- Sidebar only mounts when open (conditional render)
- Queries pause when sidebar closed (Convex "skip" pattern)
- Context gathering is cached by Convex reactivity

**Mobile strategy:**
- Use Sheet component (full-screen overlay) instead of Sidebar
- Hide canvas node toolbar when chat sheet open
- Swipe to close gesture (Sheet default behavior)

**Gotchas:**
- Don't nest SidebarProvider (already have one in __root.tsx)
- Must find chat node on canvas for context gathering (create placeholder if none exist)
- Credit checks happen on send, not on open (same as full-screen)
- Thread titles auto-generate after first message (existing behavior)

## Success Metrics

**MVP complete when:**
- ✅ Sidebar toggles open/close smoothly
- ✅ Can create threads, send messages, view responses
- ✅ Context from connected nodes appears in chat
- ✅ Agent/model selection persists per canvas
- ✅ Canvas resizes correctly when sidebar opens
- ✅ Mobile view uses full-screen sheet
- ✅ Credits deduct correctly, sidebar updates

**Future enhancements:**
- Unread message badges on toggle button
- Drag-to-resize sidebar width
- Split view with canvas + chat side-by-side (no overlay)
- Chat history search within sidebar
- Pin frequently used threads
