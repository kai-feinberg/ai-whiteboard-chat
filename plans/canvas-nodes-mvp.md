# Canvas Nodes MVP - Development Plan

## Overview

### Goal
Build an infinite canvas system where users can create, connect, and interact with different types of content nodes (text, chat, YouTube, PDFs, etc.). Nodes can be connected via edges to establish context relationships, enabling AI chat nodes to receive aggregated context from multiple connected sources.

**Core Value Proposition:**
- Visual context management for AI conversations
- Reusable content nodes across conversations
- Team collaboration on shared canvases
- Transparent context → AI → output workflow

### High-Level Architecture
```
Canvas Dashboard (list all canvases)
  ↓
Canvas Editor (ReactFlow infinite canvas)
  ├── Text Nodes (markdown content)
  ├── Chat Nodes (AI conversations with threads)
  ├── YouTube Nodes (video transcripts) [Phase 2]
  ├── PDF Nodes (document text extraction) [Phase 2]
  └── Edges (visual connections = context flow)

When chat node receives message:
  1. Traverse incoming edges
  2. Gather context from connected nodes
  3. Aggregate into system message
  4. Pass to AI agent (existing Convex agent component)
  5. Stream response back to chat node
```

### Implementation Phases

**Phase 1: Core Canvas (MVP)** - Text + Chat nodes only
- Canvas CRUD (create, list, load)
- Text nodes (markdown editor)
- Chat nodes (AI conversations)
- Edge connections (drag to connect)
- Context aggregation (traverse graph)
- Real-time sync (Convex reactivity)

**Phase 2: Rich Content Nodes**
- YouTube nodes (Firecrawl transcripts)
- Twitter/X nodes (react-tweet embeds)
- Voice note nodes (audio → text)
- PDF nodes (upload + extraction)

**Phase 3: Polish & Scale**
- Node notes/annotations
- Cost transparency (token counts)
- Canvas sharing (org permissions)
- Export/import functionality
- Performance optimization (100+ nodes)

### Critical Patterns

**Dual Storage Pattern:**
- Node content stored in type-specific tables (text_nodes, chat_nodes)
- Node positions/edges stored in canvas_nodes + canvas_edges
- Enables type-specific queries + generic canvas operations

**Canvas State Sync (ReactFlow ↔ Convex):**
- **Load:** DB → ReactFlow (once on mount, reconstruct from tables)
- **Save:** ReactFlow → DB (debounced 2s auto-save on changes)
- **Real-time:** Convex subscriptions push updates to ReactFlow

**Node ID Convention:**
- Format: `{nodeType}_{databaseId}` (e.g., "text_abc123", "chat_def456")
- Enables quick type detection and DB lookup

---

## 1. Database Design

### New Tables

**canvases**
- `_id`: ID
- `organizationId`: string (indexed)
- `title`: string
- `description`: optional string
- `createdAt`: number (timestamp)
- `updatedAt`: number (timestamp)
- `createdBy`: string (userId)

Indexes: `by_organization` on `organizationId`

**canvas_state**
- `_id`: ID
- `canvasId`: ID (reference to canvases, unique)
- `organizationId`: string
- `viewport`: object `{ x: number, y: number, zoom: number }`
- `updatedAt`: number

Indexes: `by_canvas` on `canvasId` (unique - one state per canvas)

**canvas_nodes**
- `_id`: ID
- `canvasId`: ID (reference to canvases)
- `organizationId`: string (indexed)
- `nodeType`: string enum ("chat" | "text" | "youtube" | "twitter" | "voice" | "pdf")
- `position`: object `{ x: number, y: number }`
- `width`: number
- `height`: number
- `data`: object (node-specific data, varies by type)
- `notes`: optional string (user-added context notes)
- `createdAt`: number
- `updatedAt`: number

Indexes: `by_canvas` on `canvasId`, `by_organization` on `organizationId`

