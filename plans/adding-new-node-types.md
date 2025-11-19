# Adding New Node Types to AI Whiteboard Chat

This guide documents the complete process for adding a new node type to the canvas system.

## Overview

When adding a new node type (e.g., YouTube, Twitter, TikTok), you need to update multiple files across the backend (Convex), frontend (React), and canvas integration layers. This guide uses Twitter as the reference example.

---

## 1. Database Schema

**File:** `convex/schema.ts`

### Add Node-Specific Table

```typescript
// Example: twitter_nodes table
twitter_nodes: defineTable({
  organizationId: v.string(),
  url: v.string(),                    // Original URL
  tweetId: v.string(),                // Extracted ID
  fullText: v.optional(v.string()),   // Main content
  // ... other fields specific to this node type
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_organization", ["organizationId"])
```

### Update `canvas_nodes` Table

Add to `nodeType` union:
```typescript
nodeType: v.union(
  v.literal("text"),
  v.literal("chat"),
  v.literal("youtube"),
  v.literal("twitter"),  // ← Add your new type
  // ... other types
)
```

Add to `data.nodeId` union:
```typescript
data: v.object({
  nodeId: v.union(
    v.id("text_nodes"),
    v.id("chat_nodes"),
    v.id("twitter_nodes"),  // ← Add your new type
    // ... other types
  ),
})
```

---

## 2. Backend API Integration

**File:** `convex/canvas/[node-type].ts` (new file)

Create a new file for your node type with the following functions:

### Required Functions

```typescript
// 1. URL/ID extraction helper
function extractTwitterId(url: string): string | null {
  // Parse and validate URL, extract ID
}

// 2. Main creation action (entry point)
export const createTwitterNode = action({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    // Auth check
    // Extract ID from URL
    // Call internal mutation
    // Schedule background fetch
    return { canvasNodeId, twitterNodeId };
  },
});

// 3. Internal mutation (creates DB records)
export const createTwitterNodeInternal = internalMutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    // Create node-specific record (twitter_nodes)
    // Create canvas_nodes reference
    // Set initial status to "pending"
    // Return IDs
  },
});

// 4. Background fetch action (scrapes/fetches data)
export const fetchTweetData = internalAction({
  args: { twitterNodeId: v.id("twitter_nodes") },
  handler: async (ctx, args) => {
    // Get node
    // Update status to "processing"
    // Call external API
    // Extract data from response
    // Update node with data, status "completed"
    // Handle errors, set status "failed"
  },
});

// 5. Internal query (for background action)
export const getTwitterNodeInternal = internalQuery({
  args: { twitterNodeId: v.id("twitter_nodes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.twitterNodeId);
  },
});

// 6. Internal mutation (for background updates)
export const updateTwitterNodeInternal = internalMutation({
  args: { /* all fields as optional */ },
  handler: async (ctx, args) => {
    // Patch node with updates
  },
});
```

### Node Dimensions

Set appropriate width/height in `createTwitterNodeInternal`:
```typescript
width: 600,  // Adjust based on content
height: 350, // Adjust based on content
```

---

## 3. Query Functions

**File:** `convex/canvas/functions.ts`

### Add Query Function

```typescript
export const getTwitterNode = query({
  args: { twitterNodeId: v.id("twitter_nodes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected");
    }

    const node = await ctx.db.get(args.twitterNodeId);
    if (!node || node.organizationId !== organizationId) {
      throw new Error("Not found or unauthorized");
    }

    return node;
  }
});
```

### Update `getCanvasWithNodes`

Add to the node loading logic:
```typescript
} else if (node.nodeType === "twitter") {
  const twitterNode = await ctx.db.get(node.data.nodeId as Id<"twitter_nodes">);
  return {
    ...node,
    twitterNodeId: twitterNode?._id || null,
  };
}
```

---

## 4. Context Gathering (CRITICAL - Two Places!)

⚠️ **You must update BOTH context gathering functions or AI chat won't receive the context.**

### 4A. UI Context Dialog

**File:** `convex/canvas/nodes.ts` → `getNodeContext` function

Add after existing node types:
```typescript
} else if (node.nodeType === "twitter") {
  const twitterNode = await ctx.db.get(node.data.nodeId as Id<"twitter_nodes">);
  if (twitterNode?.fullText) {
    const author = twitterNode.authorUsername ? `@${twitterNode.authorUsername}` : "";
    contextMessages.push({
      role: "system",
      content: `Tweet${author ? ` by ${author}` : ""}\nURL: ${twitterNode.url}\n\nContent:\n${twitterNode.fullText}`,
    });
  }
}
```

### 4B. AI Chat Context (MUST DO!)

**File:** `convex/canvas/chat.ts` → `getNodeContextInternal` function

