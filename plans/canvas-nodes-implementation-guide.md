# Canvas Node Storage Implementation Guide

## 1. Feature Overview

### Purpose and User Value
A visual canvas system that allows users to create, manage, and connect different types of content nodes (videos, AI agents, transcriptions, mood boards) in a real-time collaborative workspace. The canvas provides an intuitive drag-and-drop interface where nodes can be positioned, connected, and manipulated to create content generation workflows.

### Key Functionality
- **Multi-type Node System**: Support for 4 node types (Video, Agent, Transcription, MoodBoard)
- **Real-time Synchronization**: Canvas state syncs with database every 2 seconds
- **Persistent Storage**: Nodes are stored in both:
  - Individual database tables (videos, agents, transcriptions) - source of truth
  - Canvas state table (projectCanvases) - for positions, edges, and viewport
- **Visual Connections**: Edges connect nodes to show data flow relationships
- **Auto-restoration**: Canvas state (including zoom/pan) persists across sessions

### User Flow
1. User creates a project
2. User drags video file or agent onto canvas → creates node at drop position
3. Node is immediately saved to database with canvas position
4. User can drag nodes to reposition them
5. User can connect nodes by dragging edges between connection points
6. Canvas auto-saves positions, edges, and viewport every 2 seconds
7. On reload, canvas reconstructs from database records

---

## 2. Architecture

### Data Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                        User Actions                          │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              React Flow Canvas (Client State)                │
│  - nodes: Node[] (includes position, type, data)            │
│  - edges: Edge[] (connections between nodes)                │
│  - viewport: {x, y, zoom}                                   │
└────────┬────────────────────────────────────────────────────┘
         │
         │ Auto-save (2s debounce)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex Mutations                          │
│  - saveCanvasState() - saves nodes/edges/viewport           │
│  - createVideo/Agent/Transcription() - creates entities     │
│  - updatePosition() - updates entity positions              │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Convex Database Tables                      │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ videos           │  │ agents           │                │
│  │ - canvasPosition │  │ - canvasPosition │                │
│  │ - transcription  │  │ - draft          │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ transcriptions   │  │ projectCanvases  │                │
│  │ - canvasPosition │  │ - nodes[]        │                │
│  │ - fullText       │  │ - edges[]        │                │
│  └──────────────────┘  └──────────────────┘                │
└────────┬────────────────────────────────────────────────────┘
         │
         │ Real-time subscription
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex Queries                            │
│  - getState() - retrieves canvas state                      │
│  - listByProject() - gets videos/agents/transcriptions      │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│         Sync Effect: Rebuild Canvas from Database           │
│  1. Map videos → video nodes                                │
│  2. Map agents → agent nodes                                │
│  3. Map transcriptions → transcription nodes                │
│  4. Reconstruct edges from agent.connections[]             │
│  5. Restore viewport from projectCanvases                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Map
```
Canvas.tsx (Main Container)
    ├── ReactFlowWrapper.tsx (Client-side only loader)
    │   └── @xyflow/react (React Flow library)
    │
    ├── VideoNode.tsx (Renders video with transcription status)
    ├── AgentNode.tsx (Renders AI agent with generation UI)
    ├── TranscriptionNode.tsx (Renders manual transcription)
    ├── MoodBoardNode.tsx (Renders reference links)
    │
    ├── FloatingChat.tsx (Global chat interface)
    ├── ContentModal.tsx (View/edit generated content)
    ├── VideoPlayerModal.tsx (Video playback)
    └── TranscriptionViewModal.tsx (View transcription text)
```

### Integration Points
- **Convex Real-time Database**: All data storage and retrieval
- **React Flow (@xyflow/react)**: Canvas rendering library
- **File Storage**: Convex storage for video files and thumbnails
- **AI Services**: OpenAI for content generation (referenced via agents)

---

## 3. Database Schema

### Core Tables

#### `projectCanvases`
Stores the serialized canvas state including node positions, edges, and viewport.

```typescript
{
  userId: string,              // Owner
  projectId: Id<"projects">,   // Parent project
  nodes: Array<{               // Serialized node positions
    id: string,                // Format: "video_{id}" | "agent_{type}_{id}"
    type: string,              // "video" | "agent" | "transcription" | "moodboard"
    position: { x: number, y: number },
    data: any                  // Minimal serializable data (no functions)
  }>,
  edges: Array<{               // Connections between nodes
    id: string,
    source: string,            // Source node ID
    target: string,            // Target node ID
    sourceHandle?: string,     // Optional handle ID
    targetHandle?: string
  }>,
  viewport: {                  // Camera position
    x: number,
    y: number,
    zoom: number
  },
  updatedAt: number           // Last save timestamp
}
```

**Indexes:**
- `by_user` on `userId`
- `by_project` on `projectId` (unique - one canvas per project)

#### `videos`
Stores video uploads with canvas position and transcription status.

