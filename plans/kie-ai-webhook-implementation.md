# Kie AI Webhook Image Generation Implementation

Switch from polling to webhook callbacks for AI image generation using Kie AI Nano Banana API.

---

## 1. Database Design

### Schema Changes (image_nodes table)
**Add field:**
- `kieTaskId: v.optional(v.string())` - Store Kie AI task ID for debugging/manual retries

**No new tables needed** - Query param approach eliminates need for mapping table

---

## 2. Data Flow

### High-Level Flow
1. **AI tool triggered** → `generateImageTool` in chat.ts calls `generateImageAsync`
2. **Create task with callback** → POST to Kie AI API with `callBackUrl: https://site.com/api/kie-callback?imageNodeId=k123`
3. **Store taskId** → Update image_nodes with `kieTaskId` and `status: "processing"`
4. **Kie AI processes** → 5-30 seconds later, Kie POSTs result to callback URL
5. **Webhook receives** → Extract `imageNodeId` from query param, download image, store in Convex, update node to `completed`

### Key Transformations
- **Tool context** → `imageNodeId` embedded in callback URL query param
- **Kie AI result URL** → Fetch blob → Convex storage ID
- **Status transitions:** `pending` → `processing` (after task created) → `completed`/`failed` (after webhook)
- **Real-time sync:** Convex subscriptions auto-update UI when webhook mutates node

---

## 3. User Flows

### End User Flow
1. User in chat: "Create an image of a sunset over mountains"
2. AI responds + calls `generateImage` tool
3. Image node appears instantly with loading spinner (`status: "pending"`)
4. 5-30 seconds later, webhook fires → node updates to completed with image
5. User sees final image replace loading state (real-time)

### Admin/Debug Flow
1. Check image_nodes table for `kieTaskId` field
2. Query Kie AI API manually with taskId if webhook fails
3. Retry generation by re-triggering webhook or manual mutation

---

## 4. UI Components

**No UI changes needed** - Existing `ImageNode.tsx` already handles status-based rendering (loading/completed/failed)

---

## 5. Backend Implementation

### New HTTP Endpoint: `/api/kie-callback`

**File:** `convex/http.ts`

**Route:** `POST /api/kie-callback?imageNodeId=k123`

**Purpose:** Receive webhook from Kie AI when image generation completes

**Input (Kie AI POST body):**
```typescript
{
  code: 200 | 501,
  data: {
    taskId: string,
    state: "success" | "fail",
    resultJson: string, // Contains { resultUrls: [url] }
    failMsg?: string,
    consumeCredits: number,
    costTime: number,
  }
}
```

**Output:** `200 OK` (acknowledges webhook)

**Logic:**
1. Extract `imageNodeId` from URL query params
2. Parse webhook body
3. If `state: "success"` → trigger `processKieCallback` action (download image)
4. If `state: "fail"` → update node with `status: "failed"` + error message
5. Return 200 to Kie AI

---

### Updated Action: `generateImageAsync`

**File:** `convex/canvas/images.ts`

**Changes:**
1. Build callback URL: `${CONVEX_SITE_URL}/api/kie-callback?imageNodeId=${imageNodeId}`
   - **Note**: Uses `CONVEX_SITE_URL` (not `SITE_URL`) - Convex's public HTTP endpoint
2. Replace placeholder fetch with real Kie AI API call:
   - Endpoint: `https://api.kie.ai/api/v1/jobs/createTask`
   - Headers: `Authorization: Bearer ${KIE_AI_API_KEY}`
   - Body: `{ callBackUrl, model: "google/nano-banana", input: { prompt, output_format, image_size } }`
3. Store `kieTaskId` from response in image_nodes
4. Remove old polling/placeholder logic

**Input:** `imageNodeId`

**Output:** Task created, webhook handles completion

---

### New Action: `processKieCallback`

**File:** `convex/canvas/images.ts`

**Purpose:** Download image from Kie AI URL and store in Convex

**Input:**
- `imageNodeId: Id<"image_nodes">`
- `imageUrl: string` (from Kie AI resultUrls)