Add the **exact same logic** as above:
```typescript
} else if (sourceNode.nodeType === "twitter") {
  const twitterNode = await ctx.db.get(sourceNode.data.nodeId as Id<"twitter_nodes">);
  if (twitterNode?.fullText) {
    const author = twitterNode.authorUsername ? `@${twitterNode.authorUsername}` : "";
    contextMessages.push({
      role: "system",
      content: `Tweet${author ? ` by ${author}` : ""}\nURL: ${twitterNode.url}\n\nContent:\n${twitterNode.fullText}`,
    });
  }
}
```

**Why two places?**
- `getNodeContext` (nodes.ts): Shows context in UI dialog
- `getNodeContextInternal` (chat.ts): Feeds context to AI chat

---

## 5. Delete Node Support

**File:** `convex/canvas/nodes.ts` → `deleteNode` function

Update the union type to include your new node type:
```typescript
await ctx.db.delete(
  canvasNode.data.nodeId as
    Id<"text_nodes"> |
    Id<"chat_nodes"> |
    Id<"youtube_nodes"> |
    Id<"twitter_nodes"> |  // ← Add your type
    Id<"facebook_ads_nodes"> |
    Id<"group_nodes">
);
```

---

## 6. Frontend Component

**File:** `src/features/canvas/components/[NodeType]Node.tsx` (new file)

### Component Structure

```typescript
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";

interface TwitterNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  twitterNodeId: Id<"twitter_nodes">;
}

export function TwitterNode({ data }: NodeProps<TwitterNodeData>) {
  const twitterNode = useQuery(
    api.canvas.functions.getTwitterNode,
    data.twitterNodeId ? { twitterNodeId: data.twitterNodeId } : "skip"
  );

  // Loading state
  if (!twitterNode) {
    return (
      <Node handles={{ target: false, source: true }}>
        <NodeHeader variant="twitter">
          <NodeTitle>Loading...</NodeTitle>
        </NodeHeader>
        <NodeContent>
          <Loader2 className="h-6 w-6 animate-spin" />
        </NodeContent>
      </Node>
    );
  }

  // Main render with status handling
  return (
    <Node handles={{ target: false, source: true }}>
      <NodeHeader variant="twitter">
        <NodeTitle>Twitter/X</NodeTitle>
      </NodeHeader>
      <NodeContent>
        {twitterNode.status === "pending" && <div>Preparing...</div>}
        {twitterNode.status === "processing" && <div>Fetching...</div>}
        {twitterNode.status === "failed" && <div>{twitterNode.error}</div>}
        {twitterNode.status === "completed" && (
          // Render your content here
        )}
      </NodeContent>
    </Node>
  );
}
```

---

## 7. Node Styling

**File:** `src/components/ai-elements/canvas/node.tsx`

### Add Variant to Type

```typescript
export type NodeHeaderProps = ComponentProps<typeof CardHeader> & {
  variant?: "default" | "youtube" | "twitter" | /* ... */ "text" | "group";
};
```

### Add Color Scheme

```typescript
const headerVariants = {
  default: "bg-secondary",
  youtube: "bg-gradient-to-br from-orange-50 to-orange-100/70 text-orange-800 border-orange-200/60",
  twitter: "bg-gradient-to-br from-blue-50 to-sky-100/70 text-blue-900 border-blue-200/60",
  // ... other variants
};
```

---

## 8. Canvas Route Integration

**File:** `src/routes/canvas/$canvasId/index.tsx`

### 8.1 Import Component

```typescript
import { TwitterNode } from "@/features/canvas/components/TwitterNode";
```

### 8.2 Register Node Type

```typescript
const nodeTypes: NodeTypes = {
  text: TextNode,
  chat: ChatNode,
  youtube: YouTubeNode,
  twitter: TwitterNode,  // ← Add here
  // ... other types
};
```

### 8.3 Update Dialog State Type

```typescript
const [dialogState, setDialogState] = useState<{
  type: "youtube" | "website" | "tiktok" | "twitter" | "facebook" | null;  // ← Add type
  open: boolean;
}>({ type: null, open: false });
```

### 8.4 Import Action

```typescript
const createTwitterNode = useAction(api.canvas.twitter.createTwitterNode);
```

### 8.5 Add to Data Mapping (for DB loading)

In the `useEffect` that loads canvas data:
```typescript
const nodeData = {
  canvasNodeId: dbNode._id,
  content: (dbNode as any).textContent,
  // ... other node IDs
  twitterNodeId: (dbNode as any).twitterNodeId,  // ← Add here
};
```

### 8.6 Add Handler Functions (CRITICAL for Instant Display!)