```typescript
{
  userId: string,
  projectId?: Id<"projects">,
  title?: string,
  videoUrl?: string,           // Convex storage URL
  storageId?: Id<"_storage">, // Convex storage reference
  transcription?: string,      // Generated transcription text
  canvasPosition: { x: number, y: number },

  // Metadata
  duration?: number,           // Seconds
  fileSize?: number,           // Bytes
  resolution?: { width: number, height: number },

  // Transcription status tracking
  transcriptionStatus?: "idle" | "processing" | "completed" | "failed",
  transcriptionError?: string,
  transcriptionProgress?: string,

  createdAt: number
}
```

**Indexes:**
- `by_user` on `userId`
- `by_project` on `projectId`

#### `agents`
Stores AI agent nodes with generated content and connections.

```typescript
{
  videoId: Id<"videos">,       // Primary video input
  userId: string,
  projectId?: Id<"projects">,
  type: "title" | "description" | "thumbnail" | "tweets",
  draft: string,               // Generated content
  thumbnailUrl?: string,       // For thumbnail agents
  thumbnailStorageId?: Id<"_storage">,
  connections: string[],       // Array of video/agent/transcription IDs
  chatHistory: Array<{
    role: "user" | "ai",
    message: string,
    timestamp: number
  }>,
  canvasPosition: { x: number, y: number },
  status: "idle" | "generating" | "ready" | "error",
  createdAt: number
}
```

**Indexes:**
- `by_video` on `videoId`
- `by_project` on `projectId`
- `by_type` on `type`

#### `transcriptions`
Stores manually uploaded transcriptions as separate nodes.

```typescript
{
  userId: string,
  projectId: Id<"projects">,
  videoId?: Id<"videos">,     // Optional link to video
  fileName: string,
  format: string,             // "srt" | "vtt" | "txt" | "json"
  fullText: string,           // Complete transcription text
  segments?: Array<{          // Timestamped segments
    start: number,
    end: number,
    text: string
  }>,
  wordCount: number,
  duration?: number,
  fileStorageId?: Id<"_storage">,
  canvasPosition: { x: number, y: number },
  createdAt: number
}
```

**Indexes:**
- `by_user` on `userId`
- `by_project` on `projectId`
- `by_video` on `videoId`

### Key Relationships
```
projects (1) ──→ (1) projectCanvases  [canvas state]
projects (1) ──→ (*) videos          [uploaded videos]
projects (1) ──→ (*) agents          [AI agents]
projects (1) ──→ (*) transcriptions  [manual transcriptions]

videos (1) ──→ (*) agents            [video feeds agents]
videos (1) ──→ (*) transcriptions    [manual transcripts for video]

agents (1) ──→ (*) connections       [agent input sources]
```

### Migration Considerations
- **Dual Storage Pattern**: Node data is stored in BOTH entity tables (videos, agents, transcriptions) AND projectCanvases
- **Entity tables are source of truth** for content (transcription, draft, status)
- **projectCanvases is source of truth** for layout (positions, edges, viewport)
- **Sync direction**: Entity tables → Canvas state (on load)
- **Position updates**: Debounced batch updates to projectCanvases every 2s

---

## 4. Core Logic

### Node ID Format Convention
```typescript
// Node IDs follow a strict format for type identification:
`video_${videoId}`              // Video nodes
`agent_${agentType}_${agentId}` // Agent nodes (e.g., "agent_title_abc123")
`transcription_${transcriptionId}` // Transcription nodes
`moodboard_${moodboardId}`      // Moodboard nodes (future)
```

This format allows quick node type detection and database ID extraction.

### Canvas State Synchronization Pattern

**Loading (Database → Canvas):**
```typescript
// Effect: Load from DB once on mount
useEffect(() => {
  if (!hasLoadedFromDB &&
      projectVideos !== undefined &&
      projectAgents !== undefined &&
      projectTranscriptions !== undefined) {

    // 1. Map database records to React Flow nodes
    const videoNodes = projectVideos.map(video => ({
      id: `video_${video._id}`,
      type: "video",
      position: video.canvasPosition,
      data: {
        videoId: video._id,
        title: video.title,
        hasTranscription: !!video.transcription,
        // ... attach event handlers
        onGenerate: () => handleGenerate(nodeId),
        onView: () => openModal(nodeId)
      }
    }));

    // 2. Reconstruct edges from agent.connections
    const edges = projectAgents.flatMap(agent =>
      agent.connections.map(connectionId => ({
        id: `e${sourceNodeId}-${targetNodeId}`,
        source: findNodeIdByDataId(connectionId),
        target: `agent_${agent.type}_${agent._id}`
      }))
    );

    // 3. Set all nodes and edges
    setNodes([...videoNodes, ...agentNodes, ...transcriptionNodes]);
    setEdges(edges);

    // 4. Restore viewport from projectCanvases
    if (canvasState?.viewport) {
      reactFlowInstance.setViewport(canvasState.viewport);
    }

    setHasLoadedFromDB(true);
  }
}, [projectVideos, projectAgents, projectTranscriptions]);
```