**Logic:**
1. Fetch image blob from Kie URL
2. Store in Convex storage → get `storageId`
3. Update image_nodes: `status: "completed"`, `imageStorageId`, `width: 1024`, `height: 1024`

---

### Schema Update: `image_nodes`

**File:** `convex/schema.ts:202-218`

**Add field:**
```typescript
kieTaskId: v.optional(v.string()), // Kie AI task ID for debugging
```

**Purpose:** Debug webhook failures, manual task queries, audit trail

---

## 6. Environment Variables

**File:** `.env.example`

**Add (after Scrape Creators section):**
```bash
# -----------------------------------------------------------------------------
# KIE AI (Image Generation)
# -----------------------------------------------------------------------------
# Get from: https://kie.ai/
# Used for AI image generation via Nano Banana API

KIE_AI_API_KEY=your_kie_ai_api_key_here
```

**Also ensure:** `SITE_URL` is set to publicly accessible domain (not localhost for production)

---

## 7. Patterns to Reuse

### Webhook Pattern (from Stripe/payment systems)
- HTTP endpoint extracts context from URL query params
- Validates webhook payload
- Triggers internal action for heavy lifting (file downloads)
- Returns 200 immediately to acknowledge receipt

### Async Node Creation (from YouTube/Website nodes)
- Action creates node with `status: "pending"`
- External API call updates to `status: "processing"`
- Webhook/callback updates to `status: "completed"` with data
- Real-time Convex subscriptions push updates to UI

### File Storage (from Website screenshots)
- `fetch(url) → blob → ctx.storage.store(blob) → storageId`
- Store `storageId` in database
- UI queries `ctx.storage.getUrl(storageId)` for display URL

### Tool Context Passing (from existing generateImageTool)
- Tool handler accesses `(ctx as any).canvasId` and `organizationId`
- Passes to internal mutations/actions for scoped operations

---

## 8. Implementation Checklist

### Phase 1: Schema & Env
- [ ] Add `kieTaskId` field to `image_nodes` table in schema.ts
- [ ] Add `KIE_AI_API_KEY` to .env.example
- [ ] Run `npx convex dev` to apply schema changes

### Phase 2: HTTP Webhook Endpoint
- [ ] Create webhook route in convex/http.ts
- [ ] Extract `imageNodeId` from query params
- [ ] Parse Kie AI callback body (success/fail cases)
- [ ] Trigger `processKieCallback` on success
- [ ] Update node to failed on error

### Phase 3: Update Image Generation Action
- [ ] Replace placeholder logic in `generateImageAsync`
- [ ] Build callback URL with `imageNodeId` query param
- [ ] POST to Kie AI API with callback URL
- [ ] Store `kieTaskId` in image_nodes
- [ ] Handle API errors gracefully

### Phase 4: Create Callback Processor
- [ ] Create `processKieCallback` internal action
- [ ] Download image from Kie AI URL
- [ ] Store blob in Convex storage
- [ ] Update node with storageId + completed status

### Phase 5: Testing
- [ ] Test with real Kie AI API key
- [ ] Verify callback URL is publicly accessible (use ngrok for local dev)
- [ ] Test success path (image generates correctly)
- [ ] Test failure path (invalid prompt, API error)
- [ ] Verify real-time UI updates work
- [ ] Check `kieTaskId` stored for debugging

---

## 9. Security Considerations

**Webhook Validation:**
- Validate `imageNodeId` exists before processing
- Check organization ownership (node belongs to valid org)
- Consider adding HMAC signature validation if Kie AI supports it (future enhancement)

**Rate Limiting:**
- Convex HTTP routes auto-handle rate limiting
- No additional config needed

**API Key Security:**
- Store `KIE_AI_API_KEY` in environment variables only
- Never commit to git or expose in client code

---

## 10. Cost Savings

**Old approach (polling):**
- 1 create task + ~15 status checks = **16 API calls**

**New approach (webhook):**
- 1 create task + 1 webhook (free) = **1 API call**