```typescript
// Handler to open dialog
const handleAddTwitterNode = async () => {
  setDialogState({ type: "twitter", open: true });
};

// Handler to submit URL
const handleTwitterUrlSubmit = async (url: string) => {
  try {
    const position = { x: Math.random() * 400, y: Math.random() * 400 };
    const result = await createTwitterNode({
      canvasId: canvasId as Id<"canvases">,
      position,
      url,
    });

    // ⚠️ CRITICAL: Add to local state immediately for instant display
    setNodes((nds) => [
      ...nds,
      {
        id: result.canvasNodeId,
        type: "twitter",
        position,
        data: {
          canvasNodeId: result.canvasNodeId,
          twitterNodeId: result.twitterNodeId,
        },
      },
    ]);

    toast.success("Twitter node created");
  } catch (error) {
    console.error("[Canvas] Error creating Twitter node:", error);
    toast.error(error instanceof Error ? error.message : "Failed to create Twitter node");
  }
};
```

**Why `setNodes()` is critical:**
- Without it, node won't appear until Convex real-time sync updates (slow)
- With it, node appears instantly, then updates with data as it loads

### 8.7 Add Toolbar Button

```typescript
<Button
  onClick={handleAddTwitterNode}
  variant="ghost"
  size="sm"
  className="gap-2"
>
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="..." />  {/* Icon SVG path */}
  </svg>
  Add Twitter
</Button>
```

### 8.8 Add URL Input Dialog

```typescript
<UrlInputDialog
  open={dialogState.open && dialogState.type === "twitter"}
  onOpenChange={(open) => setDialogState({ ...dialogState, open })}
  onSubmit={handleTwitterUrlSubmit}
  title="Add Twitter/X Post"
  description="Enter the Twitter/X post URL to add to your canvas"
  placeholder="https://twitter.com/username/status/..."
/>
```

---

## 9. Testing Checklist

- [ ] **Create Node**: Click toolbar button, enter URL, node appears instantly
- [ ] **Loading States**: Node shows "pending" → "processing" → "completed" states
- [ ] **Content Display**: Node displays fetched content correctly
- [ ] **Error Handling**: Invalid URLs show clear error messages
- [ ] **Context Dialog**: Right-click → "View Context" shows node content
- [ ] **AI Chat Context**: Connect to chat node, AI receives the context in system prompt
- [ ] **Delete Node**: Delete node removes it and associated data
- [ ] **Real-time Updates**: Multiple tabs see updates simultaneously
- [ ] **Org Scoping**: Node only visible to same organization
- [ ] **Type Check**: Run `pnpm dev` - no TypeScript errors

---

## 10. Common Gotchas

### Gotcha #1: Forgetting `getNodeContextInternal`
**Symptom**: Context shows in UI dialog but AI doesn't receive it
**Fix**: Add node case to BOTH `getNodeContext` (nodes.ts) AND `getNodeContextInternal` (chat.ts)

### Gotcha #2: Not Adding to Local State
**Symptom**: Node doesn't appear immediately after creation
**Fix**: Call `setNodes()` with new node data right after backend action completes

### Gotcha #3: Wrong Data Mapping
**Symptom**: Node shows loading spinner forever
**Fix**: Add `[nodeType]NodeId` to data mapping in canvas loading `useEffect`

### Gotcha #4: Missing from `deleteNode` Union
**Symptom**: TypeScript error when deleting node
**Fix**: Add `Id<"[node_type]_nodes">` to union type in `deleteNode`

### Gotcha #5: Forgetting Organization Check
**Symptom**: Security issue - users can access other org's nodes
**Fix**: Always verify `organizationId` matches in all query/mutation handlers

---

## Quick Reference: Files to Update

| # | File | What to Add |
|---|------|-------------|
| 1 | `convex/schema.ts` | Node table + update unions |
| 2 | `convex/canvas/[type].ts` | All backend functions (new file) |
| 3 | `convex/canvas/functions.ts` | Query function + canvas loader |
| 4 | `convex/canvas/nodes.ts` | `getNodeContext` + delete union |
| 5 | `convex/canvas/chat.ts` | `getNodeContextInternal` ⚠️ |
| 6 | `src/features/canvas/components/[Type]Node.tsx` | Component (new file) |
| 7 | `src/components/ai-elements/canvas/node.tsx` | Variant + color |
| 8 | `src/routes/canvas/$canvasId/index.tsx` | All integration (8 steps) |

---

## Example: Full Twitter Implementation

See actual implementation in codebase for complete working example:
- Backend: `convex/canvas/twitter.ts`
- Component: `src/features/canvas/components/TwitterNode.tsx`
- Integration: Search for "twitter" in `src/routes/canvas/$canvasId/index.tsx`

---

## Notes

- Always follow the async pattern: action → internal mutation → background fetch
- Use `status` field to track processing state
- Test error cases (invalid URLs, API failures, network issues)
- Consider rate limits for external APIs
- Document any API-specific requirements (keys, quotas, formats)