**Saving (Canvas → Database):**
```typescript
// Effect: Auto-save with 2s debounce
useEffect(() => {
  if (!hasLoadedFromDB) return;

  const saveTimeout = setTimeout(() => {
    // Filter out function properties (not serializable)
    const serializableNodes = nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: Object.fromEntries(
        Object.entries(node.data).filter(([key, value]) =>
          typeof value !== 'function'
        )
      )
    }));

    saveCanvasState({
      projectId,
      nodes: serializableNodes,
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target
      })),
      viewport: reactFlowInstance.getViewport()
    });
  }, 2000); // 2 second debounce

  return () => clearTimeout(saveTimeout);
}, [nodes, edges, hasLoadedFromDB]);
```

### Node Creation Flow

**Video Upload:**
```typescript
async function handleVideoUpload(file: File, position: {x, y}) {
  // 1. Create temporary node immediately (optimistic UI)
  const tempNodeId = `video_temp_${Date.now()}`;
  setNodes(nodes => [...nodes, {
    id: tempNodeId,
    type: "video",
    position,
    data: { isUploading: true, title: file.name }
  }]);

  // 2. Create video record in database
  const video = await createVideo({
    projectId,
    title: file.name,
    canvasPosition: position
  });

  // 3. Upload file to storage
  const uploadUrl = await generateUploadUrl();
  const result = await fetch(uploadUrl, {
    method: "POST",
    body: file
  });
  const { storageId } = await result.json();

  // 4. Update video with storage ID
  await updateVideoStorageId({
    id: video._id,
    storageId
  });

  // 5. Replace temp node with real node
  setNodes(nodes =>
    nodes.map(node =>
      node.id === tempNodeId
        ? {
            ...node,
            id: `video_${video._id}`,
            data: {
              videoId: video._id,
              videoUrl: videoUrl,
              isUploading: false
            }
          }
        : node
    )
  );

  // 6. Start transcription in background
  // (handled separately, updates node via real-time sync)
}
```

**Agent Creation (Drag and Drop):**
```typescript
function onDrop(event: DragEvent) {
  const type = event.dataTransfer.getData("application/reactflow");
  const position = reactFlowInstance.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY
  });

  // Find video to connect to
  const videoNode = nodes.find(n => n.type === 'video');

  // Create agent in database
  const agentId = await createAgent({
    videoId: videoNode.data.videoId,
    type: type as "title" | "description" | "thumbnail" | "tweets",
    canvasPosition: position
  });

  // Add node to canvas
  const nodeId = `agent_${type}_${agentId}`;
  setNodes(nodes => [...nodes, {
    id: nodeId,
    type: "agent",
    position,
    data: {
      agentId,
      type,
      draft: "",
      status: "idle",
      onGenerate: () => handleGenerate(nodeId),
      onChat: () => handleChat(nodeId)
    }
  }]);

  // Auto-connect to video
  setEdges(edges => [...edges, {
    id: `e${videoNode.id}-${nodeId}`,
    source: videoNode.id,
    target: nodeId,
    animated: true
  }]);

  // Update agent connections in DB
  await updateAgentConnections({
    id: agentId,
    connections: [videoNode.data.videoId]
  });
}
```

### Connection Management

**Creating Connections:**
```typescript
const onConnect: OnConnect = (params) => {
  const sourceNode = nodes.find(n => n.id === params.source);
  const targetNode = nodes.find(n => n.id === params.target);

  // Validate connection types
  const validConnections = [
    sourceNode.type === 'video' && targetNode.type === 'agent',
    sourceNode.type === 'transcription' && targetNode.type === 'agent',
    sourceNode.type === 'moodboard' && targetNode.type === 'agent',
    sourceNode.type === 'agent' && targetNode.type === 'agent'
  ];

  if (!validConnections.some(v => v)) return;

  // Add edge to canvas
  setEdges(edges => addEdge(params, edges));

  // Update database connections
  if (targetNode.type === 'agent') {
    const connectionId = sourceNode.data.videoId ||
                        sourceNode.data.agentId ||
                        sourceNode.data.transcriptionId;

    await updateAgentConnections({
      id: targetNode.data.agentId,
      connections: [...targetNode.data.connections, connectionId]
    });
  }
};
```

### Validation Rules

**Position Validation:**
- Positions must be finite numbers
- New nodes check for overlaps and offset if needed
- Viewport zoom must be > 0

**Node Data Validation:**
- Remove function properties before serialization
- Ensure required fields exist (id, type, position)
- Validate node type is one of allowed types

**Edge Validation:**
- Source and target nodes must exist
- Connection type must be allowed
- No duplicate edges between same nodes

### Error Handling Approach

