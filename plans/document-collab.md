# Collaborative Canvas with ProseMirror Sync - Implementation Guide

## 1. Feature Overview

### Purpose and User Value
The collaborative canvas feature enables real-time document editing shared between users and AI agents. It provides a split-screen interface where users can chat with AI assistants while simultaneously collaborating on documents. The AI can read from and write to documents through tool calls, creating a seamless co-authoring experience.

### Key Functionality
- **Real-time collaborative editing** using ProseMirror operational transformation
- **AI-driven document creation and editing** via tool calls
- **Split-pane interface** with resizable chat and document panels
- **Document lifecycle management** (create, update, delete, title editing)
- **Version tracking** to force UI re-renders when AI modifies documents
- **Rich text editing** with markdown support (headings, lists, code blocks, etc.)

### User Flow

1. **User initiates a chat thread** with an AI assistant
2. **AI suggests or user requests document creation** during conversation
3. **Document is created** and attached to the thread (one document per thread max)
4. **UI switches to split-pane layout**: document editor on left, chat on right
5. **User and AI collaborate**:
   - User types directly in the editor
   - AI uses `setDocumentText` tool to write/update content
   - Changes sync in real-time via ProseMirror Sync
6. **User can**:
   - Edit document title inline
   - Delete document to return to chat-only view
   - Resize panels or hide chat sidebar
   - Continue chatting while editing

---

## 2. Architecture

### Data Flow Diagram (Text-Based)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐           ┌───────────────────────┐          │
│  │  ThreadView      │           │   CanvasLayout        │          │
│  │  (Container)     │───────────▶   (Layout Manager)    │          │
│  │                  │           │                       │          │
│  │  - Queries doc   │           │  ┌─────────────────┐  │          │
│  │  - Manages state │           │  │  CanvasEditor   │  │          │
│  │  - Routes layout │           │  │  (TipTap)       │  │          │
│  └──────────────────┘           │  │                 │  │          │
│           │                     │  │  - useTiptapSync│  │          │
│           │ useQuery            │  │  - Rich editor  │  │          │
│           ▼                     │  └─────────────────┘  │          │
│  ┌──────────────────┐           │          │            │          │
│  │ getDocumentFor   │           │          │ syncs via  │          │
│  │ Thread (Query)   │           │          ▼            │          │
│  └──────────────────┘           │  ┌─────────────────┐  │          │
│                                 │  │ Chat Sidebar    │  │          │
│                                 │  │ (Resizable)     │  │          │
│                                 │  └─────────────────┘  │          │
│                                 └───────────────────────┘          │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    WebSocket │ (Convex Real-time)
                             │
┌────────────────────────────┴────────────────────────────────────────┐
│                       BACKEND (Convex)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              ProseMirror Sync Component                      │  │
│  │              (Convex Component)                              │  │
│  │                                                              │  │
│  │  - Manages operational transformation (OT)                   │  │
│  │  - Stores document snapshots and steps                       │  │
│  │  - Syncs changes across all connected clients                │  │
│  │  - Version tracking for concurrent edits                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           │                                     ▲                   │
│           │ create/delete                       │ sync updates      │
│           ▼                                     │                   │
│  ┌──────────────────┐                  ┌────────────────────┐       │
│  │  documents.ts    │                  │  canvas.ts         │       │
│  │  (Mutations)     │                  │  (Sync API)        │       │
│  │                  │                  │                    │       │
│  │  - create        │                  │  - getSnapshot     │       │
│  │  - delete        │                  │  - submitSnapshot  │       │
│  │  - updateTitle   │                  │  - getSteps        │       │
│  │  - refresh       │                  │  - submitSteps     │       │
│  └──────────────────┘                  └────────────────────┘       │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              threadDocuments Table                           │  │
│  │                                                              │  │
│  │  - Stores metadata: threadId, documentId, title, version    │  │
│  │  - Links threads to ProseMirror documents                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              AI Agent with Tools                             │  │
│  │                                                              │  │
│  │  - setDocumentText tool                                      │  │
│  │  - Deletes & recreates document to avoid OT conflicts        │  │
│  │  - Increments documentVersion to force UI refresh            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Map

```
ThreadView (Container)
    │
    ├─── useQuery(getCurrentUser) → Authentication
    │
    ├─── useQuery(getDocumentForThread) → Document Metadata
    │       │
    │       └─── Conditional Rendering:
    │               │
    │               ├─── If NO document → Standard Chat UI
    │               │
    │               └─── If HAS document → CanvasLayout
    │
    └─── CanvasLayout (Split Pane)
            │
            ├─── Left Panel: CanvasEditor
            │       │
            │       ├─── useTiptapSync(api.agents.canvas, documentId)
            │       │       │
            │       │       └─── Connects to ProseMirror Sync backend
            │       │
            │       └─── useEditor (TipTap)
            │               │
            │               └─── Renders rich text editor
            │
            └─── Right Panel: Chat Sidebar
                    │
                    └─── MessageList + PromptInput
                            │
                            └─── AI messages can trigger setDocumentText
```