**Savings:** ~94% reduction in API calls, instant completion notification

---

## 11. Local Development Setup

**For webhook testing with localhost:**
1. Install ngrok: `brew install ngrok` (or download)
2. Run ngrok: `ngrok http 3000`
3. Copy ngrok URL: `https://abc123.ngrok.io`
4. Set in `.env.local`: `SITE_URL=https://abc123.ngrok.io`
5. Restart dev server

**For production:**
- Set `SITE_URL` to actual domain (e.g., `https://app.yoursite.com`)

---

## 12. Error Handling

**Webhook failures:**
- Kie AI retries webhooks 3 times with exponential backoff
- If all retries fail, check `kieTaskId` in database and manually query Kie AI API

**Network errors:**
- Image download failures logged in node.error field
- Status remains "processing" if webhook never fires (manual intervention needed)

**API errors:**
- Invalid prompts, rate limits → caught in `generateImageAsync`, node marked failed immediately

---

## 13. Future Enhancements (Out of Scope)

- HMAC signature validation for webhooks
- Webhook retry logic (Convex-side)
- Manual "retry generation" button in UI
- Support for different Kie AI models (beyond google/nano-banana)
- Batch image generation (multiple images from one prompt)

---

# VIDEO GENERATION IMPLEMENTATION

Following the same webhook-based async pattern as image generation, extended for video.

---

## 1. Key Differences from Image Generation

### Processing Time
- **Images**: 5-30 seconds
- **Videos**: 30 seconds - 5+ minutes (significantly longer)

### File Size
- **Images**: 1-5 MB
- **Videos**: 10-100+ MB (requires careful storage management)

### API Models
- **Images**: `google/nano-banana`
- **Videos**: `runwayml/gen-3-alpha-turbo`, `kling/v1.5-pro`, etc.

### Input Parameters
- **Images**: `{ prompt, output_format, image_size }`
- **Videos**: `{ prompt, duration, aspect_ratio }`

### Output Format
- **Images**: PNG/JPG
- **Videos**: MP4

---

## 2. Database Schema

### New Table: `video_nodes`

**File:** `convex/schema.ts`

```typescript
video_nodes: defineTable({
  organizationId: v.string(),
  prompt: v.string(), // Text prompt that generated the video
  videoStorageId: v.optional(v.string()), // Convex storage ID for video file
  thumbnailStorageId: v.optional(v.string()), // Thumbnail image
  isAiGenerated: v.boolean(), // true for AI-generated
  width: v.optional(v.number()), // Video width in pixels
  height: v.optional(v.number()), // Video height in pixels
  duration: v.optional(v.number()), // Video duration in seconds
  aspectRatio: v.optional(v.string()), // e.g., "16:9", "9:16", "1:1"
  kieTaskId: v.optional(v.string()), // Kie AI task ID for debugging
  threadId: v.optional(v.id("threads")), // Thread ID if generated from chat
  agentThreadId: v.optional(v.string()), // Agent thread ID for message saving
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  error: v.optional(v.string()), // Error message if failed
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_organization", ["organizationId"]),
```

---

## 3. Backend Implementation

### New File: `convex/canvas/videos.ts`

Mirror structure of `convex/canvas/images.ts` with these functions:

#### `createVideoNodeInternal` (Internal Mutation)
```typescript
- Args: canvasId, position, prompt, organizationId, threadId?, agentThreadId?
- Creates video_nodes record with status: "pending"
- Creates canvas_nodes reference with nodeType: "video"
- Returns: { canvasNodeId, videoNodeId }
```

#### `getVideoNodeInternal` (Internal Query)
```typescript
- Args: videoNodeId
- Returns video node data (for background processing)
```

#### `updateVideoNodeInternal` (Internal Mutation)
```typescript
- Args: videoNodeId, status, videoStorageId?, width?, height?, duration?, kieTaskId?, error?
- Updates video node with new data
- Returns: { success: true }
```

