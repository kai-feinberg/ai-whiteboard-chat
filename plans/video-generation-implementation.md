# Video Generation Implementation Plan

AI video generation using Kie AI's Sora 2 model with webhook-based async pattern (mirroring image generation).

---

## 1. Overview

### What We're Building
- AI tool in chat that generates videos from text prompts
- Video nodes on canvas with loading states and playback
- Webhook-based async processing (no polling)
- Same pattern as existing image generation

### Key API Details
- **Endpoint**: `https://api.kie.ai/api/v1/jobs/createTask`
- **Model**: `sora-2-text-to-video`
- **Callback Pattern**: Identical to image generation
- **Processing Time**: 30 seconds - 5+ minutes
- **Output**: MP4 video file

---

## 2. Database Schema Changes

### New Table: `video_nodes`

**File**: [convex/schema.ts](../convex/schema.ts)

Add after `image_nodes` table (around line 220):

```typescript
// Video Nodes - AI-generated videos
video_nodes: defineTable({
  organizationId: v.string(),
  prompt: v.string(), // Text prompt that generated the video
  videoStorageId: v.optional(v.string()), // Convex storage ID for video file
  isAiGenerated: v.boolean(), // true for AI-generated
  width: v.optional(v.number()), // Video width in pixels
  height: v.optional(v.number()), // Video height in pixels
  duration: v.optional(v.number()), // Video duration in seconds
  aspectRatio: v.optional(v.string()), // "landscape", "portrait", "square"
  nFrames: v.optional(v.string()), // "5", "10" - number of seconds
  kieTaskId: v.optional(v.string()), // Kie AI task ID for debugging/manual retries
  threadId: v.optional(v.id("threads")), // Thread that generated this video
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

### Update `canvas_nodes` Table

**File**: [convex/schema.ts](../convex/schema.ts) (around line 110)

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

Add `v.id("video_nodes")` to data union:

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

---

## 3. Backend Implementation

### Create `convex/canvas/videos.ts`

**New File**: Mirror structure of [convex/canvas/images.ts](../convex/canvas/images.ts)

```typescript
// convex/canvas/videos.ts
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Internal mutation to create video node (called from tool)
 */
export const createVideoNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    prompt: v.string(),
    organizationId: v.string(),
    aspectRatio: v.optional(v.string()), // "landscape", "portrait", "square"
    nFrames: v.optional(v.string()), // "5" or "10"
    threadId: v.optional(v.id("threads")),
    agentThreadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create video node data with pending status
    const videoNodeId = await ctx.db.insert("video_nodes", {
      organizationId: args.organizationId,
      prompt: args.prompt,
      isAiGenerated: true,
      aspectRatio: args.aspectRatio || "landscape",
      nFrames: args.nFrames || "10",
      status: "pending",
      ...(args.threadId && { threadId: args.threadId }),
      ...(args.agentThreadId && { agentThreadId: args.agentThreadId }),
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "video",
      position: args.position,
      width: 640, // Default video node width
      height: 400, // Default video node height
      data: { nodeId: videoNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, videoNodeId };
  },
});

/**
 * Internal query to get video node (for background processing)
 */