### Integration Points

#### External Services/APIs
- **@convex-dev/prosemirror-sync**: Convex component for real-time collaborative editing
- **@tiptap/react**: React wrapper for ProseMirror editor
- **@tiptap/starter-kit**: Pre-configured ProseMirror extensions (markdown support)
- **Convex Real-time Subscriptions**: WebSocket-based live queries
- **AI SDK (OpenAI/OpenRouter)**: AI model integration for tool calling

#### Critical Dependencies
- ProseMirror Sync component must be installed in `convex.config.ts`
- AI Agent component must have access to ProseMirror Sync instance
- Frontend must use `useTiptapSync` hook from `@convex-dev/prosemirror-sync/tiptap`

---

## 3. Database Schema

### Tables

#### `threadDocuments` (Custom Table)
Links chat threads to ProseMirror documents with metadata.

```typescript
threadDocuments: defineTable({
  threadId: v.string(),           // Foreign key to agent's thread
  documentId: v.string(),         // ProseMirror document ID (e.g., "doc_thread123")
  title: v.optional(v.string()),  // User-editable title
  createdBy: v.id("users"),       // User who created document
  createdAt: v.number(),          // Timestamp (used to trigger refreshes)
  documentVersion: v.optional(v.number()), // Incremented on AI edits
})
```

**Indexes:**
- `by_thread` on `["threadId"]` - Find document for a thread (unique relationship)
- `by_document` on `["documentId"]` - Lookup by document ID
- `by_user` on `["createdBy"]` - List documents created by user

**Note:** `_creationTime` is automatically added to all tables and should NOT be included in indexes.

#### ProseMirror Sync Tables (Managed by Component)
The `@convex-dev/prosemirror-sync` component creates its own tables internally:

- **Document snapshots table**: Stores full ProseMirror JSON documents
- **Steps table**: Stores operational transformation steps
- **Version tracking**: Manages concurrent edit resolution

You do NOT manually define these tables - they're created automatically when the component is installed.

### Key Relationships

```
users (1) ────────── (many) threadDocuments
                          │
                          │ (1-to-1)
                          │
                          ├─── threads (agent component)
                          │
                          └─── ProseMirror documents (component)
```

**One-to-One Constraint:** Each thread can have at most ONE document. This is enforced in the `createDocumentForThread` mutation:

```typescript
const existing = await ctx.db
  .query("threadDocuments")
  .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
  .first();

if (existing) {
  throw new Error("Thread already has a document");
}
```

### Migration Considerations

1. **ProseMirror Sync Installation**: Install component via `convex.config.ts` BEFORE first deployment
2. **Existing Threads**: Documents are created on-demand, not retroactively
3. **Version Field**: `documentVersion` starts at 1 and increments each time AI recreates the document
4. **Document IDs**: Use predictable format `doc_${threadId}` for easier debugging

---

## 4. Core Logic

### Business Logic Patterns

#### Document Lifecycle

**Creation:**
1. Check if thread already has a document
2. Generate predictable document ID: `doc_${threadId}`
3. Create initial ProseMirror document structure with title as H1
4. Store in ProseMirror Sync component
5. Insert metadata in `threadDocuments` table with `documentVersion: 1`

**AI Editing (Critical Pattern):**
When AI uses `setDocumentText` tool to update a document:

1. **Delete existing document** from ProseMirror Sync
   - Avoids operational transformation conflicts
   - Simpler than computing transform steps server-side
2. **Recreate document** with new content
3. **Increment `documentVersion`** in metadata table
4. **Update `createdAt` timestamp** to trigger Convex subscription update
5. **Frontend detects version change** and remounts editor component

```typescript
// Key pattern from setDocumentText tool
if (existingDoc) {
  await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, {
    id: documentId
  });
}

await prosemirrorSync.create(ctx, documentId, documentContent);

await ctx.runMutation(internal.documents.refreshDocumentTimestamp, {
  threadDocumentId: existingDoc._id
});
```

**Why Delete-and-Recreate?**
- Server-side transform calculation is complex
- AI generates full replacement content, not incremental edits
- User may be actively editing - OT would create merge conflicts
- Refresh trigger ensures UI shows latest version immediately

**Deletion:**
1. Delete from ProseMirror Sync component
2. Delete metadata from `threadDocuments` table
3. Frontend detects null and switches back to chat-only UI