**Upload Failures:**
```typescript
try {
  await handleVideoUpload(file);
} catch (error) {
  // Remove optimistic node
  setNodes(nodes => nodes.filter(n => n.id !== tempNodeId));

  // Show user-friendly error
  if (error.message.includes("size")) {
    toast.error("File too large", {
      description: "Maximum size is 1GB"
    });
  } else {
    toast.error("Upload failed", {
      description: error.message,
      action: { label: "Retry", onClick: () => retry() }
    });
  }
}
```

**Transcription Failures:**
- Don't block video upload if transcription fails
- Update node with error state
- Provide retry and manual upload options
- Show helpful error messages for rate limits

**Generation Failures:**
- Preserve existing content
- Show error in node UI
- Allow retry without losing context

### State Management Strategy

**Local State (React):**
- `nodes` - React Flow nodes array
- `edges` - React Flow edges array
- `reactFlowInstance` - React Flow API instance
- `selectedNodeForModal` - Current node being viewed
- `hasLoadedFromDB` - Prevents duplicate loads

**Database State (Convex):**
- Real-time subscribed queries automatically update
- Mutations trigger re-queries
- No manual cache invalidation needed

**Synchronization Pattern:**
- Database is source of truth for content
- Local state is source of truth for temporary UI state
- Auto-save keeps database in sync
- Real-time updates from database merge into local state

---

## 5. API/Backend Patterns

### Endpoint Structure (Convex Functions)

#### Mutations (Write Operations)

```typescript
// convex/canvas.ts
export const saveState = mutation({
  args: {
    projectId: v.id("projects"),
    nodes: v.array(v.object({
      id: v.string(),
      type: v.string(),
      position: v.object({ x: v.number(), y: v.number() }),
      data: v.any()
    })),
    edges: v.array(v.object({
      id: v.string(),
      source: v.string(),
      target: v.string(),
      sourceHandle: v.optional(v.string()),
      targetHandle: v.optional(v.string())
    })),
    viewport: v.object({
      x: v.number(),
      y: v.number(),
      zoom: v.number()
    })
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const project = await ctx.db.get(args.projectId);
    if (project.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // Validate viewport
    const validatedViewport = {
      x: isFinite(args.viewport.x) ? args.viewport.x : 0,
      y: isFinite(args.viewport.y) ? args.viewport.y : 0,
      zoom: isFinite(args.viewport.zoom) && args.viewport.zoom > 0
        ? args.viewport.zoom
        : 1
    };

    // Upsert canvas state
    const existing = await ctx.db
      .query("projectCanvases")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        nodes: args.nodes,
        edges: args.edges,
        viewport: validatedViewport,
        updatedAt: Date.now()
      });
    } else {
      await ctx.db.insert("projectCanvases", {
        userId: identity.subject,
        projectId: args.projectId,
        nodes: args.nodes,
        edges: args.edges,
        viewport: validatedViewport,
        updatedAt: Date.now()
      });
    }
  }
});
```

```typescript
// convex/videos.ts
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    canvasPosition: v.object({ x: v.number(), y: v.number() })
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("videos", {
      userId: identity.subject,
      projectId: args.projectId,
      title: args.title,
      canvasPosition: args.canvasPosition,
      transcriptionStatus: "idle",
      createdAt: Date.now()
    });
  }
});

export const updateMetadata = mutation({
  args: {
    id: v.id("videos"),
    duration: v.optional(v.number()),
    fileSize: v.optional(v.number()),
    resolution: v.optional(v.object({
      width: v.number(),
      height: v.number()
    })),
    // ... other metadata fields
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      duration: args.duration,
      fileSize: args.fileSize,
      resolution: args.resolution
    });
  }
});
```

```typescript
// convex/agents.ts
export const create = mutation({
  args: {
    videoId: v.id("videos"),
    type: v.union(
      v.literal("title"),
      v.literal("description"),
      v.literal("thumbnail"),
      v.literal("tweets")
    ),
    canvasPosition: v.object({ x: v.number(), y: v.number() })
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", {
      videoId: args.videoId,
      userId: identity.subject,
      type: args.type,
      draft: "",
      status: "idle",
      connections: [],
      chatHistory: [],
      canvasPosition: args.canvasPosition,
      createdAt: Date.now()
    });
  }
});

export const updateDraft = mutation({
  args: {
    id: v.id("agents"),
    draft: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("generating"),
      v.literal("ready"),
      v.literal("error")
    ),
    thumbnailUrl: v.optional(v.string()),
    thumbnailStorageId: v.optional(v.id("_storage"))
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      draft: args.draft,
      status: args.status,
      ...(args.thumbnailUrl && { thumbnailUrl: args.thumbnailUrl }),
      ...(args.thumbnailStorageId && {
        thumbnailStorageId: args.thumbnailStorageId
      })
    });
  }
});

export const updateConnections = mutation({
  args: {
    id: v.id("agents"),
    connections: v.array(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      connections: args.connections
    });
  }
});
```

#### Queries (Read Operations)