#### `generateVideoAsync` (Internal Action)
```typescript
- Args: videoNodeId
- Calls Kie AI API: POST /api/v1/jobs/createTask
  - model: "runwayml/gen-3-alpha-turbo" (or configurable)
  - callBackUrl: ${CONVEX_SITE_URL}/api/kie-video-callback?videoNodeId=${videoNodeId}
  - input: { prompt, duration: 5, aspect_ratio: "16:9" }
- Stores kieTaskId in video_nodes
- Sets status: "processing"
```

#### `processKieVideoCallback` (Internal Action)
```typescript
- Args: videoNodeId, videoUrl, status: "completed"
- Downloads video from Kie AI URL
- Stores in Convex storage
- Generates thumbnail (optional - extract first frame)
- Updates video node with storageId, dimensions, status
- If agentThreadId exists: saves video message to thread
```

---

## 4. HTTP Webhook Endpoint

### New Route: `/api/kie-video-callback`

**File:** `convex/http.ts`

```typescript
http.route({
  path: "/api/kie-video-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Extract videoNodeId from query params
    const url = new URL(request.url);
    const videoNodeId = url.searchParams.get("videoNodeId");

    // Parse Kie AI callback body
    const body = await request.json();

    // Success case: trigger download action
    if (body.code === 200 && body.data?.state === "success") {
      const resultJson = JSON.parse(body.data.resultJson);
      const videoUrl = resultJson.resultUrls?.[0];

      await ctx.runAction(internal.canvas.videos.processKieVideoCallback, {
        videoNodeId: videoNodeId as any,
        videoUrl,
        status: "completed",
      });

      return new Response("Success", { status: 200 });
    }

    // Failure case: update node
    if (body.code === 501 || body.data?.state === "fail") {
      await ctx.runMutation(internal.canvas.videos.updateVideoNodeInternal, {
        videoNodeId: videoNodeId as any,
        status: "failed",
        error: body.data?.failMsg || body.msg || "Generation failed",
      });

      return new Response("Failure recorded", { status: 200 });
    }
  }),
});
```

---

## 5. AI Tool Integration

### New Tool: `generateVideoTool`

**File:** `convex/canvas/chat.ts`