**canvas_edges**
- `_id`: ID
- `canvasId`: ID
- `organizationId`: string
- `source`: ID (source node)
- `target`: ID (target node)
- `sourceHandle`: optional string
- `targetHandle`: optional string
- `createdAt`: number

Indexes: `by_canvas` on `canvasId`

**Node-specific tables (start with essential):**

**text_nodes**
- `_id`: ID
- `organizationId`: string
- `content`: string (markdown text)
- `createdAt`: number
- `updatedAt`: number

**chat_nodes**
- `_id`: ID
- `organizationId`: string
- `threadId`: string (reference to threads table - agent component)
- `agentId`: optional string (which agent/model to use)
- `connectedNodeIds`: array of IDs (nodes feeding context)
- `createdAt`: number

### Key Queries

**listCanvases**
- Input: `organizationId`
- Output: Array of canvas objects with metadata (id, title, createdAt, updatedAt)
- Purpose: Display canvas list on dashboard

**getCanvas**
- Input: `canvasId`, `organizationId`
- Output: Canvas + all nodes + edges for that canvas
- Purpose: Load full canvas state for editor

**createNode**
- Input: `canvasId`, `organizationId`, `nodeType`, `position`, `data`, `notes`
- Output: Created node ID
- Purpose: Add new node to canvas

**updateNodePosition**
- Input: `nodeId`, `organizationId`, `position`
- Output: Success
- Purpose: Update node x,y when user drags

**deleteNode**
- Input: `nodeId`, `organizationId`
- Output: Success (also deletes connected edges)
- Purpose: Remove node from canvas

**createEdge**
- Input: `canvasId`, `organizationId`, `source`, `target`
- Output: Created edge ID
- Purpose: Connect two nodes

**getNodeContext**
- Input: `nodeId`, `organizationId`
- Output: Context data for AI (text content, notes, connected node context)
- Purpose: Gather context to pass to AI agent

## 2. Data Flow

### Canvas Load Flow
1. User navigates to `/canvas/:id`
2. Frontend queries `getCanvas(canvasId, orgId)`
3. Backend fetches canvas + all nodes + edges
4. ReactFlow initializes with nodes/edges
5. Real-time sync via Convex subscriptions (nodes auto-update)

### Node Creation Flow
1. User clicks "Add Node" button in toolbar
2. Select node type from dropdown
3. Call `createNode` mutation with type + default position
4. Node-specific data initialized (e.g., empty text node, new thread for chat)
5. Node appears on canvas immediately (Convex reactivity)

### Chat Node with Context Flow
1. User creates chat node on canvas
2. User drags edge from text/YouTube node TO chat node
3. Edge stored in `canvas_edges` table
4. When user sends message in chat node:
   - Call `getNodeContext` for all connected nodes
   - Aggregate context (text content + notes)
   - Pass combined context to AI agent via system message
   - Agent responds using thread management

### Node Edit Flow
1. User clicks node to open edit modal/panel
2. Update node data via `updateNode` mutation
3. Changes sync immediately across all viewers

## 3. User Flows

### Admin Flow (Canvas Creator)
- Navigate to dashboard → see canvas list
- Click "New Canvas" → create canvas with default title
- Enter canvas editor (split view: canvas left, properties right)
- Click toolbar → add text node → type content → save
- Add chat node to canvas
- Drag edge from text node → chat node (establishes context connection)
- Click chat node → chat panel opens
- Send message → AI receives text node content as context → responds
- Move nodes by dragging → positions auto-save
- Right-click node → delete → confirm
- Share canvas → invite org members (Clerk permissions)

### End User Flow (Team Member)
- Receive canvas invite via Clerk
- Navigate to canvas from dashboard
- View existing nodes + connections
- Add voice note node → record audio → transcript generated
- Connect voice note → existing chat node
- Continue conversation with expanded context
- Add notes to any node (e.g., "This is the customer feedback")
- Export chat thread as markdown

## 4. UI Components