```typescript
// convex/canvas.ts
export const getState = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Verify ownership
    const project = await ctx.db.get(args.projectId);
    if (project.userId !== identity.subject) {
      return null;
    }

    return await ctx.db
      .query("projectCanvases")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .first();
  }
});
```

```typescript
// convex/videos.ts
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videos")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();
  }
});
```

### Authentication/Authorization Flow

```typescript
// Every mutation/query checks authentication
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Unauthorized");

// Verify resource ownership
const resource = await ctx.db.get(resourceId);
if (resource.userId !== identity.subject) {
  throw new Error("Unauthorized");
}
```

**Integration:** Clerk provides JWT tokens, Convex validates them automatically

### Request/Response Shapes

**Save Canvas State:**
```typescript
// Request
{
  projectId: "k12abc...",
  nodes: [
    {
      id: "video_abc123",
      type: "video",
      position: { x: 100, y: 100 },
      data: { videoId: "abc123", title: "My Video" }
    }
  ],
  edges: [
    {
      id: "evideo_abc123-agent_title_def456",
      source: "video_abc123",
      target: "agent_title_def456"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
}

// Response: void (success) or throws error
```

**Create Agent:**
```typescript
// Request
{
  videoId: "abc123",
  type: "title",
  canvasPosition: { x: 400, y: 100 }
}

// Response
"def456" // Returns the created agent ID
```

---

## 6. Frontend Structure

### Component Hierarchy

```
Canvas.tsx (Main container, 3100+ lines)
├── State Management
│   ├── useNodesState (React Flow hook)
│   ├── useEdgesState (React Flow hook)
│   └── Multiple useState for UI state
│
├── Data Subscriptions (Convex useQuery)
│   ├── projectVideos
│   ├── projectAgents
│   ├── projectTranscriptions
│   ├── canvasState
│   └── userProfile
│
├── Event Handlers
│   ├── handleVideoUpload
│   ├── handleGenerate (AI content generation)
│   ├── handleChatMessage (@mention system)
│   ├── onConnect (edge creation)
│   ├── onDrop (drag & drop)
│   └── performDeletion
│
└── Rendered Components
    ├── ReactFlowWrapper
    │   └── ReactFlow (canvas surface)
    │       ├── VideoNode (custom node type)
    │       ├── AgentNode (custom node type)
    │       ├── TranscriptionNode (custom node type)
    │       └── MoodBoardNode (custom node type)
    │
    ├── Sidebar
    │   ├── Agent palette (draggable)
    │   ├── Video upload zone
    │   ├── Settings panel
    │   └── Share button
    │
    ├── FloatingChat (global chat interface)
    ├── ContentModal (view/edit content)
    ├── VideoPlayerModal (playback)
    ├── TranscriptionViewModal (view text)
    ├── ThumbnailUploadModal (upload images)
    └── DeleteConfirmationDialog (confirm deletion)
```

### Node Components (Individual)

**VideoNode.tsx:**
- Displays video thumbnail/preview
- Shows transcription status badge
- Handles video playback click
- Provides retry/upload transcription actions
- Has source handle (right side) for connections

**AgentNode.tsx:**
- Displays agent type (title/description/thumbnail/tweets)
- Shows generated content preview
- Handles generate/regenerate/chat buttons
- Displays generation progress
- Has target handle (left) and source handle (right)

**TranscriptionNode.tsx:**
- Shows transcription metadata (word count, duration)
- Provides view/copy/download actions
- Highlights when being used in generation
- Has both target and source handles

**MoodBoardNode.tsx:**
- Lists reference links with thumbnails
- Allows adding/removing references
- Fetches metadata for URLs
- Has source handle for connections

### State Management Approach

**React Flow State:**
```typescript
const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);
```
- `onNodesChange` handles dragging, selection, deletion
- `setNodes` used for data updates
- `setEdges` used for connection management

**Convex Reactive State:**
```typescript
const projectVideos = useQuery(api.videos.listByProject, { projectId });
```
- Auto-updates when database changes
- Triggers sync effects to update canvas
- No manual refetch needed

**UI State:**
```typescript
const [selectedNodeForModal, setSelectedNodeForModal] = useState<string | null>(null);
const [chatInput, setChatInput] = useState("");
const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false);
```
- Controls modals, inputs, and loading states

### Form Handling Patterns

**Video Upload (File Input):**
```typescript
<input
  ref={fileInputRef}
  type="file"
  accept="video/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) handleVideoUpload(file, defaultPosition);
  }}
  style={{ display: 'none' }}
/>
```

**Chat Input (@mentions):**
```typescript
<Input
  value={chatInput}
  onChange={(e) => setChatInput(e.target.value)}
  onKeyPress={(e) => {
    if (e.key === 'Enter') {
      handleChatMessage(chatInput);
      setChatInput('');
    }
  }}
  placeholder="@mention an agent..."
/>
```