#### Version Tracking Strategy

The `documentVersion` field serves two purposes:

1. **Force Component Remount**: Used as React key
   ```tsx
   <CanvasEditor
     key={`${documentId}-${documentVersion || 1}`}
     // ...
   />
   ```

2. **Debugging**: Track how many times AI has regenerated content

### Validation Rules

**Document Creation:**
- User must be authenticated
- Thread must not already have a document (1-to-1 constraint)
- Document ID must be unique (enforced by ProseMirror Sync)

**Title Updates:**
- Only document creator can update title
- Title cannot be empty string

**Deletion:**
- Only document creator can delete
- Must confirm deletion (UI-level validation)

**AI Tool Access:**
- AI must have valid `threadId` in context
- AI must have valid `userId` in context
- Document must exist or be creatable for the thread

### Error Handling Approach

**Backend (Convex):**
```typescript
try {
  // Operation
  console.log('[Module] Starting operation:', details);
} catch (error) {
  console.error('[Module] Operation failed:', error);
  throw new Error("User-friendly error message");
}
```

**Frontend (React):**
```typescript
try {
  await mutation({ args });
  console.log('[Component] Success:', result);
} catch (error) {
  console.error('[Component] Error:', error);
  setSendError(error instanceof Error ? error.message : 'Operation failed');
}
```

**Loading States:**
- `undefined`: Data is loading
- `null`: Data not found or access denied
- `object`: Data successfully loaded

Never use Suspense with Convex queries - handle loading states manually.

### State Management Strategy

**Server State (Convex):**
- ProseMirror document content (in Sync component)
- Document metadata (in `threadDocuments` table)
- Real-time subscriptions via `useQuery`

**Client State (React):**
- Editor instance (TipTap `useEditor` hook)
- UI state (panel visibility, title editing mode)
- Optimistic updates (message sending)

**Sync State:**
- `useTiptapSync` manages bidirectional sync between editor and backend
- Returns `{ extension, initialContent, isLoading }`
- Extension is added to TipTap editor configuration

---

## 5. API/Backend Patterns

### Endpoint Structure (Convex RPC)

All backend functions follow Convex's RPC pattern with validators:

```typescript
export const functionName = mutation({  // or query/action
  args: {
    threadId: v.string(),
    // ... other args
  },
  returns: v.object({ /* return shape */ }),
  handler: async (ctx, args) => {
    // Implementation
  },
});
```

### Key Functions

#### Queries (Real-time Subscriptions)

**`documents.getDocumentForThread`**
```typescript
args: { threadId: v.string() }
returns: v.union(v.object({ ... }), v.null())
```
Returns document metadata for a thread, or `null` if none exists.

**`agents.canvas.getSnapshot`** (from ProseMirror Sync)
```typescript
args: { id: v.string() }
returns: ProseMirror document snapshot
```
Returns full document content for syncing.

**`agents.canvas.getSteps`** (from ProseMirror Sync)
```typescript
args: { id: v.string(), version: v.number() }
returns: Array of OT steps since version
```
Returns operational transformation steps for syncing changes.

#### Mutations

**`documents.createDocumentForThread`**
```typescript
args: {
  threadId: v.string(),
  title: v.optional(v.string())
}
returns: v.object({
  id: v.id("threadDocuments"),
  documentId: v.string(),
  threadId: v.string(),
  title: v.string()
})
```

