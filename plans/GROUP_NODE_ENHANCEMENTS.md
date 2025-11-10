# Group Node Enhancements - Drag-to-Group & AI Context

## Database Design

### Existing Schema (No Changes Needed)
- `canvas_nodes.parentGroupId` - Already indexed by `by_parent_group`
- `group_nodes` table - Already has title, description, color
- `canvas_edges` - Already indexed by `by_target` for finding incoming edges

### New Query Needed
**Purpose**: Get full context from group's children recursively

**getGroupContextInternal** (internal query)
- Input: `canvasNodeId` (group), `organizationId`
- Output: Array of context messages `[{ role: "system", content: string }]`
- Logic: Get all children via `by_parent_group`, recursively call `getNodeContextInternal` for each child, aggregate results

## Data Flow

### Drag-to-Group Flow
1. User drags node over group → `onNodeDrag` fires continuously
2. `getIntersectingNodes` checks overlap with groups
3. Visual feedback: highlight group border when intersection detected
4. On drop → `onNodeDragStop` → call `addNodeToGroup` mutation
5. Backend: Update `parentGroupId`, calculate grid position, return success
6. Frontend: Remove node from React Flow state (group renders it internally)

### Context Gathering Flow (Group → Chat)
1. User connects group node to chat node → creates edge in `canvas_edges`
2. Chat sends message → `sendMessage` action calls `getNodeContextInternal`
3. Backend detects source node is group type → calls `getGroupContextInternal`
4. Recursively gather context from ALL children (text, youtube, website, etc.)
5. Aggregate all child contexts into single system message
6. Pass to AI agent with combined context

## User Flows

### User: Drag Node to Group
- Drag existing node across canvas
- Hover over group → group border highlights (blue glow)
- Drop → node disappears from canvas, appears inside group grid
- Toast: "Added to [Group Name]"

### User: Connect Group to Chat
- Click source handle on group node
- Drag connection to chat node target handle
- Release → animated edge created
- Type message in chat → AI receives context from ALL nodes in group
- Response uses combined knowledge from group contents

### User: Remove Node from Group
- Click X button on child node card inside group
- Node removed from group, appears on canvas at calculated absolute position
- Toast: "Node removed from group"

### User: Delete Group
- Delete group with children → modal asks: "Delete children?" or "Ungroup?"
- Delete children: Removes all child nodes and their data
- Ungroup: Removes parent relationship, children stay on canvas

## UI Components

### Canvas Component Updates
**Purpose**: Handle drag detection and grouping

**Key Interactions**:
- `onNodeDrag` - Check intersection with groups, show highlight
- `onNodeDragStop` - If over group, call `addNodeToGroup`, update local state
- Remove grouped nodes from React Flow state (groups render internally)

**Data Requirements**:
- Current dragged node
- All group nodes on canvas
- `getIntersectingNodes` from `useReactFlow`

### GroupNode Component (Already Exists)
**Purpose**: Container that renders children internally

**Key Enhancements Needed**:
- Add source/target handles (ALREADY HAS: `handles={{ target: true, source: true }}`)
- Visual highlight state when node being dragged over
- Grid layout for children (ALREADY IMPLEMENTED: 2-column grid)

**Data Requirements**:
- `groupChildren` query (ALREADY USED)
- Group node metadata (title, color)
- Child node data (ALREADY FETCHED)

### Drag Feedback Indicator
**Purpose**: Show visual feedback during drag

**Key Interactions**:
- Show highlighted border on group during drag hover
- Show "drop zone" indicator inside group
- Dim other nodes when dragging

**Data Requirements**:
- Current drag state
- Intersecting group ID

## API Routes (Convex Functions)

### Mutations

**addNodeToGroup** (ALREADY EXISTS - No Changes)
- Input: `canvasNodeId`, `parentGroupId`
- Output: `{ success: boolean, gridPosition: { x, y } }`
- Already handles: Grid calculation, parent assignment, ownership checks

**removeNodeFromGroup** (ALREADY EXISTS - No Changes)
- Input: `canvasNodeId`, optional `newPosition`
- Output: `{ success: boolean, node: DBNode }`
- Already handles: Absolute position calculation, parent removal

### Queries

**getGroupChildren** (ALREADY EXISTS - No Changes)
- Input: `canvasNodeId`
- Output: Array of child nodes with full data
- Already fetches: Text content, youtube data, website data, etc.

### Internal Queries (NEW)