export const getVideoNodeInternal = internalQuery({
  args: {
    videoNodeId: v.id("video_nodes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.videoNodeId);
  },
});

/**
 * Internal mutation to update video node after generation
 */
export const updateVideoNodeInternal = internalMutation({
  args: {
    videoNodeId: v.id("video_nodes"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    videoStorageId: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
    kieTaskId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.videoNodeId, {
      status: args.status,
      ...(args.videoStorageId && { videoStorageId: args.videoStorageId }),
      ...(args.width && { width: args.width }),
      ...(args.height && { height: args.height }),
      ...(args.duration && { duration: args.duration }),
      ...(args.kieTaskId && { kieTaskId: args.kieTaskId }),
      ...(args.error && { error: args.error }),
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Background action to generate video and store it
 */
export const generateVideoAsync = internalAction({
  args: {
    videoNodeId: v.id("video_nodes"),
  },
  handler: async (ctx, args) => {
    console.log(`[Video] Starting generation for node: ${args.videoNodeId}`);

    // Get video node
    const node = await ctx.runQuery(internal.canvas.videos.getVideoNodeInternal, {
      videoNodeId: args.videoNodeId,
    });

    if (!node) {
      console.error(`[Video] Node not found: ${args.videoNodeId}`);
      throw new Error("Video node not found");
    }

    console.log(`[Video] Generating video for prompt: ${node.prompt}`);

    try {
      // Build callback URL with videoNodeId as query param
      const convexSiteUrl = process.env.CONVEX_SITE_URL;
      if (!convexSiteUrl) {
        throw new Error("CONVEX_SITE_URL environment variable is required for webhooks");
      }
      const callbackUrl = `${convexSiteUrl}/api/kie-video-callback?videoNodeId=${args.videoNodeId}`;

      console.log(`[Video] Calling Kie AI API with callback: ${callbackUrl}`);

      // Call Kie AI API
      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.KIE_AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "sora-2-text-to-video",
          callBackUrl: callbackUrl,
          input: {
            prompt: node.prompt,
            aspect_ratio: node.aspectRatio || "landscape",
            n_frames: node.nFrames || "10",
            remove_watermark: true,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Kie AI error: ${data.msg || response.statusText}`);
      }

      console.log(`[Video] Task created successfully: ${data.data?.taskId}`);

      // Update node with processing status and store taskId
      await ctx.runMutation(internal.canvas.videos.updateVideoNodeInternal, {
        videoNodeId: args.videoNodeId,
        status: "processing",
        kieTaskId: data.data?.taskId,
      });

      console.log(`[Video] Waiting for webhook callback for node: ${args.videoNodeId}`);

    } catch (error) {
      console.error(`[Video] Generation failed for node ${args.videoNodeId}:`, error);

      // Update node with failed status
      await ctx.runMutation(internal.canvas.videos.updateVideoNodeInternal, {
        videoNodeId: args.videoNodeId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  },
});

/**
 * Process Kie AI webhook callback - download video and store in Convex
 */
export const processKieVideoCallback = internalAction({
  args: {
    videoNodeId: v.id("video_nodes"),
    videoUrl: v.string(),
    status: v.literal("completed"),
  },
  handler: async (ctx, args) => {
    console.log(`[Video Callback] Processing webhook for node: ${args.videoNodeId}`);
    console.log(`[Video Callback] Downloading video from: ${args.videoUrl}`);

    try {
      // Download video from Kie AI URL
      const response = await fetch(args.videoUrl);

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log(`[Video Callback] Downloaded video blob (${blob.size} bytes)`);

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);
      console.log(`[Video Callback] Stored video with ID: ${storageId}`);

      // Update node with completed status
      // Default to 1920x1080 for landscape, adjust based on aspect ratio if needed
      await ctx.runMutation(internal.canvas.videos.updateVideoNodeInternal, {
        videoNodeId: args.videoNodeId,
        status: "completed",
        videoStorageId: storageId,
        width: 1920,
        height: 1080,
        duration: 10, // Default, could parse from response if available
      });

      console.log(`[Video Callback] Successfully completed video node: ${args.videoNodeId}`);

    } catch (error) {
      console.error(`[Video Callback] Failed to process callback for ${args.videoNodeId}:`, error);

      // Update node with failed status
      await ctx.runMutation(internal.canvas.videos.updateVideoNodeInternal, {
        videoNodeId: args.videoNodeId,
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to download and store video",
      });
    }
  },
});
```

---

## 4. HTTP Webhook Route

### Update `convex/http.ts`

**File**: [convex/http.ts](../convex/http.ts)

Add after the image callback route (around line 78):

```typescript
// Kie AI webhook callback for video generation
http.route({
  path: "/api/kie-video-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Extract videoNodeId from URL query params
      const url = new URL(request.url);
      const videoNodeId = url.searchParams.get("videoNodeId");

      if (!videoNodeId) {
        console.error("[Kie Video Webhook] Missing videoNodeId in query params");
        return new Response("Missing videoNodeId parameter", { status: 400 });
      }

      // Parse Kie AI callback body
      const body = await request.json();
      console.log(`[Kie Video Webhook] Received callback for video ${videoNodeId}:`, {
        code: body.code,
        state: body.data?.state,
        taskId: body.data?.taskId,
      });

      // Handle success case
      if (body.code === 200 && body.data?.state === "success") {
        const resultJson = JSON.parse(body.data.resultJson);
        const videoUrl = resultJson.resultUrls?.[0];

        if (!videoUrl) {
          console.error("[Kie Video Webhook] No video URL in success response");
          return new Response("Missing video URL in response", { status: 400 });
        }

        console.log(`[Kie Video Webhook] Processing success for ${videoNodeId}, downloading from ${videoUrl}`);

        // Trigger internal action to download and store video
        await ctx.runAction(internal.canvas.videos.processKieVideoCallback, {
          videoNodeId: videoNodeId as any,
          videoUrl,
          status: "completed",
        });

        return new Response("Success", { status: 200 });
      }

      // Handle failure case
      if (body.code === 501 || body.data?.state === "fail") {
        const errorMsg = body.data?.failMsg || body.msg || "Generation failed";
        console.error(`[Kie Video Webhook] Task failed for ${videoNodeId}: ${errorMsg}`);

        await ctx.runMutation(internal.canvas.videos.updateVideoNodeInternal, {
          videoNodeId: videoNodeId as any,
          status: "failed",
          error: errorMsg,
        });

        return new Response("Failure recorded", { status: 200 });
      }

      // Unknown state
      console.warn(`[Kie Video Webhook] Unknown state for ${videoNodeId}:`, body);
      return new Response("Unknown state", { status: 400 });

    } catch (error) {
      console.error("[Kie Video Webhook] Error processing webhook:", error);
      return new Response(
        `Webhook processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
        { status: 500 }
      );
    }
  }),
});
```

---

## 5. AI Tool Integration

### Update `convex/canvas/chat.ts`

**File**: [convex/canvas/chat.ts](../convex/canvas/chat.ts)

Add after `generateImageTool` (around line 72):

```typescript
/**
 * Tool for AI to generate videos on the canvas
 */
const generateVideoTool = createTool({
  description: "Generate an AI video based on a text prompt and place it on the canvas. Use this when the user asks you to create, generate, or make a video or animation.",
  args: z.object({
    prompt: z.string().describe("Detailed description of the video to generate. Describe motion, camera movement, scene transitions, and visual style. Be specific about what happens in the video."),
    aspectRatio: z.enum(["landscape", "portrait", "square"]).optional().describe("Video aspect ratio. Default: landscape (16:9)"),
    nFrames: z.enum(["5", "10"]).optional().describe("Video duration: '5' for 5 seconds, '10' for 10 seconds. Default: 10"),
  }),
  handler: async (ctx, args) => {
    // Access context passed from the agent
    const canvasId = (ctx as any).canvasId as Id<"canvases">;
    const organizationId = (ctx as any).organizationId as string;
    const canvasNodeId = (ctx as any).canvasNodeId as Id<"canvas_nodes">;
    const threadId = (ctx as any).threadId as Id<"threads">;
    const agentThreadId = (ctx as any).agentThreadId as string;

    if (!canvasId || !organizationId) {
      throw new Error("Missing required context for video generation");
    }

    console.log(`[Video Tool] Generating video with prompt: ${args.prompt}`);
    console.log(`[Video Tool] Canvas: ${canvasId}, Organization: ${organizationId}`);

    // Calculate position: offset from the chat node
    let position = { x: 100, y: 100 };

    try {
      // Try to get the chat node position to place video near it
      const chatNode = await ctx.runQuery(internal.canvas.chat.getCanvasNodeInternal, {
        canvasNodeId,
        organizationId,
      });

      if (chatNode) {
        // Place video to the right of the chat node
        position = {
          x: chatNode.position.x + chatNode.width + 100,
          y: chatNode.position.y,
        };
      }
    } catch (error) {
      console.warn("[Video Tool] Could not get chat node position, using default", error);
    }

    // Create video node via internal mutation
    const result = await ctx.runMutation(internal.canvas.videos.createVideoNodeInternal, {
      canvasId,
      position,
      prompt: args.prompt,
      aspectRatio: args.aspectRatio || "landscape",
      nFrames: args.nFrames || "10",
      organizationId,
      threadId,
      agentThreadId,
    });

    // Schedule background video generation
    await ctx.scheduler.runAfter(0, internal.canvas.videos.generateVideoAsync, {
      videoNodeId: result.videoNodeId,
    });

    console.log(`[Video Tool] Created video node: ${result.videoNodeId}`);

    const duration = args.nFrames === "5" ? "5 seconds" : "10 seconds";
    return `I've started generating a ${duration} video. This may take 1-5 minutes depending on complexity. It will appear on the canvas with a loading indicator while it's being created.`;
  },
});
```

Add to agent tools (around line 94):

```typescript
tools: {
  generateImage: generateImageTool,
  generateVideo: generateVideoTool, // ADD THIS
},
```

---

## 6. Query Function

### Update `convex/canvas/functions.ts`

**File**: [convex/canvas/functions.ts](../convex/canvas/functions.ts)

Add after `getImageNode` function:

```typescript
/**
 * Get video node with URL for display
 */
export const getVideoNode = query({
  args: {
    videoNodeId: v.id("video_nodes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const videoNode = await ctx.db.get(args.videoNodeId);
    if (!videoNode) {
      return null;
    }

    // Verify ownership
    if (videoNode.organizationId !== organizationId) {
      throw new Error("Unauthorized");
    }

    // Get video URL from storage if completed
    let videoUrl: string | null = null;
    if (videoNode.status === "completed" && videoNode.videoStorageId) {
      videoUrl = await ctx.storage.getUrl(videoNode.videoStorageId);
    }

    return {
      ...videoNode,
      videoUrl,
    };
  },
});
```

---

## 7. UI Component

### Create `src/features/canvas/components/VideoNode.tsx`

**New File**: Mirror structure of [ImageNode.tsx](../src/features/canvas/components/ImageNode.tsx)

```typescript
// src/features/canvas/components/VideoNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Film, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";
import { TranscriptDialog } from "@/components/TranscriptDialog";

interface VideoNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  videoNodeId: Id<"video_nodes">;
}

export function VideoNode({ data }: NodeProps<VideoNodeData>) {
  // Query video node data
  const videoNode = useQuery(
    api.canvas.functions.getVideoNode,
    data.videoNodeId ? { videoNodeId: data.videoNodeId } : "skip"
  );

  if (!videoNode) {
    return (
      <Node handles={{ target: false, source: false }}>
        <NodeHeader variant="default">
          <NodeTitle className="flex items-center gap-2 text-sm">
            <Film className="h-4 w-4" />
            AI Video
          </NodeTitle>
        </NodeHeader>
        <NodeContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </NodeContent>
      </Node>
    );
  }

  return (
    <Node handles={{ target: false, source: false }}>
      <NodeHeader variant="default" className="bg-gradient-to-br from-blue-50 to-indigo-100/70 text-indigo-900 border-indigo-200/60">
        <NodeTitle className="flex items-center gap-2 text-sm">
          <Film className="h-4 w-4" />
          {videoNode.isAiGenerated ? "AI Generated Video" : "Video"}
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <div className="space-y-3">
          {/* Status Display */}
          {videoNode.status === "pending" && (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-sm text-muted-foreground">Preparing video generation...</span>
            </div>
          )}

          {videoNode.status === "processing" && (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-sm text-muted-foreground">Generating video...</span>
              <span className="text-xs text-muted-foreground">This may take 1-5 minutes</span>
            </div>
          )}

          {videoNode.status === "failed" && (
            <div className="flex flex-col items-center gap-2 p-8 text-destructive">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm text-center">{videoNode.error || "Failed to generate video"}</span>
            </div>
          )}

          {videoNode.status === "completed" && videoNode.videoUrl && (
            <div className="space-y-2">
              {/* Generated Video */}
              <div className="relative w-full overflow-hidden rounded">
                <video
                  src={videoNode.videoUrl}
                  controls
                  className="w-full h-auto"
                  style={{ maxHeight: "400px", objectFit: "contain" }}
                  preload="metadata"
                />
              </div>

              {/* Prompt Preview & Dialog */}
              <TranscriptDialog
                transcript={videoNode.prompt}
                title="Video Generation Prompt"
                triggerText="View Prompt"
                triggerClassName="w-full"
              />
            </div>
          )}

          {videoNode.status === "completed" && !videoNode.videoUrl && (
            <div className="flex items-center justify-center p-8">
              <span className="text-sm text-muted-foreground">Video not available</span>
            </div>
          )}
        </div>
      </NodeContent>
    </Node>
  );
}
```

---

## 8. Canvas Integration

### Update `src/routes/canvas/$canvasId.tsx`

**File**: [src/routes/canvas/$canvasId.tsx](../src/routes/canvas/$canvasId.tsx)

Import VideoNode (add to imports around line 20):

```typescript
import { VideoNode } from "@/features/canvas/components/VideoNode";
```

Add to nodeTypes (around line 70):

```typescript
const nodeTypes = {
  text: TextNode,
  chat: ChatNode,
  youtube: YouTubeNode,
  website: WebsiteNode,
  tiktok: TikTokNode,
  twitter: TwitterNode,
  facebook_ad: FacebookAdNode,
  group: GroupNode,
  image: ImageNode,
  video: VideoNode, // ADD THIS
};
```

---

## 9. Context Gathering

### Update `convex/canvas/chat.ts`

**File**: [convex/canvas/chat.ts](../convex/canvas/chat.ts)

Add video case to `getNodeContextInternal` function (around line 200+):

```typescript
} else if (sourceNode.nodeType === "video") {
  const videoNode = await ctx.db.get(sourceNode.data.nodeId as Id<"video_nodes">);
  if (videoNode && videoNode.status === "completed") {
    contextMessages.push({
      role: "system",
      content: `AI Generated Video\nPrompt: ${videoNode.prompt}\nDuration: ${videoNode.duration || videoNode.nFrames}s\nAspect Ratio: ${videoNode.aspectRatio}`,
    });
  }
}
```

---

## 10. Implementation Checklist

### Phase 1: Schema & Database ✓
- [ ] Add `video_nodes` table to schema.ts
- [ ] Update `canvas_nodes` nodeType union with "video"
- [ ] Update `canvas_nodes` data union with `video_nodes` ID
- [ ] Run `pnpm dev` to apply schema changes and typecheck

### Phase 2: Backend Functions ✓
- [ ] Create `convex/canvas/videos.ts`
- [ ] Implement `createVideoNodeInternal` mutation
- [ ] Implement `getVideoNodeInternal` query
- [ ] Implement `updateVideoNodeInternal` mutation
- [ ] Implement `generateVideoAsync` action
- [ ] Implement `processKieVideoCallback` action

### Phase 3: HTTP Webhook ✓
- [ ] Add `/api/kie-video-callback` route to `convex/http.ts`
- [ ] Handle success case (download video)
- [ ] Handle failure case (mark as failed)

### Phase 4: AI Tool ✓
- [ ] Create `generateVideoTool` in `convex/canvas/chat.ts`
- [ ] Add tool to agent configuration
- [ ] Test tool parameters (prompt, aspectRatio, nFrames)

### Phase 5: Query Function ✓
- [ ] Add `getVideoNode` query to `convex/canvas/functions.ts`
- [ ] Include auth checks and ownership verification
- [ ] Return video URL from storage

### Phase 6: UI Component ✓
- [ ] Create `VideoNode.tsx` component
- [ ] Implement status-based rendering (pending/processing/completed/failed)
- [ ] Add HTML5 video player with controls
- [ ] Add prompt preview dialog

### Phase 7: Canvas Integration ✓
- [ ] Import VideoNode in canvas route
- [ ] Add to nodeTypes mapping
- [ ] Test video nodes appear on canvas

### Phase 8: Context Gathering ✓
- [ ] Add video case to `getNodeContextInternal`
- [ ] Include prompt and metadata in context
- [ ] Test AI can reference video nodes in conversations

### Phase 9: Testing ✓
- [ ] Test video generation from chat ("create a video of...")
- [ ] Verify webhook callback works (check logs)
- [ ] Test video playback in UI
- [ ] Test different aspect ratios (landscape/portrait/square)
- [ ] Test different durations (5s/10s)
- [ ] Test error handling (invalid API key, failed generation)
- [ ] Test context gathering with video nodes
- [ ] Monitor Convex storage usage

---

## 11. API Reference

### Kie AI Video Generation API

**Endpoint**: `POST https://api.kie.ai/api/v1/jobs/createTask`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_KEY"
}
```

**Request Body**:
```json
{
  "model": "sora-2-text-to-video",
  "callBackUrl": "https://your-convex-site.convex.site/api/kie-video-callback?videoNodeId=k123",
  "input": {
    "prompt": "Your detailed video description here",
    "aspect_ratio": "landscape",  // "landscape" | "portrait" | "square"
    "n_frames": "10",              // "5" | "10" (seconds)
    "remove_watermark": true
  }
}
```

**Success Response** (200):
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "task_abc123"
  }
}
```

**Webhook Callback** (sent by Kie AI when complete):
```json
{
  "code": 200,
  "data": {
    "taskId": "task_abc123",
    "state": "success",
    "resultJson": "{\"resultUrls\": [\"https://kie-cdn.com/video.mp4\"]}",
    "consumeCredits": 100,
    "costTime": 45000
  }
}
```

---

## 12. Cost & Performance

### Video Generation Costs
- **Estimated Cost**: $0.50 - $2.00 per video (depending on duration/quality)
- **Comparison to Images**: 10-100x more expensive than image generation
- **Credit Deduction**: Deduct AFTER successful generation (in webhook callback)

### Processing Times
- **5 second video**: ~30-90 seconds
- **10 second video**: ~60-180 seconds
- **Complex prompts**: May take up to 5 minutes

### Storage Considerations
- **File Size**: 10-100 MB per video
- **Convex Free Tier**: 1 GB total storage
- **Recommendation**: Monitor storage usage, implement cleanup for failed generations

### Performance Tips
- Default to 5-second videos for faster generation
- Use "landscape" for most use cases (fastest)
- Show clear loading states (users expect longer waits)
- Consider adding progress indicators if API supports

---

## 13. Differences from Image Generation

| Aspect | Images | Videos |
|--------|--------|--------|
| **Model** | `google/nano-banana` | `sora-2-text-to-video` |
| **Input** | `{ prompt, output_format, image_size }` | `{ prompt, aspect_ratio, n_frames, remove_watermark }` |
| **Processing** | 5-30 seconds | 30 seconds - 5 minutes |
| **File Size** | 1-5 MB | 10-100+ MB |
| **Cost** | $0.01-0.05 | $0.50-2.00+ |
| **Webhook** | `/api/kie-callback` | `/api/kie-video-callback` |
| **Table** | `image_nodes` | `video_nodes` |
| **Component** | `ImageNode.tsx` | `VideoNode.tsx` |
| **Display** | `<img>` tag | `<video>` with controls |
| **Icon** | Sparkles | Film |
| **Color** | Purple gradient | Blue/Indigo gradient |

---

## 14. Troubleshooting

### Video Not Generating
1. Check `KIE_AI_API_KEY` is set in environment variables
2. Check `CONVEX_SITE_URL` is set correctly
3. Check Convex logs for error messages
4. Verify webhook URL is publicly accessible (use ngrok for local dev)

### Webhook Not Firing
1. Check Kie AI task status manually (if taskId stored)
2. Verify CONVEX_SITE_URL matches Convex deployment
3. Check HTTP endpoint is deployed (run `pnpm dev`)
4. Look for errors in Convex dashboard logs

### Video Not Playing
1. Check video URL is valid (not null)
2. Verify video was downloaded successfully (check storage)
3. Check browser console for CORS errors
4. Test video URL directly in browser

### Storage Issues
1. Monitor Convex storage usage in dashboard
2. Implement cleanup for failed generations
3. Consider video compression (future enhancement)
4. Upgrade Convex plan if hitting storage limits

---

## 15. Future Enhancements

- **Progress Tracking**: Show generation progress (if API supports)
- **Thumbnail Preview**: Extract first frame for preview before completion
- **Model Selection**: Allow choosing different video models (quality vs speed)
- **Duration Picker**: UI control for selecting video length
- **Aspect Ratio Selector**: Visual picker for landscape/portrait/square
- **Video Trimming**: Allow users to trim generated videos
- **Batch Generation**: Generate multiple video variations
- **Video-to-Video**: Use reference video as input (if supported)
- **Custom Resolution**: Support specific width/height
- **Cost Estimation**: Show estimated cost before generation