### CanvasDashboard (`/routes/index.tsx`)
- Lists all canvases for org
- "New Canvas" button
- Canvas cards (title, preview, last edited)
- Search/filter canvases

### CanvasEditor (`/routes/canvas/$canvasId.tsx`)
- Full-screen canvas using ReactFlow
- Toolbar: node type selector (Text, Chat, YouTube, etc.)
- Minimap (bottom-right)
- Controls (zoom, fit view)
- Properties panel (right side, collapsible) → shows selected node details

### Node Components (via `ai-elements/canvas`)
- **TextNode**: Display markdown preview, click to edit
- **ChatNode**: Mini chat interface, click to expand full-screen
- **YouTubeNode**: Embed thumbnail, show transcript length
- **TwitterNode**: Embed tweet preview (react-tweet)
- All nodes have:
  - Header (icon + title)
  - Content area
  - Footer (notes icon, context indicator)
  - Connection handles (left = input, right = output)

### ChatNodePanel (`/features/canvas/components/ChatNodePanel.tsx`)
- Reuses `ChatPanel` component with size="full"
- Shows connected context nodes (badges at top)
- Displays what context is being sent to AI
- Agent/model selector dropdown
- Full chat UI (same as existing ai-chat page)

### NodePropertiesPanel
- Shows selected node details
- Edit notes field (markdown)
- Node-specific settings (e.g., YouTube URL, agent selection)
- Context preview (what AI will receive)
- Delete node button

## 5. API Routes (Convex Functions)

### Canvas Functions (`convex/canvas/functions.ts`)

**listCanvases** (query)
- Args: None (uses identity.organizationId)
- Purpose: Get all canvases for org

**getCanvas** (query)
- Args: `canvasId`
- Purpose: Load canvas with nodes + edges

**createCanvas** (mutation)
- Args: `title`, `description`
- Purpose: Create new canvas for org

**updateCanvas** (mutation)
- Args: `canvasId`, `title`, `description`
- Purpose: Update canvas metadata

**deleteCanvas** (mutation)
- Args: `canvasId`
- Purpose: Delete canvas + all nodes/edges

### Node Functions (`convex/canvas/nodes.ts`)

**createNode** (mutation)
- Args: `canvasId`, `nodeType`, `position`, `data`
- Purpose: Add node to canvas

**updateNode** (mutation)
- Args: `nodeId`, `data`, `position`, `notes`
- Purpose: Update node content/position

**deleteNode** (mutation)
- Args: `nodeId`
- Purpose: Remove node + connected edges

**getNodeContext** (query)
- Args: `nodeId`
- Purpose: Get AI context for node + connected nodes

### Edge Functions (`convex/canvas/edges.ts`)

**createEdge** (mutation)
- Args: `canvasId`, `source`, `target`
- Purpose: Connect two nodes

**deleteEdge** (mutation)
- Args: `edgeId`
- Purpose: Remove connection

## 6. Patterns to Reuse

### Auth Pattern
- Use existing `identity.organizationId` check in all functions
- Verify org ownership for canvasId in all mutations
- Pattern from `agents/actions.ts`:
```typescript
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");
const orgId = identity.organizationId;
if (!orgId || typeof orgId !== "string") throw new Error("No org selected");
```

### Real-time Sync Pattern
- Use Convex queries with `useQuery` hook (same as existing thread/messages)
- Canvas auto-updates when nodes change
- No manual polling needed

### Chat Integration Pattern
- Reuse existing `ChatPanel` component with size prop
- Reuse `sendMessage` action from agents
- Pass aggregated context via system message:
```typescript
const connectedNodes = await getConnectedNodeContext(nodeId);
const contextMessage = `Context:\n${connectedNodes.map(n => n.content).join('\n')}`;
await agent.streamText(ctx, { threadId }, {
  prompt: userMessage,
  system: contextMessage
});
```