```typescript
const generateVideoTool = createTool({
  description: "Generate an AI video based on a text prompt and place it on the canvas. Use this when the user asks you to create, generate, or make a video.",
  args: z.object({
    prompt: z.string().describe("Detailed description of the video to generate. Describe motion, scene, camera angles, and visual style."),
    duration: z.number().optional().describe("Video duration in seconds (3, 5, or 10). Default: 5"),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().describe("Video aspect ratio. Default: 16:9"),
  }),
  handler: async (ctx, args) => {
    const canvasId = (ctx as any).canvasId;
    const organizationId = (ctx as any).organizationId;
    const canvasNodeId = (ctx as any).canvasNodeId;
    const threadId = (ctx as any).threadId;
    const agentThreadId = (ctx as any).agentThreadId;

    // Calculate position near chat node
    let position = { x: 100, y: 100 };
    try {
      const chatNode = await ctx.runQuery(internal.canvas.chat.getCanvasNodeInternal, {
        canvasNodeId,
        organizationId,
      });
      if (chatNode) {
        position = {
          x: chatNode.position.x + chatNode.width + 100,
          y: chatNode.position.y,
        };
      }
    } catch (error) {
      console.warn("[Video Tool] Could not get chat node position", error);
    }

    // Create video node
    const result = await ctx.runMutation(internal.canvas.videos.createVideoNodeInternal, {
      canvasId,
      position,
      prompt: args.prompt,
      duration: args.duration || 5,
      aspectRatio: args.aspectRatio || "16:9",
      organizationId,
      threadId,
      agentThreadId,
    });

    // Schedule background generation
    await ctx.scheduler.runAfter(0, internal.canvas.videos.generateVideoAsync, {
      videoNodeId: result.videoNodeId,
    });

    return `I've started generating the video. This may take 1-5 minutes. The video will appear on the canvas with a loading indicator.`;
  },
});
```

**Add to agent tools:**
```typescript
tools: {
  generateImage: generateImageTool,
  generateVideo: generateVideoTool, // ADD THIS
},
```

---

## 6. UI Component

### New File: `src/features/canvas/components/VideoNode.tsx`

```typescript
export function VideoNode({ data }: NodeProps<VideoNodeData>) {
  const videoNode = useQuery(
    api.canvas.functions.getVideoNode,
    data.videoNodeId ? { videoNodeId: data.videoNodeId } : "skip"
  );

  if (!videoNode) {
    return <LoadingState />;
  }

  return (
    <Node handles={{ target: false, source: false }}>
      <NodeHeader variant="default" className="bg-gradient-to-br from-blue-50 to-indigo-100/70">
        <NodeTitle className="flex items-center gap-2 text-sm">
          <Film className="h-4 w-4" />
          {videoNode.isAiGenerated ? "AI Generated Video" : "Video"}
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        {videoNode.status === "pending" && <PendingState />}
        {videoNode.status === "processing" && <ProcessingState />}
        {videoNode.status === "failed" && <FailedState error={videoNode.error} />}
        {videoNode.status === "completed" && videoNode.videoUrl && (
          <div className="space-y-2">
            <video
              src={videoNode.videoUrl}
              controls
              className="w-full rounded"
              style={{ maxHeight: "400px" }}
            />
            <TranscriptDialog
              transcript={videoNode.prompt}
              title="Video Generation Prompt"
              triggerText="View Prompt"
            />
          </div>
        )}
      </NodeContent>
    </Node>
  );
}
```

---

## 7. Context Gathering

### Update `getNodeContextInternal`

**File:** `convex/canvas/chat.ts`

Add video case to context gathering:

```typescript
} else if (sourceNode.nodeType === "video") {
  const videoNode = await ctx.db.get(sourceNode.data.nodeId as Id<"video_nodes">);
  if (videoNode && videoNode.status === "completed") {
    contextMessages.push({
      role: "system",
      content: `AI Generated Video\nPrompt: ${videoNode.prompt}\nDuration: ${videoNode.duration}s\nAspect Ratio: ${videoNode.aspectRatio}`,
    });
  }
}
```

---

## 8. Canvas Integration

### Update `canvas_nodes` schema

**File:** `convex/schema.ts`

Add `"video"` to nodeType union:

```typescript
nodeType: v.union(
  v.literal("text"),
  v.literal("chat"),
  v.literal("youtube"),
  v.literal("website"),
  v.literal("tiktok"),
  v.literal("twitter"),
  v.literal("facebook_ad"),
  v.literal("group"),
  v.literal("image"),
  v.literal("video") // ADD THIS
),
```

Update data union to include `video_nodes`:

```typescript
data: v.object({
  nodeId: v.union(
    v.id("text_nodes"),
    v.id("chat_nodes"),
    v.id("youtube_nodes"),
    v.id("website_nodes"),
    v.id("tiktok_nodes"),
    v.id("twitter_nodes"),
    v.id("facebook_ads_nodes"),
    v.id("group_nodes"),
    v.id("image_nodes"),
    v.id("video_nodes") // ADD THIS
  ),
}),
```

### Add query function

**File:** `convex/canvas/functions.ts`

```typescript
export const getVideoNode = query({
  args: { videoNodeId: v.id("video_nodes") },
  handler: async (ctx, args) => {
    // Auth check + ownership verification
    // Return video node with videoUrl from storage
  },
});
```

---

## 9. Model Configuration

### Recommended Video Models (Kie AI)

| Model | Quality | Speed | Cost | Use Case |
|-------|---------|-------|------|----------|
| `runwayml/gen-3-alpha-turbo` | High | Fast (30-60s) | Medium | General purpose |
| `kling/v1.5-pro` | Very High | Slow (2-5min) | High | Premium quality |
| `google/veo-2` | High | Medium | Medium | Realistic videos |

**Configuration approach:**
- Start with `runwayml/gen-3-alpha-turbo` (good balance)
- Allow model selection via tool parameter (future)
- Store model ID in video_nodes table for debugging

---

## 10. Cost & Performance Considerations

### Video vs Image Costs
- Video generation is **10-100x more expensive** than images
- Example: Image ($0.01-0.05), Video ($0.50-2.00+)

### Processing Time
- Videos take 30s - 5+ minutes
- Consider showing progress updates (if Kie AI supports progress webhooks)
- Add timeout handling (10 minute max)

### Storage Limits
- Convex free tier: 1 GB total storage
- Single video: 10-100 MB
- Monitor storage usage, implement cleanup for failed generations

### Credit Deduction
- Deduct credits AFTER successful generation (not at task creation)
- Include in `processKieVideoCallback` similar to image implementation
- Show estimated cost in UI before generation (future)

---

## 11. Implementation Checklist

### Phase 1: Schema & Database
- [ ] Add `video_nodes` table to schema
- [ ] Update `canvas_nodes` nodeType union with "video"
- [ ] Update `canvas_nodes` data union with `video_nodes` ID
- [ ] Run `npx convex dev` to apply schema changes

### Phase 2: Backend Functions
- [ ] Create `convex/canvas/videos.ts`
- [ ] Implement `createVideoNodeInternal` mutation
- [ ] Implement `generateVideoAsync` action
- [ ] Implement `processKieVideoCallback` action
- [ ] Implement `updateVideoNodeInternal` mutation
- [ ] Implement `getVideoNodeInternal` query

### Phase 3: HTTP Webhook
- [ ] Add `/api/kie-video-callback` route to `convex/http.ts`
- [ ] Parse video callback body
- [ ] Trigger download action on success
- [ ] Handle failure cases

### Phase 4: AI Tool
- [ ] Create `generateVideoTool` in `convex/canvas/chat.ts`
- [ ] Add tool to agent configuration
- [ ] Test tool invocation from chat

### Phase 5: UI Component
- [ ] Create `VideoNode.tsx` component
- [ ] Implement status-based rendering
- [ ] Add HTML5 video player
- [ ] Add prompt preview dialog
- [ ] Register in canvas route

### Phase 6: Context Integration
- [ ] Add video case to `getNodeContextInternal`
- [ ] Add `getVideoNode` query to `functions.ts`
- [ ] Test context gathering with video nodes

### Phase 7: Testing
- [ ] Test video generation from chat
- [ ] Verify webhook callback works
- [ ] Test video playback in UI
- [ ] Test context gathering
- [ ] Test error handling (invalid prompts, API failures)
- [ ] Monitor storage usage

---

## 12. Differences Summary

| Aspect | Images | Videos |
|--------|--------|--------|
| **API Model** | `google/nano-banana` | `runwayml/gen-3-alpha-turbo` |
| **Input Params** | `{ prompt, output_format, image_size }` | `{ prompt, duration, aspect_ratio }` |
| **Processing Time** | 5-30 seconds | 30 seconds - 5+ minutes |
| **File Size** | 1-5 MB | 10-100+ MB |
| **Output Format** | PNG/JPG | MP4 |
| **Cost** | $0.01-0.05 | $0.50-2.00+ |
| **Webhook Route** | `/api/kie-callback` | `/api/kie-video-callback` |
| **Storage Table** | `image_nodes` | `video_nodes` |
| **UI Component** | `ImageNode.tsx` | `VideoNode.tsx` |
| **Display** | `<img>` tag | `<video>` tag with controls |
| **Thumbnail** | Not needed | Optional (first frame) |

---

## 13. Future Video Enhancements

- **Progress tracking**: Show % completion during generation (if API supports)
- **Thumbnail generation**: Extract first frame as preview
- **Model selection**: Allow user to choose quality/speed tradeoff
- **Duration picker**: UI for selecting 3s/5s/10s duration
- **Aspect ratio selector**: 16:9 (landscape), 9:16 (portrait), 1:1 (square)
- **Video editing**: Trim, crop, add text overlays (out of scope)
- **Batch generation**: Multiple videos from prompt variations
- **Video-to-video**: Use existing video as reference (if model supports)