Creates document and metadata. Initial content:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Title" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Start writing..." }]
    }
  ]
}
```

**`documents.deleteDocument`**
```typescript
args: { threadId: v.string() }
returns: v.object({ success: v.boolean() })
```

Deletes both ProseMirror document and metadata.

**`documents.updateDocumentTitle`**
```typescript
args: { threadId: v.string(), title: v.string() }
returns: v.object({ success: v.boolean() })
```

Updates only the metadata title, not document content.

**`documents.refreshDocumentTimestamp` (Internal)**
```typescript
args: { threadDocumentId: v.id("threadDocuments") }
returns: v.null()
```

Increments `documentVersion` and updates `createdAt` to trigger UI refresh.

### Request/Response Shapes

**ProseMirror Document Structure:**
```typescript
{
  type: "doc",
  content: [
    {
      type: "paragraph" | "heading" | "codeBlock" | "blockquote" | ...,
      attrs?: { level: number, ... },
      content: [
        { type: "text", text: string, marks?: [...] }
      ]
    }
  ]
}
```

### Authentication/Authorization Flow

**Authentication:**
```typescript
const user = await ctx.runQuery(api.users.getCurrentUser, {});
if (!user) {
  throw new Error("User not authenticated");
}
```

**Authorization (Document Operations):**
```typescript
if (threadDoc.createdBy !== user._id) {
  throw new Error("Only the document creator can delete it");
}
```

**AI Tool Context:**
AI tools receive `ctx` with:
- `ctx.userId` - Authenticated user ID
- `ctx.threadId` - Current conversation thread
- `ctx.messageId` - Current message ID

### Key Middleware/Hooks

**ProseMirrorSync Instance:**
```typescript
// convex/agents/canvas.ts
import { components } from "../_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({});
```

This exports the sync API that the frontend `useTiptapSync` hook connects to.

---

## 6. Frontend Structure

### Component Hierarchy

```
ThreadView.tsx (Route Component)
  │
  ├─── Authentication & Data Loading
  │     ├─── useQuery(api.users.getCurrentUser)
  │     ├─── useQuery(api.documents.getDocumentForThread)
  │     └─── useThreadMessages(api.agents.queries.listMessages...)
  │
  ├─── Conditional Render Decision
  │     │
  │     ├─── if (isLoading) → ThreadViewSkeleton
  │     │
  │     ├─── if (threadDocument exists) → CanvasLayout
  │     │     │
  │     │     └─── CanvasLayout.tsx (Layout Manager)
  │     │           │
  │     │           ├─── Left Panel (ResizablePanel)
  │     │           │     │
  │     │           │     └─── CanvasEditor.tsx
  │     │           │           ├─── useTiptapSync(api.agents.canvas, documentId)
  │     │           │           ├─── useEditor (TipTap with StarterKit + sync extension)
  │     │           │           ├─── Title Editor (inline edit)
  │     │           │           └─── EditorContent (ProseMirror renderer)
  │     │           │
  │     │           ├─── ResizableHandle (drag to resize)
  │     │           │
  │     │           └─── Right Panel (ResizablePanel)
  │     │                 │
  │     │                 ├─── Chat Header (with hide button)
  │     │                 └─── children (passed from ThreadView)
  │     │                       │
  │     │                       └─── Chat Messages + PromptInput
  │     │
  │     └─── if (no document) → Standard Chat Layout
  │           │
  │           ├─── Chat Header
  │           ├─── Messages Area (ScrollArea)
  │           │     ├─── MessageRow (user messages)
  │           │     └─── GroupedAssistantMessage (AI messages)
  │           │
  │           └─── PromptInput Footer
  │
  └─── Mutations & Event Handlers
        ├─── useMutation(api.documents.createDocument)
        ├─── useMutation(api.documents.deleteDocument)
        ├─── useMutation(api.agents.mutations.sendMessage)
        └─── handleSendMessage, handleCreateDocument, etc.
```

### State Management Approach

**Server State (via Convex hooks):**
```typescript
// Always-on subscriptions
const currentUser = useQuery(api.users.getCurrentUser);
const threadDocument = useQuery(api.documents.getDocumentForThread,
  threadId ? { threadId } : "skip"
);

// Conditional subscriptions (skip when deps not ready)
const messages = useThreadMessages(
  api.agents.queries.listMessages,
  currentUser && threadId ? { userId: currentUser._id, threadId } : "skip",
  { stream: true }
);
```

**Local UI State:**
```typescript
const [isChatVisible, setIsChatVisible] = useState(true);
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [tempTitle, setTempTitle] = useState(title);
```

**Editor State:**
```typescript
const sync = useTiptapSync(api.agents.canvas, documentId);
const editor = useEditor({
  extensions: [StarterKit, ...(sync.extension ? [sync.extension] : [])],
  content: sync.initialContent || '',
}, [sync.initialContent, sync.extension]);
```

### Form Handling Patterns

**Title Editing (Inline):**
```tsx
{isEditingTitle ? (
  <Input
    value={tempTitle}
    onChange={(e) => setTempTitle(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') handleTitleSave();
      if (e.key === 'Escape') cancelEdit();
    }}
  />
) : (
  <h1 onClick={() => setIsEditingTitle(true)}>{title}</h1>
)}
```

**Message Sending:**
Uses `PromptInput` component with optimistic updates:
```typescript
const sendMessage = useMutation(api.agents.mutations.sendMessage)
  .withOptimisticUpdate((store, args) => {
    optimisticallySendMessage(api.agents.queries.listMessages)(
      store,
      { threadId: args.threadId, prompt: args.message }
    );
  });
```

### Client-Side Validation

**Message Input:**
- Prevent sending empty messages
- Check message limit before sending
- Disable input when limit reached

**Document Creation:**
- Require authenticated user
- Prevent duplicate documents for same thread

**Title Editing:**
- Trim whitespace
- Revert to original on empty input
- Auto-save on Enter, cancel on Escape

---

## 7. Key Code Snippets

### 1. ProseMirror Sync Integration (Frontend)

```typescript
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const sync = useTiptapSync(api.agents.canvas, documentId);