### Node Component Pattern
- All nodes use `ai-elements/canvas/Node` wrapper
- Node props include `handles: { target: boolean, source: boolean }`
- Node data stored in `canvas_nodes.data` field (type-specific JSON)
- Custom node types in `nodeTypes` object passed to ReactFlow

### File Upload Pattern (for PDF nodes)
- Use Convex file storage (same as existing patterns)
- Store file ID in node data
- Display preview, extract text for AI context

### Scraping Pattern (for YouTube/Twitter)
- Use Firecrawl action (create new action in `convex/canvas/scraping.ts`)
- Store transcript/text in node-specific table
- Cache results to avoid re-scraping

### Canvas State Sync Pattern (CRITICAL)

**Problem:** ReactFlow manages nodes/edges in local state, but we need to persist to Convex DB and sync across users.

**Solution:** Dual-direction sync with guards

#### Loading from Database (DB → ReactFlow)
Run ONCE on component mount after all data is fetched:

```typescript
useEffect(() => {
  if (!hasLoadedFromDB &&
      canvasNodes !== undefined &&
      canvasEdges !== undefined) {

    // 1. Map database records to ReactFlow nodes
    const flowNodes = canvasNodes.map(dbNode => ({
      id: `${dbNode.nodeType}_${dbNode._id}`,  // Node ID convention
      type: dbNode.nodeType,
      position: dbNode.position,
      data: {
        // Attach database ID for mutations
        dbId: dbNode._id,
        // Node-specific data from dbNode.data
        ...dbNode.data,
        // Attach event handlers (NOT stored in DB)
        onEdit: () => handleEdit(dbNode._id),
        onDelete: () => handleDelete(dbNode._id)
      }
    }));

    // 2. Map database edges
    const flowEdges = canvasEdges.map(dbEdge => ({
      id: dbEdge._id,
      source: `${dbEdge.sourceType}_${dbEdge.source}`,  // Convert DB ID to node ID
      target: `${dbEdge.targetType}_${dbEdge.target}`,
      sourceHandle: dbEdge.sourceHandle,
      targetHandle: dbEdge.targetHandle
    }));

    // 3. Set ReactFlow state
    setNodes(flowNodes);
    setEdges(flowEdges);

    // 4. Restore viewport if saved
    if (canvasViewport) {
      reactFlowInstance.setViewport(canvasViewport);
    }

    setHasLoadedFromDB(true);  // Guard against re-initialization
  }
}, [canvasNodes, canvasEdges, hasLoadedFromDB]);
```

#### Saving to Database (ReactFlow → DB)
Auto-save with debounce ONLY after initial load:

```typescript
useEffect(() => {
  // Don't save before loading from DB
  if (!hasLoadedFromDB) return;

  const saveTimeout = setTimeout(() => {
    // Serialize nodes (remove functions)
    const serializableNodes = nodes.map(node => {
      const [nodeType, dbId] = node.id.split('_');

      return {
        _id: dbId,
        position: node.position,
        data: Object.fromEntries(
          Object.entries(node.data).filter(([key, value]) =>
            typeof value !== 'function' &&
            key !== 'dbId'  // Don't save our internal tracking
          )
        )
      };
    });

    // Save via mutation
    saveCanvasState({
      canvasId,
      nodes: serializableNodes,
      edges: edges.map(e => ({
        _id: e.id,
        source: e.source.split('_')[1],  // Extract DB ID
        target: e.target.split('_')[1],
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle
      })),
      viewport: reactFlowInstance.getViewport()
    });
  }, 2000);  // 2 second debounce

  return () => clearTimeout(saveTimeout);
}, [nodes, edges, hasLoadedFromDB]);
```

#### Real-time Updates (Convex → ReactFlow)
Handle updates from other users WITHOUT triggering re-initialization:

