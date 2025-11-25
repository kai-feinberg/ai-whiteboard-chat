# AI Image Generation Feature - Implementation Plan

## 1. Database Design

### New Tables

**`image_nodes`** table:
```typescript
{
  organizationId: string,
  prompt: string,              // User prompt that generated the image
  imageStorageId: string,      // Convex storage ID for generated image
  isAiGenerated: boolean,      // Flag: true for AI-generated, false for user uploads (future)
  width: number,              // Image dimensions
  height: number,
  status: "pending" | "processing" | "completed" | "failed",
  error?: string,
  createdAt: number,
  updatedAt: number
}
```

### Schema Updates

Update `canvas_nodes.nodeType` union:
- Add: `v.literal("image")`

Update `canvas_nodes.data.nodeId` union:
- Add: `v.id("image_nodes")`

### Queries/Mutations

**`getImageNode`** (query)
- Input: `imageNodeId: Id<"image_nodes">`
- Output: Image node data including status, prompt, storageId
- Purpose: Fetch image node for rendering in UI

**`getImageUrl`** (query)
- Input: `storageId: string`
- Output: Public URL for image
- Purpose: Get URL from Convex storage for display

**`createImageNodeInternal`** (internalMutation)
- Input: `canvasId`, `position`, `prompt`, `organizationId`
- Output: `{ canvasNodeId, imageNodeId }`
- Purpose: Create pending image node immediately (called from tool)

**`updateImageNodeInternal`** (internalMutation)
- Input: `imageNodeId`, `status`, `imageStorageId?`, `error?`, `width?`, `height?`
- Output: success boolean
- Purpose: Update node after generation completes/fails

**`generateImageAsync`** (internalAction)
- Input: `imageNodeId`
- Output: void (updates node via mutation)
- Purpose: Background image generation task

---

## 2. Data Flow

### High-Level Flow

1. **User sends chat message** → AI agent decides to call `generateImage` tool
2. **Tool executes immediately** → Creates pending image node on canvas, schedules async generation
3. **Tool returns to AI** → AI continues response telling user image is generating
4. **Background task runs** → Fetches placeholder/mock image, stores in Convex, updates node
5. **Real-time sync** → User sees loading state → completed image appears automatically

### Key Transformations

- **Tool call** → Canvas node creation (mutation) + Background task scheduling
- **Placeholder image fetch** → Blob → Convex storage upload → Storage ID
- **Node status transitions**: `pending` → `processing` → `completed`/`failed`
- **Real-time reactivity**: Convex subscriptions auto-update UI when status changes

---

## 3. User Flows

### End User Flow

1. User types message in chat node: "Create an image of a sunset over mountains"
2. AI responds: "I'll generate that image for you now" + calls `generateImage` tool
3. New image node appears on canvas instantly with loading spinner
4. After 2-5 seconds, loading spinner replaced with generated image
5. User can drag/position image node (no connections possible - source-only handle)

---

## 4. UI Components

### New Component: `ImageNode.tsx`

**Purpose**: Display AI-generated (or future user-uploaded) images on canvas

**Key Interactions**:
- View image in node (thumbnail/scaled)
- Loading state with spinner during generation
- Error state with retry option (future)
- Visual indicator showing "AI Generated" badge
- Download image button (future)

**Data Requirements**:
- `imageNodeId` to fetch image node data
- Status for conditional rendering
- `imageStorageId` to fetch display URL
- Prompt text for alt text / tooltip