**getGroupContextInternal**
- Input: `canvasNodeId` (group), `organizationId`
- Output: `Array<{ role: "system", content: string }>`
- Logic:
  1. Verify group ownership
  2. Query children via `by_parent_group` index
  3. For each child, get context:
     - Text: content
     - YouTube: title + transcript
     - Website: title + markdown
     - TikTok: title + transcript
     - Facebook Ad: title + body + transcript
     - Group (nested): Recursively call `getGroupContextInternal`
  4. Format as system messages with headers
  5. Return aggregated array

## Patterns to Reuse

### Context Gathering Pattern
**Reuse**: `getNodeContextInternal` in `convex/canvas/chat.ts` (lines 143-249)
- Pattern: Switch on `nodeType`, fetch specific table, format content
- Extension: Add `case "group"` that recursively calls `getGroupContextInternal`

### Intersection Detection Pattern
**Reuse**: React Flow's `getIntersectingNodes` + `onNodeDrag`
- Example in docs: Node intersection detection with highlighting
- Apply: Check if intersecting node is type "group", highlight border

### Drag-and-Drop Pattern
**Reuse**: Existing node creation handlers (YouTube, Website, etc.)
- Pattern: Action → Local state update → Backend mutation → State sync
- Apply: Detect drop on group → Update backend → Remove from local state

### Authentication Pattern (ALREADY USED EVERYWHERE)
- Get `identity` from `ctx.auth.getUserIdentity()`
- Check `organizationId` exists and is string
- Verify ownership via indexes (`by_organization`, `by_canvas`)

## Implementation Steps

### 1. Backend: Group Context Gathering
- Add `getGroupContextInternal` to `convex/canvas/chat.ts`
- Update `getNodeContextInternal` to handle `nodeType === "group"` case
- Test recursion with nested groups

### 2. Frontend: Drag Detection
- Add `onNodeDrag` handler to canvas component
- Use `getIntersectingNodes` to detect group overlap
- Store intersecting group in state for highlighting

### 3. Frontend: Visual Feedback
- Add highlight class to GroupNode when `isHighlighted` prop true
- Pass highlight state from canvas to GroupNode
- CSS: Blue glowing border on highlight

### 4. Frontend: Drop Logic
- In `onNodeDragStop`, check if node over group
- Call `addNodeToGroup` mutation if valid
- Remove node from React Flow local state
- Add error handling + toast feedback

### 5. Testing
- Test: Drag text node to group → appears in grid
- Test: Connect group to chat → send message with context
- Test: Nested groups → context gathers recursively
- Test: Remove node from group → appears on canvas
- Test: Delete group → children handled correctly

## Edge Cases

### Prevent Invalid Groups
- Cannot group a group inside itself (ALREADY HANDLED in `addNodeToGroup`)
- Cannot create circular nesting (add check: traverse parent chain)
- Cannot group if not authorized (ALREADY HANDLED: ownership checks)

### Position Calculations
- When ungrouping: Calculate absolute position from relative + parent position (ALREADY HANDLED)
- When dragging group: Children move with it (React Flow handles via internal rendering)
- Grid overflow: If too many children, group should auto-expand height

### Context Size Limits
- Very large groups could exceed token limits
- Solution: Truncate each child's content after X chars (add to context gathering)
- Show warning toast if context truncated

### Real-time Sync
- When child added: Group re-renders automatically (Convex reactivity)
- When node ungrouped: Canvas must add back to React Flow (ALREADY HANDLED: `onNodeUngrouped` callback)

## Gotchas & Notes

### React Flow Parent-Child Architecture
- DO NOT use React Flow's `parentNode` property
- Groups render children internally, not via React Flow hierarchy
- Filter out `parentGroupId` nodes from initial load (ALREADY DONE: line 128)

### Context Order Matters
- Children should be included in consistent order (sort by position or createdAt)
- Add sorting to `getGroupChildren` query

### Handle Positioning on Groups
- Handles already added to GroupNode (line 145)
- Source handle: bottom, Target handle: top
- Works same as other nodes for connections

### Grid Auto-Layout
- ALREADY IMPLEMENTED: 2-column grid with gaps
- Config: `COLS=2`, `NODE_WIDTH=420`, `NODE_HEIGHT=320`, `GAP=20`
- New nodes added to next available grid position

### Performance
- Large groups (>20 nodes) may slow context gathering
- Consider pagination or "load more" for group children display
- Context gathering is server-side, so client perf unaffected