```typescript
// Convex queries auto-update
const canvasNodes = useQuery(api.canvas.nodes.list, { canvasId });

// Sync effect: Merge updates into existing state
useEffect(() => {
  if (!hasLoadedFromDB || !canvasNodes) return;

  setNodes(currentNodes => {
    // Only update nodes that changed
    return currentNodes.map(flowNode => {
      const dbNode = canvasNodes.find(n =>
        `${n.nodeType}_${n._id}` === flowNode.id
      );

      if (!dbNode) return flowNode;  // Node deleted by another user

      // Check if content changed (not position - we're dragging)
      const contentChanged = JSON.stringify(flowNode.data.content) !==
                            JSON.stringify(dbNode.data.content);

      if (contentChanged) {
        return {
          ...flowNode,
          data: {
            ...flowNode.data,
            ...dbNode.data,
            // Preserve event handlers
            onEdit: flowNode.data.onEdit,
            onDelete: flowNode.data.onDelete
          }
        };
      }

      return flowNode;
    });
  });
}, [canvasNodes, hasLoadedFromDB]);
```

#### Key Guards & Validation

**hasLoadedFromDB flag:**
- Prevents saving before initial load (would save empty canvas)
- Prevents re-initializing on Convex updates

**Function filtering:**
- Event handlers (onEdit, onDelete) NOT saved to DB
- Reconstructed on load from local scope

**Position conflicts:**
- Don't update position from DB during user drag
- Use ReactFlow's `onNodeDragStop` to save final position

**Viewport validation:**
```typescript
const validatedViewport = {
  x: isFinite(viewport.x) ? viewport.x : 0,
  y: isFinite(viewport.y) ? viewport.y : 0,
  zoom: isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1
};
```

### Convex Agent Component Pattern (CRITICAL)

**Purpose:** Each chat node creates its own thread using the Convex Agent Component for managing AI conversations with streaming, tool calls, and message persistence.

#### Agent Setup (convex/agents/agent.ts)

```typescript
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";

// Create agent instance (can have multiple with different models/instructions)
export const defaultAgent = new Agent(components.agent, {
  name: "Canvas Chat Agent",
  languageModel: "openai/gpt-4o-mini", // or grok, claude, etc.
  instructions: "You are a helpful assistant in an infinite canvas workspace.",
});

// Agent for specific use case (e.g., ideation)
export const ideationAgent = new Agent(components.agent, {
  name: "Ideation Agent",
  languageModel: "openai/gpt-4o",
  instructions: "You help users brainstorm and develop creative ideas.",
});
```

#### Thread Management

**Create thread when chat node is created:**
```typescript
// In mutation when user adds chat node to canvas
export const createChatNode = mutation({
  args: { canvasId: v.id("canvases"), position: v.object({ x: v.number(), y: v.number() }) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const orgId = identity.organizationId;

    // Create thread (stored by agent component, NOT in our tables)
    const { threadId } = await defaultAgent.createThread(ctx, {
      userId: identity.subject,
      title: "Canvas Chat",
      summary: "Chat node on canvas"
    });

    // Create chat node record
    const chatNodeId = await ctx.db.insert("chat_nodes", {
      organizationId: orgId,
      threadId, // Reference to agent component thread
      agentId: "default", // Which agent to use
      connectedNodeIds: [],
      createdAt: Date.now()
    });

    // Create canvas node reference
    await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: orgId,
      nodeType: "chat",
      position: args.position,
      data: { chatNodeId }, // Reference to chat_nodes table
      createdAt: Date.now()
    });

    return { chatNodeId, threadId };
  }
});
```

#### Streaming Messages with Context

**Pattern: Save user message → Schedule async streaming → Return immediately**