const extensions = [
  StarterKit.configure({
    paragraph: {},
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    bold: {}, italic: {}, code: {}, codeBlock: {},
    bulletList: {}, orderedList: {}, listItem: {},
  }),
  ...(sync.extension ? [sync.extension] : [])
];

const editor = useEditor({
  extensions,
  content: sync.initialContent || '',
}, [sync.initialContent, sync.extension]);

// Render
return sync.isLoading ? <Skeleton /> : <EditorContent editor={editor} />;
```

**Critical:** Add sync extension AFTER StarterKit, and depend on `sync.extension` in useEditor deps.

### 2. AI Tool for Document Editing (Backend)

```typescript
export const setDocumentText = createTool({
  description: "Create or update the document for the current thread",
  args: z.object({
    content: z.string().describe("The text content"),
    title: z.optional(z.string()).describe("Document title"),
  }),
  handler: async (ctx, args): Promise<string> => {
    if (!ctx.threadId || !ctx.userId) {
      return "❌ No thread/user context available";
    }

    const existingDoc = await ctx.runQuery(api.documents.getDocumentForThread, {
      threadId: ctx.threadId
    });

    let documentId: string;

    if (!existingDoc) {
      const result = await ctx.runMutation(api.documents.createDocumentForThread, {
        threadId: ctx.threadId,
        title: args.title || "AI Document"
      });
      documentId = result.documentId;
    } else {
      documentId = existingDoc.documentId;
    }

    // Convert text content to ProseMirror JSON
    const paragraphs = args.content.split('\n').filter(p => p.trim());
    const documentContent = {
      type: "doc",
      content: paragraphs.map(paragraph => ({
        type: "paragraph",
        content: [{ type: "text", text: paragraph }]
      }))
    };

    // DELETE-AND-RECREATE PATTERN (Critical for AI edits)
    if (existingDoc) {
      await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, {
        id: documentId
      });
    }

    // Recreate with new content
    await prosemirrorSync.create(ctx, documentId, documentContent);

    // Trigger UI refresh by updating version
    if (existingDoc) {
      await ctx.runMutation(internal.documents.refreshDocumentTimestamp, {
        threadDocumentId: existingDoc._id
      });
    }

    return `✅ Document updated (${args.content.length} characters)`;
  },
});
```

**Why this pattern?**
- Server-side OT transform calculation is complex
- AI generates full replacement content
- Deleting and recreating avoids merge conflicts
- Version increment forces React component remount with fresh content

### 3. Document Version-Based Component Remounting

```typescript
// In ThreadView.tsx - conditionally render CanvasLayout
if (threadDocument) {
  return (
    <CanvasLayout
      documentId={threadDocument.documentId}
      threadId={threadId}
      documentTitle={threadDocument.title || "Untitled"}
      documentVersion={threadDocument.documentVersion}  // Pass version
      onDocumentDelete={handleDocumentDelete}
      onDocumentTitleChange={handleDocumentTitleChange}
    >
      {/* Chat content as children */}
    </CanvasLayout>
  );
}

// In CanvasLayout.tsx - pass version to CanvasEditor
<CanvasEditor
  key={`${documentId}-${documentVersion || 1}`}  // Force remount on version change
  documentId={documentId}
  threadId={threadId}
  title={documentTitle}
  documentVersion={documentVersion}
  onTitleChange={onDocumentTitleChange}
  onDelete={onDelete}
/>
```

**Why remount instead of updating content?**
- Avoids complex state synchronization
- Ensures editor fully resets with new content
- Prevents stale ProseMirror state
- Simpler than manual content replacement

### 4. Conditional Document Query with Layout Switch

```typescript
// In ThreadView.tsx
const threadDocument = useQuery(
  api.documents.getDocumentForThread,
  threadId ? { threadId } : "skip"
);

// Conditional rendering based on document presence
if (threadDocument) {
  // Render split-pane canvas layout
  return <CanvasLayout>{/* chat */}</CanvasLayout>;
} else {
  // Render standard chat-only layout
  return (
    <div className="chat-layout">
      <ChatHeader />
      <MessageList />
      <PromptInput />
    </div>
  );
}
```

**Loading states:**
- `undefined`: Loading (show skeleton)
- `null`: No document exists (show chat-only)
- `object`: Document exists (show canvas layout)

### 5. Resizable Panel Layout

```typescript
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '@/shared/components/ui/resizable';