**Agent Chat Button (Auto-populate @mention):**
```typescript
const handleChatButtonClick = (nodeId: string) => {
  const agentNode = nodes.find(n => n.id === nodeId);
  const mention = `@${agentNode.data.type.toUpperCase()}_AGENT `;
  setChatInput(mention);
  setTimeout(() => setChatInput(''), 100); // Clear after brief delay
};
```

### Client-side Validation

**File Size Validation:**
```typescript
const MAX_SIZE = 1024 * 1024 * 1024; // 1GB
if (file.size > MAX_SIZE) {
  toast.error("File too large", {
    description: `Maximum size is 1GB, got ${(file.size / MAX_SIZE).toFixed(1)}GB`
  });
  return;
}
```

**Video Format Validation:**
```typescript
if (!file.type.startsWith("video/")) {
  toast.error("Invalid file type", {
    description: "Please upload a video file"
  });
  return;
}
```

**Position Validation:**
```typescript
function validatePosition(pos: {x: number, y: number}) {
  if (!isFinite(pos.x) || !isFinite(pos.y)) {
    return { x: 0, y: 0 }; // Default to origin
  }
  return pos;
}
```

**Connection Validation:**
```typescript
// Only allow specific connection types
const validConnections = [
  source.type === 'video' && target.type === 'agent',
  source.type === 'transcription' && target.type === 'agent',
  source.type === 'moodboard' && target.type === 'agent',
  source.type === 'agent' && target.type === 'agent'
];

if (!validConnections.some(v => v)) {
  toast.error("Invalid connection type");
  return;
}
```

---

## 7. Key Code Snippets

### Non-obvious Algorithm: Position Overlap Detection

```typescript
// Prevents nodes from being created on top of each other
function findNonOverlappingPosition(
  desiredPosition: {x: number, y: number},
  nodeType: string
): {x: number, y: number} {
  const OVERLAP_THRESHOLD = 100; // pixels
  const OFFSET_STEP = 50; // pixels to shift by

  let position = { ...desiredPosition };
  let attempts = 0;
  const MAX_ATTEMPTS = 20;

  while (attempts < MAX_ATTEMPTS) {
    // Check if any existing node is too close
    const hasOverlap = nodes.some(node => {
      const dx = Math.abs(node.position.x - position.x);
      const dy = Math.abs(node.position.y - position.y);
      return dx < OVERLAP_THRESHOLD && dy < OVERLAP_THRESHOLD;
    });

    if (!hasOverlap) break;

    // Spiral outward: right, down, left, up pattern
    const spiral = [
      { x: OFFSET_STEP, y: 0 },
      { x: 0, y: OFFSET_STEP },
      { x: -OFFSET_STEP, y: 0 },
      { x: 0, y: -OFFSET_STEP }
    ];

    const offset = spiral[attempts % 4];
    position.x += offset.x;
    position.y += offset.y;

    attempts++;
  }

  return position;
}
```

### Complex Data Transformation: Node Serialization

```typescript
// Converts React Flow nodes with functions to serializable format
function serializeNodes(nodes: Node[]): SerializedNode[] {
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: Object.fromEntries(
      Object.entries(node.data).filter(([key, value]) => {
        // Filter out:
        // 1. Functions (event handlers)
        // 2. Undefined values
        // 3. Specific non-serializable keys
        const excludedKeys = [
          'onGenerate', 'onRegenerate', 'onChat', 'onView',
          'onViewPrompt', 'onRetryTranscription', 'onVideoClick',
          'onUploadTranscription', 'onViewTranscription'
        ];

        return typeof value !== 'function' &&
               value !== undefined &&
               !excludedKeys.includes(key);
      })
    )
  }));
}
```

### Critical Helper: Connection ID Resolver

```typescript
// Maps database IDs to canvas node IDs (handles all node types)
function findNodeIdByDataId(dataId: string): string | null {
  // Check video nodes
  const videoNode = nodes.find(n =>
    n.type === 'video' && n.data.videoId === dataId
  );
  if (videoNode) return videoNode.id;

  // Check agent nodes
  const agentNode = nodes.find(n =>
    n.type === 'agent' && n.data.agentId === dataId
  );
  if (agentNode) return agentNode.id;

  // Check transcription nodes
  const transcriptionNode = nodes.find(n =>
    n.type === 'transcription' && n.data.transcriptionId === dataId
  );
  if (transcriptionNode) return transcriptionNode.id;

  // Check moodboard nodes
  const moodboardNode = nodes.find(n =>
    n.type === 'moodboard' && n.data.moodboardId === dataId
  );
  if (moodboardNode) return moodboardNode.id;

  return null;
}
```

### Reusable Pattern: Real-time Status Sync

