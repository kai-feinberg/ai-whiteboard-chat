# Group Node Implementation - React Flow Native Pattern

## Database Design

### Schema Adjustments
**canvas_nodes table**:
- Keep existing `parentGroupId` field → rename to `parentId` for clarity
- Keep existing index `by_parent_group` → rename to `by_parent`

**No other changes needed**

### Queries

**getCanvasWithNodes** - Modify
- Input: `canvasId`, `organizationId`
- Output: ALL canvas nodes (don't filter out children)
- Purpose: React Flow needs full node tree

**getChildNodes** - New
- Input: `parentNodeId`, `organizationId`
- Output: Child canvas nodes with full node data
- Purpose: Context gathering for groups

## Data Flow

### React Flow Parent-Child Pattern
1. DB has nodes with `parentId` references
2. Map to React Flow nodes with `parentId` property set
3. React Flow automatically renders children inside parent bounds
4. Child `position` is relative to parent's top-left
5. Dragging parent moves children automatically

### Drag-to-Group
1. Drag node → `onNodeDragStop` fires
2. Call `getIntersectingNodes(node)`
3. Find intersecting groups
4. Calculate relative position: `draggedPos - groupPos`
5. Backend: Set `parentId`, update position to relative
6. Update React Flow state: Set `parentId`, `position`, `extent: 'parent'`

### Group Context for Chat
1. Chat receives message
2. Get incoming edges
3. For each source:
   - Regular node → get context from node table
   - Group node → call `getGroupContext` → recurse through children
4. Aggregate contexts
5. Pass to AI

## User Flows

### Drag Node into Group
- Drag node over group
- Drop
- Node becomes child with relative positioning
- Moves with parent when parent dragged

### Connect Group to Chat
- Create edge from group to chat
- Send message
- AI gets context from all children in group

### Ungroup Node
- Action to remove parent
- Backend converts relative → absolute position
- Node independent on canvas

## UI Components

### Canvas (`src/routes/canvas/$canvasId/index.tsx`)

**Modify node loading**:
```typescript
const flowNodes = canvasData.nodes.map(dbNode => ({
  id: dbNode._id,
  type: dbNode.nodeType,
  position: dbNode.position, // Relative if has parent
  data: { ...nodeData },
  parentId: dbNode.parentId, // KEY: Set parent
  extent: dbNode.parentId ? 'parent' : undefined, // Constrain to parent
  zIndex: dbNode.nodeType === 'group' ? -1 : 0,
}));
```

**Add handler**:
```typescript
const onNodeDragStop = useCallback(async (event, node) => {
  if (node.parentId || node.type === 'group') return;

  const intersecting = getIntersectingNodes(node);
  const group = intersecting.find(n => n.type === 'group');

  if (group) {
    const relativePos = {
      x: node.position.x - group.position.x,
      y: node.position.y - group.position.y,
    };

    await setNodeParent({
      nodeId: node.id,
      parentId: group.id,
      position: relativePos,
    });

    setNodes(nds => nds.map(n =>
      n.id === node.id
        ? { ...n, parentId: group.id, position: relativePos, extent: 'parent' }
        : n
    ));
  }
}, [getIntersectingNodes]);
```

**Data needs**:
- `useReactFlow()` for `getIntersectingNodes`
- Mutation `setNodeParent`

### GroupNode (`src/features/canvas/components/GroupNode.tsx`)

**Simplify - React Flow handles children**:
```typescript
<div style={{ width: 900, height: 700 }}>
  <Handle type="target" position={Position.Top} />
  <div>Group Title</div>
  {/* React Flow renders children here automatically */}
  <Handle type="source" position={Position.Bottom} />
</div>
```

**Remove**:
- Manual child rendering
- `getGroupChildren` query usage
- Child cards/grid layout

**Keep**:
- Handles for connections
- Title editing
- Styling/borders

## API Routes (Convex)

### Mutations

**setNodeParent** - New
- Input: `nodeId`, `parentId` (nullable), `position`
- Output: `{ success: boolean }`
- Logic:
  - Verify ownership
  - If setting parent: Update `parentId`, set relative `position`
  - If removing parent: Set `parentId = null`, convert to absolute position
  - Update timestamp

**updateNodePosition** - Modify
- Handle relative positions for nodes with parents
- If has parent, position relative to parent
- If no parent, position absolute on canvas

### Queries

**getCanvasWithNodes** - Modify
- Remove filter excluding nodes with `parentId`
- Return ALL nodes
- Frontend will set up parent-child relationships

**getChildNodes** - New
- Input: `parentNodeId`, `organizationId`
- Output: Array of child nodes
- Query: `.withIndex("by_parent", q => q.eq("parentId", parentNodeId))`
- Used for context gathering

### Internal Queries

**getGroupContextInternal** - New
- Input: `groupNodeId`, `organizationId`
- Output: `Array<{ role: "system", content: string }>`
- Logic:
  1. Get children via `by_parent` index
  2. For each child:
     - Text → fetch content
     - YouTube → fetch transcript
     - Website → fetch markdown
     - TikTok → fetch transcript
     - Facebook → fetch ad data
     - Group → recurse `getGroupContextInternal`
  3. Format as system messages
  4. Return array

**getNodeContextInternal** - Modify
- Add case: `nodeType === "group"`
- Call `getGroupContextInternal`
- Return aggregated context

## Patterns to Reuse

### React Flow Parent-Child (from docs)
```typescript
nodes = [
  { id: 'parent', type: 'group', position: { x: 0, y: 0 } },
  {
    id: 'child',
    position: { x: 10, y: 10 }, // Relative to parent
    parentId: 'parent',
    extent: 'parent' // Constrain to parent bounds
  }
]
```

### Intersection Detection (from docs)
```typescript
const { getIntersectingNodes } = useReactFlow();

onNodeDrag={(_, node) => {
  const intersecting = getIntersectingNodes(node);
  // Highlight logic
}}
```

### Context Gathering (existing)
- Pattern in `convex/canvas/chat.ts`
- Switch on `nodeType`
- Fetch from table
- Format message
- Add to array

### Auth (existing)
- `ctx.auth.getUserIdentity()`
- Check `organizationId`
- Verify ownership

## Implementation Steps

### 1. Backend: Schema & Mutations
- Rename `parentGroupId` → `parentId` (search/replace in schema + all functions)
- Create `setNodeParent` mutation
- Create `getChildNodes` query
- Modify `getCanvasWithNodes` to return all nodes

### 2. Backend: Group Context
- Create `getGroupContextInternal` in `convex/canvas/chat.ts`
- Update `getNodeContextInternal` - add group case
- Test recursive gathering

### 3. Frontend: Node Loading
- Remove filter for `parentGroupId` in initial load
- Map `parentId` to React Flow nodes
- Set `extent: 'parent'` for children
- Set `zIndex: -1` for groups

### 4. Frontend: Drag-to-Group
- Add `onNodeDragStop` to ReactFlow
- Use `getIntersectingNodes`
- Call `setNodeParent` on drop
- Update local state

### 5. Frontend: Simplify GroupNode
- Remove manual child rendering
- Remove `getGroupChildren` query
- Keep handles, title, styling
- Let React Flow render children

### 6. Testing
- Drag node to group → becomes child
- Drag parent → children follow
- Connect group to chat → context works
- Nested groups → recursive context
- Ungroup → node independent

## Edge Cases

### Circular Nesting
- Check: Node cannot be parent of itself
- Check: Cannot create cycle in parent chain
- Traverse up chain before setting parent

### Position Math
- **Group**: `relPos = nodeAbsPos - parentAbsPos`
- **Ungroup**: `absPos = nodeRelPos + parentAbsPos`
- Handle deleted parent: Fallback to (0,0)

### Z-Index
- Groups at `zIndex: -1` (behind)
- Children auto-layered by React Flow
- Don't manually set child z-index

### Extent
- `extent: 'parent'` prevents drag outside
- Only set when `parentId` exists
- Remove on ungroup

### Nested Groups
- React Flow supports infinite nesting
- Context gathering must recurse
- Test 3+ levels

## Gotchas

### React Flow Renders Children
- DON'T manually render in GroupNode
- React Flow handles positioning/rendering
- Parent just defines container bounds

### Coordinate Systems
- Absolute: From canvas (0,0)
- Relative: From parent top-left
- Switch based on `parentId` presence

### Extent Behavior
- `'parent'` = bounded by parent
- `undefined` = no constraint
- `[[x1,y1],[x2,y2]]` = custom bounds

### Loading Order
- Parent/child load order doesn't matter
- React Flow handles gracefully
- No special ordering needed

### Group Size
- Must be large enough for children
- Children can overflow if too small
- Auto-resize: Future enhancement

### Handles Work Normally
- Groups handle connections like regular nodes
- Same handle positioning
- Edges work identically

### DB Consistency
- Always update `parentId` + `position` together
- Clean up children when parent deleted
- Cascade or ungroup (configurable)

### Performance
- 50+ children may slow render
- React Flow virtualizes efficiently
- Context gathering backend only