<ResizablePanelGroup direction="horizontal">
  {/* Document Panel */}
  <ResizablePanel defaultSize={60} minSize={25}>
    <CanvasEditor {...props} />
  </ResizablePanel>

  {isChatVisible && (
    <>
      <ResizableHandle withHandle />

      {/* Chat Panel */}
      <ResizablePanel defaultSize={40} minSize={20} maxSize={50}>
        {children}
      </ResizablePanel>
    </>
  )}
</ResizablePanelGroup>
```

Uses `react-resizable-panels` for smooth draggable resize with size constraints.

### 6. ProseMirror Text-to-JSON Conversion Helper

```typescript
// Convert plain text to ProseMirror JSON structure
function textToProseMirrorDoc(text: string) {
  const paragraphs = text.split('\n').filter(p => p.trim().length > 0);

  return {
    type: "doc",
    content: paragraphs.length > 0
      ? paragraphs.map(paragraph => ({
          type: "paragraph",
          content: [{ type: "text", text: paragraph }]
        }))
      : [{
          type: "paragraph",
          content: [{ type: "text", text: text }]
        }]
  };
}
```

For markdown support, you'd add a markdown parser (e.g., `remark` + `prosemirror-markdown`).

---

## 8. Configuration

### Environment Variables

**Convex:**
```bash
# Automatically provided by Convex CLI
CONVEX_DEPLOYMENT=dev:your-deployment-name
CONVEX_URL=https://your-deployment.convex.cloud

# For AI functionality
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-v1-...
```

**Frontend:**
```bash
# Vite/Vinxi automatically injects CONVEX_URL from convex.json
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```


### Third-Party Service Setup

**@convex-dev/prosemirror-sync Installation:**

1. Install package:
   ```bash
   pnpm add @convex-dev/prosemirror-sync
   ```

2. Register component in `convex/convex.config.ts`:
   ```typescript
   import { defineApp } from "convex/server";
   import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";

   const app = defineApp();
   app.use(prosemirrorSync);
   export default app;
   ```

3. Create sync API in `convex/agents/canvas.ts`:
   ```typescript
   import { components } from "../_generated/api";
   import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";

   const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

   export const {
     getSnapshot,
     submitSnapshot,
     latestVersion,
     getSteps,
     submitSteps,
   } = prosemirrorSync.syncApi({});
   ```

**TipTap Setup (Frontend):**

```bash
pnpm add @tiptap/react @tiptap/core @tiptap/starter-kit @tiptap/pm
pnpm add @convex-dev/prosemirror-sync  # For useTiptapSync hook
```

**AI Agent Setup:**

Add tool to agent configuration in `convex/agents/agents.ts`:

```typescript
import { setDocumentText } from "./tools";