```typescript
// Periodically syncs video transcription status from database
useEffect(() => {
  const interval = setInterval(() => {
    if (!projectVideos) return;

    setNodes(nodes =>
      nodes.map(node => {
        if (node.type !== 'video') return node;

        const video = projectVideos.find(v =>
          `video_${v._id}` === node.id
        );
        if (!video) return node;

        // Calculate new status
        const newHasTranscription =
          !!video.transcription ||
          video.transcriptionStatus === "completed";
        const newIsTranscribing =
          video.transcriptionStatus === "processing";
        const newError =
          video.transcriptionStatus === "failed"
            ? video.transcriptionError
            : null;

        // Only update if status changed (prevents infinite loops)
        if (node.data.hasTranscription !== newHasTranscription ||
            node.data.isTranscribing !== newIsTranscribing ||
            node.data.transcriptionError !== newError) {

          // Show toast on status change
          if (!node.data.hasTranscription && newHasTranscription) {
            toast.success("Transcription completed!");
          }

          return {
            ...node,
            data: {
              ...node.data,
              hasTranscription: newHasTranscription,
              isTranscribing: newIsTranscribing,
              transcriptionError: newError,
              transcription: video.transcription
            }
          };
        }

        return node;
      })
    );
  }, 3000); // Check every 3 seconds

  return () => clearInterval(interval);
}, [projectVideos, setNodes]);
```

### Pattern: Edge Reconstruction from Connections

```typescript
// Rebuilds visual edges from database connection IDs
function reconstructEdges(
  agents: Agent[],
  videoNodes: Node[],
  transcriptionNodes: Node[],
  agentNodes: Node[]
): Edge[] {
  const edges: Edge[] = [];

  agents.forEach(agent => {
    const targetId = `agent_${agent.type}_${agent._id}`;

    agent.connections.forEach(connectionId => {
      // Find source node by its database ID
      const sourceNode =
        videoNodes.find(n => n.data.videoId === connectionId) ||
        transcriptionNodes.find(n => n.data.transcriptionId === connectionId) ||
        agentNodes.find(n => n.data.agentId === connectionId);

      if (sourceNode) {
        edges.push({
          id: `e${sourceNode.id}-${targetId}`,
          source: sourceNode.id,
          target: targetId,
          animated: true,
          // Custom styling based on source type
          style: sourceNode.type === 'transcription'
            ? { stroke: '#a855f7', strokeWidth: 2 }
            : undefined
        });
      }
    });
  });

  return edges;
}
```

---

## 8. Configuration

### Environment Variables

```bash
# Frontend (.env.local)
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Convex Dashboard (Environment Variables section)
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
CLERK_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:5173
```

### Feature Flags

None currently implemented, but potential flags:

```typescript
// Could be added to user settings or environment
const FEATURE_FLAGS = {
  ENABLE_MOODBOARD_NODES: true,
  ENABLE_CANVAS_SHARING: true,
  ENABLE_EDGE_ANIMATIONS: true,
  AUTO_SAVE_INTERVAL_MS: 2000,
  MAX_VIDEO_SIZE_MB: 1024,
  MAX_NODES_PER_PROJECT: 100
};
```

### Third-party Service Setup

**React Flow:**
```bash
npm install @xyflow/react
```

**Convex:**
```bash
npm install convex
npx convex dev  # Start development
npx convex deploy  # Deploy to production
```

**Clerk:**
```bash
npm install @clerk/clerk-react
```

### Required Dependencies

```json
{
  "dependencies": {
    "@xyflow/react": "^12.x",
    "convex": "^1.x",
    "@clerk/clerk-react": "^5.x",
    "react": "^19.x",
    "react-router": "^7.x",
    "sonner": "^1.x",  // Toast notifications
    "lucide-react": "^0.x"  // Icons
  }
}
```

---

## 9. Implementation Checklist

### Setup Tasks
- [ ] Install React Flow library (`@xyflow/react`)
- [ ] Set up Convex backend (convex.dev)
- [ ] Configure authentication provider (Clerk)
- [ ] Create database tables (videos, agents, transcriptions, projectCanvases)
- [ ] Set up file storage system
- [ ] Configure environment variables

### Backend Implementation Steps
- [ ] Define database schema with indexes
- [ ] Implement `canvas.saveState` mutation (upsert pattern)
- [ ] Implement `canvas.getState` query
- [ ] Implement entity CRUD mutations (videos, agents, transcriptions)
  - [ ] `videos.create` with canvasPosition
  - [ ] `agents.create` with canvasPosition
  - [ ] `transcriptions.create` with canvasPosition
  - [ ] Update mutations for content and status
- [ ] Implement `updateConnections` mutation for agents
- [ ] Add authentication/authorization checks to all functions
- [ ] Set up real-time subscriptions for queries

### Frontend Implementation Steps
- [ ] Create `ReactFlowWrapper` component (client-only loader)
- [ ] Build main `Canvas` component with React Flow
- [ ] Implement node type components:
  - [ ] VideoNode with transcription status UI
  - [ ] AgentNode with generation UI
  - [ ] TranscriptionNode with view/download
  - [ ] MoodBoardNode (optional)
- [ ] Implement drag-and-drop system
  - [ ] Sidebar with draggable agent types
  - [ ] `onDrop` handler with position calculation
  - [ ] Video file drop handling