```typescript
// Step 1: Mutation to save user message and schedule streaming
export const sendChatMessage = mutation({
  args: {
    chatNodeId: v.id("chat_nodes"),
    message: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const orgId = identity.organizationId;

    // Get chat node and verify ownership
    const chatNode = await ctx.db.get(args.chatNodeId);
    if (!chatNode || chatNode.organizationId !== orgId) {
      throw new Error("Chat node not found");
    }

    // Gather context from connected nodes
    const contextMessages = await gatherNodeContext(ctx, chatNode.connectedNodeIds);

    // Save user message (agent component handles this)
    const { messageId } = await defaultAgent.saveMessage(ctx, {
      threadId: chatNode.threadId,
      prompt: args.message,
      metadata: {
        contextNodeIds: chatNode.connectedNodeIds,
        canvasNodeId: args.chatNodeId
      }
    });

    // Schedule async streaming action
    await ctx.scheduler.runAfter(0, internal.canvas.chat.streamResponse, {
      threadId: chatNode.threadId,
      promptMessageId: messageId,
      contextMessages
    });

    return { messageId };
  }
});

// Step 2: Internal action that streams the response
export const streamResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    contextMessages: v.array(v.object({
      role: v.string(),
      content: v.string()
    }))
  },
  handler: async (ctx, args) => {
    // Build system message with context
    const systemMessage = `Context from connected nodes:\n${
      args.contextMessages.map(m => `- ${m.content}`).join('\n')
    }`;

    // Stream with delta persistence (all clients get real-time updates)
    const result = await defaultAgent.streamText(
      ctx,
      { threadId: args.threadId },
      {
        promptMessageId: args.promptMessageId,
        system: systemMessage
      },
      {
        saveStreamDeltas: {
          chunking: "word", // Stream word-by-word
          throttleMs: 100,  // Save deltas every 100ms
        }
      }
    );

    // Ensure stream completes
    await result.consumeStream();
  }
});
```

#### Frontend: Display Messages with Streaming

```typescript
import { useUIMessages, useSmoothText } from "@convex-dev/agent/react";

function ChatNodeComponent({ chatNodeId }: { chatNodeId: Id<"chat_nodes"> }) {
  // Get chat node to find threadId
  const chatNode = useQuery(api.canvas.nodes.getChatNode, { chatNodeId });
  const threadId = chatNode?.threadId;

  // Load messages with streaming support
  const { results: messages, streams } = useUIMessages(
    api.canvas.chat.listMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 50,
      stream: true, // Enable streaming
    }
  );

  const sendMessage = useMutation(api.canvas.chat.sendChatMessage);
  const isStreaming = messages?.some(m => m.status === "streaming") ?? false;

  return (
    <div className="chat-node">
      {messages?.map(message => (
        <StreamingMessage
          key={message.id}
          message={message}
          stream={streams?.find(s => s.messageId === message.id)}
        />
      ))}
      <input
        onSubmit={(text) => sendMessage({ chatNodeId, message: text })}
        disabled={isStreaming}
      />
    </div>
  );
}

function StreamingMessage({ message, stream }: { message: UIMessage, stream?: any }) {
  // Smooth text rendering
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming"
  });

  // Display tool calls from message.parts
  const toolCalls = message.parts?.filter(p => p.type === "tool-call") ?? [];

  return (
    <div className={message.role}>
      {/* Show in-progress tools from stream deltas */}
      {stream?.deltas?.map((delta: any) =>
        delta.type === "start-step" && <ToolProgress tool={delta.toolName} />
      )}

      {/* Show completed tool calls */}
      {toolCalls.map((tool: any) => (
        <ToolResult key={tool.toolCallId} tool={tool} />
      ))}

      {/* Show text response */}
      {visibleText && <p>{visibleText}</p>}

      {/* Streaming indicator */}
      {message.status === "streaming" && <span className="cursor">▊</span>}
    </div>
  );
}
```

#### List Messages Query with Streaming Support

```typescript
import { listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";

export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs, // Required for streaming
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const orgId = identity.organizationId;

    // Verify thread belongs to org (get chat node by threadId)
    const chatNode = await ctx.db
      .query("chat_nodes")
      .filter(q => q.eq(q.field("threadId"), args.threadId))
      .first();

    if (!chatNode || chatNode.organizationId !== orgId) {
      throw new Error("Unauthorized");
    }

    // Fetch paginated messages
    const paginated = await listUIMessages(ctx, components.agent, args);

    // Fetch stream deltas for in-progress messages
    const streams = await syncStreams(ctx, components.agent, args);

    return { ...paginated, streams };
  }
});
```