export const assistantAgent = new Agent(components.agent, {
  chat: model,
  tools: {
    setDocumentText,
    // ... other tools
  },
  instructions: `You can create and edit documents using setDocumentText...`,
});
```

### Required Dependencies

**Backend (Convex):**
```json
{
  "@convex-dev/prosemirror-sync": "^0.1.23",
  "@convex-dev/agent": "^0.1.6",
  "convex": "^1.23.0",
  "zod": "^3.25.46"
}
```

**Frontend (React):**
```json
{
  "@convex-dev/prosemirror-sync": "^0.1.23",
  "@tiptap/react": "^2.22.1",
  "@tiptap/core": "^2.22.1",
  "@tiptap/starter-kit": "^2.22.1",
  "@tiptap/pm": "^2.22.1",
  "react-resizable-panels": "^3.0.3",
  "convex": "^1.23.0"
}
```

---

## 9. Implementation Checklist

### Setup Tasks
- [ ] Install `@convex-dev/prosemirror-sync` package
- [ ] Register ProseMirror Sync component in `convex/convex.config.ts`
- [ ] Install TipTap packages (`@tiptap/react`, `@tiptap/starter-kit`)
- [ ] Install `react-resizable-panels` for split-pane UI
- [ ] Deploy Convex schema changes to create `threadDocuments` table
- [ ] Verify Convex component installed (check `_components` table in dashboard)

### Backend Implementation Steps

#### 1. Create Sync API Wrapper
- [ ] Create `convex/agents/canvas.ts`
- [ ] Import ProseMirrorSync from component
- [ ] Export sync API functions (`getSnapshot`, `submitSnapshot`, etc.)

#### 2. Create Document Management Functions
- [ ] Create `convex/documents.ts`
- [ ] Implement `createDocumentForThread` mutation
  - [ ] Check for existing document (enforce 1-to-1)
  - [ ] Generate document ID (`doc_${threadId}`)
  - [ ] Create ProseMirror doc with initial content
  - [ ] Insert metadata in `threadDocuments` table
- [ ] Implement `getDocumentForThread` query
  - [ ] Query by thread ID with index
  - [ ] Return null if not found
- [ ] Implement `deleteDocument` mutation
  - [ ] Delete from ProseMirror Sync
  - [ ] Delete metadata from table
  - [ ] Add authorization check
- [ ] Implement `updateDocumentTitle` mutation
- [ ] Implement `refreshDocumentTimestamp` internal mutation

#### 3. Create AI Tool for Document Editing
- [ ] Create `setDocumentText` tool in `convex/agents/tools.ts`
- [ ] Add tool arguments validation (content, title)
- [ ] Implement delete-and-recreate pattern:
  - [ ] Check if document exists
  - [ ] Create if new, otherwise delete existing
  - [ ] Convert text to ProseMirror JSON structure
  - [ ] Call `prosemirrorSync.create()`
  - [ ] Increment document version via `refreshDocumentTimestamp`
- [ ] Add comprehensive error handling and logging
- [ ] Return user-friendly success/error messages

#### 4. Integrate Tool with AI Agent
- [ ] Import `setDocumentText` in `convex/agents/agents.ts`
- [ ] Add to agent's `tools` object
- [ ] Update agent instructions to mention document editing capability
- [ ] Test tool calling in chat

### Frontend Implementation Steps

#### 1. Create Canvas Editor Component
- [ ] Create `app/features/ai-chat/components/CanvasEditor.tsx`
- [ ] Implement `useTiptapSync` hook integration
- [ ] Configure TipTap editor with StarterKit extensions
- [ ] Add sync extension from `useTiptapSync`
- [ ] Handle loading states (`sync.isLoading`)
- [ ] Render `EditorContent` component
- [ ] Add title editing UI (inline input with save/cancel)
- [ ] Add delete button with confirmation
- [ ] Add mutations for title update and delete

#### 2. Create Canvas Layout Component
- [ ] Create `app/features/ai-chat/components/CanvasLayout.tsx`
- [ ] Import `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`
- [ ] Create left panel for `CanvasEditor`
- [ ] Create right panel for chat (receives `children`)
- [ ] Add chat visibility toggle state
- [ ] Add chat header with hide/show button
- [ ] Add floating "Show Chat" button when hidden
- [ ] Set responsive default sizes (60/40 split)

#### 3. Update Thread View for Conditional Rendering
- [ ] Add `useQuery(api.documents.getDocumentForThread)` in `ThreadView.tsx`
- [ ] Implement conditional rendering logic:
  - [ ] If `threadDocument` exists → render `CanvasLayout`
  - [ ] If `null` → render standard chat UI
  - [ ] If `undefined` → render skeleton
- [ ] Pass document props to `CanvasLayout`:
  - [ ] `documentId`, `threadId`, `documentTitle`, `documentVersion`
- [ ] Pass chat content as `children` to `CanvasLayout`
- [ ] Add document creation handler
- [ ] Add document delete handler
- [ ] Add document title change handler

#### 4. Add Document Creation UI
- [ ] Add "Create Document" button in chat UI (when no document)
- [ ] Wire up `useMutation(api.documents.createDocumentForThread)`
- [ ] Handle creation errors (already exists, auth, etc.)
- [ ] Show loading state during creation
- [ ] Automatically switch to canvas layout when created

#### 5. Handle Document Version Changes
- [ ] Use `documentVersion` as part of `CanvasEditor` key
- [ ] Ensure component remounts when version increments
- [ ] Verify sync resets after AI edits
- [ ] Test concurrent editing scenarios

### Testing Requirements

#### Unit Tests (if applicable)
- [ ] Test `textToProseMirrorDoc` conversion utility
- [ ] Test document ID generation logic
- [ ] Test version increment logic

#### Integration Tests
- [ ] Test document creation flow
  - [ ] Create document for thread
  - [ ] Verify metadata stored correctly
  - [ ] Verify ProseMirror doc created
  - [ ] Verify UI switches to canvas layout
- [ ] Test AI tool execution
  - [ ] AI creates new document
  - [ ] AI updates existing document
  - [ ] Verify version increments
  - [ ] Verify UI shows updated content
- [ ] Test concurrent editing
  - [ ] User edits while AI generates
  - [ ] Verify sync resolves correctly
  - [ ] Verify no data loss
- [ ] Test document deletion
  - [ ] Delete from UI
  - [ ] Verify both ProseMirror doc and metadata deleted
  - [ ] Verify UI returns to chat-only mode
- [ ] Test authorization
  - [ ] Only creator can delete
  - [ ] Only creator can update title
  - [ ] Other users cannot modify

#### Manual Testing Scenarios
- [ ] Create thread, ask AI to create document
- [ ] Edit document while chatting with AI
- [ ] Ask AI to update document content
- [ ] Resize panels (drag handle)
- [ ] Hide/show chat sidebar
- [ ] Edit document title inline
- [ ] Delete document and verify chat-only mode
- [ ] Test on mobile (responsive layout)
- [ ] Test with slow network (loading states)
- [ ] Test with multiple tabs open (real-time sync)

#### Edge Cases
- [ ] What happens if document creation fails mid-way?
- [ ] What if AI tries to create document twice?
- [ ] What if user deletes document while AI is writing?
- [ ] What if network disconnects during sync?
- [ ] What if two users try to delete same document?

### Deployment Considerations

#### Pre-Deployment Checklist
- [ ] Run type checking (`pnpm typecheck`)
- [ ] Deploy schema changes (`pnpm convex dev`)
- [ ] Verify ProseMirror Sync component installed in dashboard
- [ ] Test in Convex dev environment first
- [ ] Check console logs for errors
- [ ] Test AI tool calling in dev

#### Production Deployment
- [ ] Deploy backend (`convex deploy --prod`)
- [ ] Deploy frontend (`pnpm build && deploy`)
- [ ] Monitor error logs for 24h
- [ ] Check ProseMirror Sync component performance
- [ ] Monitor token usage for AI tool calls
- [ ] Set up alerts for document creation failures

#### Rollback Plan
- [ ] Keep previous schema version
- [ ] Disable AI document tool if issues arise
- [ ] Ensure old chat-only UI still works
- [ ] Document rollback procedure

---

## 10. Advanced Considerations

### Performance Optimization

**ProseMirror Sync:**
- Documents stored as snapshots + incremental steps
- Large documents may slow down sync (consider size limits)
- Old steps can be compacted (check component docs)

**React Rendering:**
- `useMemo` for expensive message grouping logic
- Virtualization for long documents (not currently implemented)
- Debounce title updates to reduce mutations

### Security

**Document Access Control:**
Currently only checks document creator. For multi-user collaboration:
- Add `threadDocuments.permissions` field with user IDs
- Check permissions in queries/mutations
- Add "Share Document" feature

**AI Tool Safety:**
- AI cannot access documents from other threads
- AI cannot impersonate other users
- Tool validates `ctx.threadId` and `ctx.userId`

### Extensibility

**Markdown Export:**
Add tool to convert ProseMirror JSON to markdown:
```typescript
export const exportDocumentAsMarkdown = createTool({
  description: "Export the document as markdown",
  args: z.object({}),
  handler: async (ctx): Promise<string> => {
    // Get ProseMirror doc
    // Convert to markdown using prosemirror-markdown
    // Return markdown string
  },
});
```

**Version History:**
Track all document versions:
```typescript
documentVersions: defineTable({
  documentId: v.string(),
  version: v.number(),
  content: v.string(), // Serialized ProseMirror JSON
  createdAt: v.number(),
  createdBy: v.id("users"),
})
```

**Rich Media Support:**
Add image/video extensions to TipTap:
```typescript
import Image from '@tiptap/extension-image';
import Video from '@tiptap/extension-video';