**Visual Design**:
- Distinct header variant: `variant="image"` (purple/violet gradient)
- Icon: Sparkles or Image icon with AI badge
- No target handle (can't be connected TO)
- Source handle disabled (no connections FROM)

### Updated Components

**`canvas/$canvasId/index.tsx`**:
- Add `ImageNode` to `nodeTypes` mapping
- Add image node to context gathering system (return empty for now)

**`canvas/chat.ts`** (getNodeContextInternal):
- Add case for `nodeType === "image"` → return empty (images don't provide context)

---

## 5. AI Tool Implementation

### Tool Definition: `generateImage`

**Location**: `convex/canvas/chat.ts` (add to agent tools)

**Tool Setup**:
```typescript
import { createTool } from "@convex-dev/agent";
import { z } from "zod";

const generateImage = createTool({
  description: "Generate an AI image based on a text prompt and place it on the canvas",
  args: z.object({
    prompt: z.string().describe("Detailed description of the image to generate"),
  }),
  handler: async (ctx, args) => {
    // 1. Get canvasId from thread/chat context
    // 2. Calculate position (near chat node or canvas center)
    // 3. Create pending image node via mutation
    // 4. Schedule background generation
    // 5. Return success message to AI
    return "Image generation started. The image will appear on the canvas shortly.";
  },
});
```

**Integration Points**:
- Add tool to Agent constructor in `createCanvasChatAgent` function
- Access `canvasNodeId` from tool context to find canvas
- Credit check: Deduct estimated credits before tool execution
- Position strategy: Place near chat node or at canvas center

### Context Access in Tool

Tool needs access to:
- `canvasId` - from thread metadata or query canvas_nodes by chatNodeId
- `organizationId` - from ctx.auth
- `userId` - from ctx.userId
- Position calculation - query canvas_nodes to find chat node position, offset new image node

---

## 6. Backend Implementation

### File: `convex/canvas/images.ts` (NEW)

Following existing patterns from `youtube.ts` and `website.ts`:

**Functions**:
1. `createImageNodeInternal` - Mutation to create pending node
2. `getImageNodeInternal` - Query for internal use
3. `updateImageNodeInternal` - Mutation to update status/storage
4. `generateImageAsync` - Action to generate + store image
5. Public `getImageNode` - Query for UI to fetch node data

**Image Generation Mock**:
```typescript
// Placeholder approach:
const placeholderUrl = "https://placehold.co/1024x1024/6366f1/white?text=AI+Generated";
const response = await fetch(placeholderUrl);
const blob = await response.blob();
const storageId = await ctx.storage.store(blob);
```

### File: `convex/canvas/functions.ts`

Add query:
```typescript
export const getImageNode = query({
  args: { imageNodeId: v.id("image_nodes") },
  handler: async (ctx, args) => {
    // Auth + ownership check
    // Return image node data
    // Include storage URL via ctx.storage.getUrl()
  }
});
```

---

## 7. Patterns to Reuse

### Pattern: Async Node Creation (from YouTube/Website)

1. **Action** receives request
2. **Internal mutation** creates node with `status: "pending"`
3. **Scheduler** kicks off background task immediately (`runAfter(0, ...)`)
4. **Background action** fetches/processes data
5. **Internal mutation** updates node with results or error
6. **Convex real-time sync** updates UI automatically

### Pattern: File Storage (from Website screenshots)

```typescript
// In action:
const response = await fetch(imageUrl);
const blob = await response.blob();
const storageId = await ctx.storage.store(blob);

// In query (UI):
const url = await ctx.storage.getUrl(storageId);
return { ...node, imageUrl: url };
```

### Pattern: Credit Deduction (from chat.ts)

```typescript
// Before tool execution:
const monthlyCheck = await autumn.check(ctx, { featureId: "ai_credits" });
const topUpCheck = await autumn.check(ctx, { featureId: "topup_credits" });
const totalBalance = (monthlyCheck?.data?.balance || 0) + (topUpCheck?.data?.balance || 0);

if (totalBalance <= 0) {
  throw new Error("Insufficient credits");
}

// After generation completes:
await deductCreditsWithPriority(ctx, estimatedCost);
```

### Pattern: Context Gathering (from canvas/nodes.ts)

Add to `getNodeContext` and `getNodeContextInternal`:
```typescript
else if (node.nodeType === "image") {
  // Images don't provide context to AI
  // Future: could include image description or vision API analysis
  continue;
}
```

### Pattern: Tool Integration (from Convex Agent docs)

```typescript
// In createCanvasChatAgent function:
const agent = new Agent(components.agent, {
  name: agentName,
  instructions: systemPrompt,
  languageModel: modelId,
  tools: {
    generateImage,  // Add tool here
  },
  // ... rest of config
});
```

---

## 8. Implementation Checklist

### Phase 1: Database & Backend
- [ ] Add `image_nodes` table to schema
- [ ] Update `canvas_nodes.nodeType` union
- [ ] Create `convex/canvas/images.ts` with CRUD functions
- [ ] Create placeholder image generation action
- [ ] Add `getImageNode` query to canvas/functions.ts

### Phase 2: Tool Integration
- [ ] Define `generateImage` tool with createTool
- [ ] Add tool to agent constructor in canvas/chat.ts
- [ ] Implement canvas context access in tool handler
- [ ] Add credit check before tool execution
- [ ] Calculate position for new image node

### Phase 3: UI Components
- [ ] Create `ImageNode.tsx` component
- [ ] Add loading/error/completed states
- [ ] Add "image" variant to NodeHeader styles
- [ ] Register ImageNode in canvas route nodeTypes
- [ ] Test real-time status updates

### Phase 4: Context System
- [ ] Add image case to getNodeContext in canvas/nodes.ts
- [ ] Add image case to getNodeContextInternal in canvas/chat.ts
- [ ] Verify images don't break chat context gathering

### Phase 5: Testing & Polish
- [ ] Test tool calling from chat
- [ ] Test async generation flow
- [ ] Test credit deduction
- [ ] Test multiple simultaneous generations
- [ ] Test error states
- [ ] Verify real-time updates work

---

## 9. Future Enhancements (Out of Scope)

- User image uploads (set `isAiGenerated: false`)
- Image editing/regeneration
- Multiple image formats/sizes
- Image-to-image generation
- Vision API integration for context gathering
- Download image functionality
- Connect images as inputs to other nodes
- Retry failed generations

---

## 10. Key Technical Decisions

**Decision**: Image nodes use shared "image" type with `isAiGenerated` flag
- **Rationale**: Allows future user uploads to reuse same component/logic
- **Benefit**: Download, display, storage patterns unified

**Decision**: Images have NO connections (no target/source handles)
- **Rationale**: Images don't provide meaningful context to AI yet
- **Benefit**: Simpler initial implementation, can add vision API later

**Decision**: Tool returns immediately, generation happens async
- **Rationale**: Don't block AI response on image generation (2-10 seconds)
- **Benefit**: Better UX - user sees AI response + loading state simultaneously

**Decision**: Mock with placeholder image initially
- **Rationale**: API integration can be swapped later without changing flow
- **Benefit**: Ship faster, test full async pipeline with predictable results

**Decision**: Store images in Convex file storage (not external URLs)
- **Rationale**: Consistent with website screenshots, ensures persistence
- **Benefit**: Single storage system, automatic CDN, no external dependencies

---

## 11. Estimated Credit Cost

**Placeholder approach**: No actual API cost
**Future real API**: ~100-500 credits per image (TBD based on model)

Add to credit deduction logic:
```typescript
const IMAGE_GENERATION_COST = 400; // credits per image
await deductCreditsWithPriority(ctx, IMAGE_GENERATION_COST);
```