#### Context Aggregation Function

**Gather context from connected nodes to pass to AI:**

```typescript
async function gatherNodeContext(
  ctx: MutationCtx,
  connectedNodeIds: Id<"canvas_nodes">[]
): Promise<Array<{ role: "user", content: string }>> {
  const contextMessages: Array<{ role: "user", content: string }> = [];

  for (const nodeId of connectedNodeIds) {
    const canvasNode = await ctx.db.get(nodeId);
    if (!canvasNode) continue;

    // Get node-specific content based on type
    switch (canvasNode.nodeType) {
      case "text": {
        const textNode = await ctx.db.get(canvasNode.data.textNodeId);
        if (textNode?.content) {
          contextMessages.push({
            role: "user",
            content: `Text Node Content:\n${textNode.content}`
          });
        }
        break;
      }

      case "youtube": {
        const youtubeNode = await ctx.db.get(canvasNode.data.youtubeNodeId);
        if (youtubeNode?.transcript) {
          contextMessages.push({
            role: "user",
            content: `YouTube Transcript (${youtubeNode.title}):\n${youtubeNode.transcript}`
          });
        }
        break;
      }

      // Add other node types...
    }

    // Include user notes if present
    if (canvasNode.notes) {
      contextMessages.push({
        role: "user",
        content: `User Notes:\n${canvasNode.notes}`
      });
    }
  }

  return contextMessages;
}
```

#### Key Agent Component Features

**Message Metadata:**
- Store custom data with each message (model used, token count, context node IDs)
- Access via `message.metadata` field

**Thread Deletion:**
```typescript
// Async deletion (batched, recommended)
await defaultAgent.deleteThreadAsync(ctx, { threadId });

// Sync deletion (immediate)
await defaultAgent.deleteThreadSync(ctx, { threadId });
```

**Multiple Agents:**
- Create different agents for different purposes (coding, ideation, writing)
- Store agentId in chat_nodes table
- Switch agents dynamically based on user selection

**Tool Support:**
- Agents can call tools (e.g., search, image generation)
- Tool calls appear in `message.parts` array
- Display tool execution in UI via stream deltas

**Cost Tracking:**
- Agent component tracks token usage automatically
- Access via message metadata: `message.metadata.usage`
- Aggregate for billing/credits system

## Key Implementation Notes

- **Start with Text + Chat nodes only** (simplest MVP)
- **Canvas state = nodes + edges** (ReactFlow manages rendering)
- **Context aggregation** = traverse edges, collect connected node data
- **Chat node threads** = reuse existing agent component, new threadId per chat node
- **Node positions** = stored in DB, updated on drag end (not during drag for performance)
- **Cost transparency** = show token count for context before sending message
- **Edge deletion** = auto-delete when source or target node deleted
- **Validation** = ensure no circular dependencies in edges (future enhancement)

## Phase 1: Core Canvas (MVP)
1. Database schema (canvases, canvas_nodes, canvas_edges, text_nodes, chat_nodes)
2. Canvas dashboard (list + create)
3. Canvas editor (ReactFlow setup)
4. Text node (create + edit + display)
5. Chat node (create + thread management)
6. Edge creation (drag to connect)
7. Context aggregation (getNodeContext function)
8. Chat with context (pass connected nodes to AI)

## Phase 2: Additional Node Types
1. YouTube node (Firecrawl transcript)
2. Twitter node (react-tweet embed)
3. Voice note node (audio upload + transcription)
4. PDF node (upload + text extraction)

## Phase 3: Polish
1. Node notes editing
2. Cost/token preview
3. Canvas sharing (org permissions)
4. Export functionality