const extensions = [
  StarterKit,
  Image,
  Video,
  sync.extension
];
```

### Troubleshooting

**Document Not Syncing:**
1. Check browser console for errors
2. Verify `useTiptapSync` receives correct document ID
3. Check Convex dashboard for ProseMirror Sync component
4. Verify sync API exported in `canvas.ts`

**AI Updates Not Showing:**
1. Check if `documentVersion` incremented
2. Verify `refreshDocumentTimestamp` called
3. Check if component remounted (React DevTools)
4. Check if `createdAt` updated in database

**Concurrent Edit Conflicts:**
- ProseMirror Sync handles OT automatically
- If issues persist, increase step compaction frequency
- Consider limiting concurrent editors

**Performance Issues:**
- Check document size (large docs slow down sync)
- Monitor Convex function execution time
- Consider pagination for message history
- Use virtualization for long documents

---

## Conclusion

This collaborative canvas feature combines real-time document editing, AI agent tools, and reactive UI to create a seamless co-authoring experience. The key architectural decisions are:

1. **Delete-and-recreate pattern** for AI edits (avoids OT complexity)
2. **Version-based component remounting** (ensures fresh state)
3. **One document per thread** (simplifies UX and data model)
4. **Conditional layout rendering** (canvas vs chat-only)
5. **ProseMirror Sync component** (handles operational transformation)

By following this guide, you can implement a similar feature in any stack that supports real-time subscriptions and AI tool calling. The patterns are framework-agnostic, though the specific libraries (Convex, TipTap, React) would need equivalents in other ecosystems.