- [ ] Implement connection system
  - [ ] `onConnect` handler with validation
  - [ ] Edge rendering with custom styles
  - [ ] Connection type validation
- [ ] Implement database synchronization
  - [ ] Load effect: DB → Canvas (once on mount)
  - [ ] Save effect: Canvas → DB (debounced auto-save)
  - [ ] Status sync: Poll for transcription updates
- [ ] Implement viewport persistence
  - [ ] Save viewport on pan/zoom
  - [ ] Restore viewport on load
  - [ ] Handle fitView on first load
- [ ] Add modal components
  - [ ] Content view/edit modal
  - [ ] Video player modal
  - [ ] Transcription viewer
  - [ ] Thumbnail upload modal
- [ ] Implement deletion flow
  - [ ] Confirmation dialog
  - [ ] Cascade delete (video deletes connected agents)
  - [ ] Update database and canvas
- [ ] Add error handling and loading states
- [ ] Implement toast notifications
- [ ] Add keyboard shortcuts (optional)

### Testing Requirements

**Unit Tests:**
- [ ] Test `serializeNodes` function (removes functions)
- [ ] Test `findNonOverlappingPosition` algorithm
- [ ] Test `findNodeIdByDataId` resolver
- [ ] Test connection validation logic

**Integration Tests:**
- [ ] Test video upload flow (file → DB → node)
- [ ] Test agent creation via drag-and-drop
- [ ] Test edge creation and connection updates
- [ ] Test canvas save/load cycle
- [ ] Test node deletion cascade
- [ ] Test transcription status updates

**E2E Tests:**
- [ ] Upload video → verify node appears
- [ ] Drag agent onto canvas → verify DB record created
- [ ] Connect video to agent → verify edge saved
- [ ] Move nodes → verify positions persist after reload
- [ ] Delete video → verify agents also deleted
- [ ] Generate content → verify draft updates

**Manual Testing:**
- [ ] Test with multiple concurrent users (real-time sync)
- [ ] Test with large video files (progress indicators)
- [ ] Test error recovery (failed uploads, network errors)
- [ ] Test viewport restoration with various zoom levels
- [ ] Test with many nodes (performance)

### Deployment Considerations

**Database Migrations:**
- Canvas state is additive (no destructive changes)
- If schema changes, handle old data gracefully:
  ```typescript
  // Example: Add default values for new fields
  const node = {
    ...dbNode,
    newField: dbNode.newField ?? defaultValue
  };
  ```

**Performance Optimizations:**
- Use React Flow's built-in virtualization (renders only visible nodes)
- Debounce auto-save to reduce DB writes
- Use indexes on all query fields
- Consider pagination for projects with 100+ nodes

**Caching Strategy:**
- Convex handles query caching automatically
- React Flow caches node renders (use `memo`)
- Don't cache viewport (always get fresh from DB)

**Rollback Plan:**
- Backup `projectCanvases` table before schema changes
- Keep old queries/mutations available for 1 version
- Version canvas state with `schemaVersion` field

**Monitoring:**
- Track auto-save failures (alert if > 5%)
- Monitor query performance (alert if > 500ms)
- Track node count per project (limit at 100)
- Monitor file upload success rate

**Scaling Considerations:**
- Convex scales automatically
- For 1000+ nodes per canvas, consider:
  - Lazy loading nodes (load only visible area)
  - Simplify node rendering (reduce DOM complexity)
  - Paginate edge rendering
- For high upload volume:
  - Use upload queues
  - Rate limit per user

---

## 10. Key Takeaways

### Architecture Patterns
1. **Dual Storage Pattern**: Nodes stored in both entity tables (content) and projectCanvases (layout)
2. **One-way Sync**: Database → Canvas on load, Canvas → Database on save
3. **Node ID Convention**: `{type}_{databaseId}` for easy identification
4. **Optimistic UI**: Show nodes immediately, sync to DB in background

### Critical Implementation Details
1. **Serialization**: Must filter out functions before saving to DB
2. **Connection Mapping**: Agent.connections stores database IDs, not node IDs
3. **Viewport Validation**: Always validate zoom > 0 and coordinates are finite
4. **Load Guard**: Use `hasLoadedFromDB` flag to prevent duplicate initialization

### Common Pitfalls to Avoid
1. **Don't** save canvas state before loading from DB
2. **Don't** include function properties in node.data when serializing
3. **Don't** forget to update both canvas and database when creating connections
4. **Don't** use node IDs in database (use underlying entity IDs)
5. **Don't** block on transcription (run async, show status updates)

### Performance Best Practices
1. Debounce auto-save (2 seconds default)
2. Use React.memo for node components
3. Filter node updates (only re-render if data changed)
4. Use indexed queries for all database lookups
5. Batch edge updates when possible

This guide provides a complete reference for implementing a visual canvas with persistent node storage. The pattern is transferable to any application needing a visual workflow editor with real-time collaboration and persistent state.
