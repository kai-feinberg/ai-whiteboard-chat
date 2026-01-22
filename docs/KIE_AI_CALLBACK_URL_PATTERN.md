# Kie.ai Callback URL Pattern Documentation

## Overview

AI Whiteboard Chat uses a **webhook-based callback URL pattern** to handle asynchronous asset generation from Kie.ai (images and videos). This pattern eliminates the need for polling, reduces API calls by ~94%, and provides instant completion notifications.

---

## Why Callbacks Instead of Polling?

### Old Approach (Polling)
- 1 create task API call
- ~15 status check API calls (every 2-5 seconds)
- **Total: 16 API calls** per generation
- Delayed notification (polling interval latency)

### New Approach (Webhooks)
- 1 create task API call with callback URL
- 1 webhook callback (free, no API call)
- **Total: 1 API call** per generation
- **Instant notification** when generation completes
- **94% reduction** in API calls

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         REQUEST FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. User asks AI: "Create an image of a sunset"
   │
   ├─> AI Agent calls generateImageTool
   │
   ├─> createImageNodeInternal mutation
   │   ├─ Creates image_nodes record (status: "pending")
   │   ├─ Creates canvas_nodes reference
   │   └─ Returns { canvasNodeId, imageNodeId }
   │
   ├─> generateImageAsync action (scheduled)
   │   ├─ Builds callback URL:
   │   │  https://app.convex.site/api/kie-callback?imageNodeId=k123
   │   │
   │   ├─ POSTs to Kie.ai API:
   │   │  {
   │   │    model: "google/nano-banana",
   │   │    callBackUrl: "https://app.convex.site/api/kie-callback?imageNodeId=k123",
   │   │    input: { prompt, output_format, image_size }
   │   │  }
   │   │
   │   ├─ Stores kieTaskId in image_nodes
   │   └─ Updates status: "processing"
   │
   └─> User sees loading state on canvas (real-time via Convex)


┌─────────────────────────────────────────────────────────────────┐
│                         CALLBACK FLOW                            │
└─────────────────────────────────────────────────────────────────┘

2. Kie.ai generates image (5-30 seconds later)
   │
   ├─> Kie.ai POSTs to callback URL:
   │   POST https://app.convex.site/api/kie-callback?imageNodeId=k123
   │   Body: {
   │     code: 200,
   │     data: {
   │       state: "success",
   │       taskId: "kie_task_xyz",
   │       resultJson: { resultUrls: ["https://kie.ai/result/abc.png"] }
   │     }
   │   }
   │
   ├─> Convex HTTP handler (/api/kie-callback)
   │   ├─ Extracts imageNodeId from query param
   │   ├─ Parses webhook body
   │   ├─ Validates success state
   │   └─ Triggers processKieCallback action
   │
   ├─> processKieCallback action
   │   ├─ Downloads image from Kie.ai URL
   │   ├─ Stores blob in Convex storage → storageId
   │   ├─ Updates image_nodes:
   │   │  - status: "completed"
   │   │  - imageStorageId: storageId
   │   │  - width: 1024, height: 1024
   │   │
   │   └─ (Optional) Adds image to agent chat thread
   │       if agentThreadId is present
   │
   └─> User sees completed image on canvas (real-time via Convex)
```

---

## Key Components

### 1. Database Schema

#### `image_nodes` Table
```typescript
image_nodes: defineTable({
  organizationId: v.string(),
  prompt: v.string(),                      // User's text prompt
  imageStorageId: v.optional(v.string()),  // Convex storage ID
  isAiGenerated: v.boolean(),              // true for AI-generated
  width: v.optional(v.number()),           // Image dimensions
  height: v.optional(v.number()),
  kieTaskId: v.optional(v.string()),       // ⭐ For debugging/retries
  threadId: v.optional(v.id("threads")),   // Chat thread reference
  agentThreadId: v.optional(v.string()),   // Agent thread for messages
  status: v.union(
    v.literal("pending"),     // Initial state
    v.literal("processing"),  // Task submitted to Kie.ai
    v.literal("completed"),   // Image stored in Convex
    v.literal("failed")       // Error occurred
  ),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_organization", ["organizationId"])
```

**Key Field: `kieTaskId`**
- Stores Kie.ai's task ID for debugging
- Enables manual queries to Kie.ai API if webhook fails
- Provides audit trail for support requests

---

### 2. Callback URL Construction

#### Pattern
```
https://{CONVEX_SITE_URL}/api/kie-callback?imageNodeId={imageNodeId}
```

#### Example
```
https://happy-animal-123.convex.site/api/kie-callback?imageNodeId=k17abc123def456
```

#### Implementation
```typescript
// convex/canvas/images.ts - generateImageAsync action
const convexSiteUrl = process.env.CONVEX_SITE_URL;
const callbackUrl = `${convexSiteUrl}/api/kie-callback?imageNodeId=${imageNodeId}`;
```

#### Why Query Parameters?
✅ **Eliminates need for mapping table** - Context embedded in URL
✅ **Stateless webhooks** - No database lookup to find which node
✅ **RESTful pattern** - Standard practice for webhook callbacks
✅ **Easy debugging** - Webhook URL shows exactly which node it updates

---

### 3. Environment Variables

#### Required Variables
```bash
# .env.example

# Convex Site URL (for webhooks)
# Replace 'cloud' with 'site' from your Convex URL
# Example: https://happy-animal-123.convex.site
CONVEX_SITE_URL=https://your-deployment.convex.site

# Kie.ai API Key
# Get from: https://kie.ai/
KIE_AI_API_KEY=your_kie_ai_api_key_here
```

#### URL Types Explained
| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_CONVEX_URL` | `https://app.convex.cloud` | Client-side database access |
| `CONVEX_SITE_URL` | `https://app.convex.site` | Public HTTP endpoints (webhooks) |
| `SITE_URL` | `https://yourapp.com` | Frontend application URL |

⚠️ **Critical**: Use `CONVEX_SITE_URL` (not `SITE_URL`) for callbacks to ensure Convex HTTP handler receives the webhook.

---

### 4. Backend Functions

#### `generateImageAsync` (Internal Action)
**File**: `convex/canvas/images.ts`

**Purpose**: Submit image generation task to Kie.ai with callback URL

**Flow**:
```typescript
export const generateImageAsync = internalAction({
  args: { imageNodeId: v.id("image_nodes") },
  handler: async (ctx, args) => {
    // 1. Get image node data
    const node = await ctx.runQuery(internal.canvas.images.getImageNodeInternal, {
      imageNodeId: args.imageNodeId,
    });

    // 2. Build callback URL with imageNodeId as query param
    const callbackUrl = `${process.env.CONVEX_SITE_URL}/api/kie-callback?imageNodeId=${args.imageNodeId}`;

    // 3. POST to Kie.ai API
    const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.KIE_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/nano-banana",
        callBackUrl: callbackUrl,  // ⭐ Callback URL with context
        input: {
          prompt: node.prompt,
          output_format: "png",
          image_size: "1:1",
        },
      }),
    });

    const data = await response.json();

    // 4. Store taskId and update status
    await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
      imageNodeId: args.imageNodeId,
      status: "processing",
      kieTaskId: data.data?.taskId,  // ⭐ Store for debugging
    });
  },
});
```

---

#### HTTP Webhook Handler
**File**: `convex/http.ts`

**Purpose**: Receive webhook from Kie.ai when generation completes

**Flow**:
```typescript
http.route({
  path: "/api/kie-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Extract imageNodeId from URL query params
    const url = new URL(request.url);
    const imageNodeId = url.searchParams.get("imageNodeId");

    // 2. Parse Kie.ai callback body
    const body = await request.json();
    // Body structure:
    // {
    //   code: 200 | 501,
    //   data: {
    //     state: "success" | "fail",
    //     taskId: "kie_task_xyz",
    //     resultJson: '{"resultUrls": ["https://kie.ai/...png"]}',
    //     failMsg?: "error message"
    //   }
    // }

    // 3. Handle success case
    if (body.code === 200 && body.data?.state === "success") {
      const resultJson = JSON.parse(body.data.resultJson);
      const imageUrl = resultJson.resultUrls?.[0];

      // Trigger action to download and store image
      await ctx.runAction(internal.canvas.images.processKieCallback, {
        imageNodeId: imageNodeId as any,
        imageUrl,
        status: "completed",
      });

      return new Response("Success", { status: 200 });
    }

    // 4. Handle failure case
    if (body.code === 501 || body.data?.state === "fail") {
      await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
        imageNodeId: imageNodeId as any,
        status: "failed",
        error: body.data?.failMsg || "Generation failed",
      });

      return new Response("Failure recorded", { status: 200 });
    }

    return new Response("Unknown state", { status: 400 });
  }),
});
```

**Key Points**:
- ✅ Always return `200 OK` to acknowledge receipt (even on failure)
- ✅ Kie.ai retries webhooks 3 times with exponential backoff
- ✅ Validate `imageNodeId` exists before processing
- ✅ Separate action for heavy work (downloads) to avoid timeouts

---

#### `processKieCallback` (Internal Action)
**File**: `convex/canvas/images.ts`

**Purpose**: Download image from Kie.ai and store in Convex

**Flow**:
```typescript
export const processKieCallback = internalAction({
  args: {
    imageNodeId: v.id("image_nodes"),
    imageUrl: v.string(),
    status: v.literal("completed"),
  },
  handler: async (ctx, args) => {
    // 1. Get image node (to retrieve thread info)
    const imageNode = await ctx.runQuery(internal.canvas.images.getImageNodeInternal, {
      imageNodeId: args.imageNodeId,
    });

    // 2. Download image from Kie.ai URL
    const response = await fetch(args.imageUrl);
    const blob = await response.blob();

    // 3. Store in Convex storage
    const storageId = await ctx.storage.store(blob);
    const imagePublicUrl = await ctx.storage.getUrl(storageId);

    // 4. Update node with completed status
    await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
      imageNodeId: args.imageNodeId,
      status: "completed",
      imageStorageId: storageId,
      width: 1024,
      height: 1024,
    });

    // 5. (Optional) Add image to agent chat thread
    if (imageNode.agentThreadId && imagePublicUrl) {
      await saveMessage(ctx, components.agent, {
        threadId: imageNode.agentThreadId as any,
        message: {
          role: "assistant",
          content: `Here's your generated image!\n\n![Generated Image](${imagePublicUrl})`,
        },
        agentName: "ImageGenerator",
      });
    }
  },
});
```

**Why Separate Action?**
- ✅ HTTP handlers have strict timeout limits (5-10 seconds)
- ✅ Image downloads can take 5-30+ seconds for large files
- ✅ Convex actions can run up to 10 minutes
- ✅ Webhook responds immediately, download happens in background

---

### 5. AI Tool Integration

#### `generateImageTool`
**File**: `convex/canvas/chat.ts`

**Purpose**: Allow AI agent to generate images from chat

**Implementation**:
```typescript
const generateImageTool = createTool({
  description: "Generate an AI image based on a text prompt and place it on the canvas. Use this when the user asks you to create, generate, or make an image.",
  args: z.object({
    prompt: z.string().describe("Detailed description of the image to generate. Be specific about style, content, colors, and composition."),
  }),
  handler: async (ctx, args) => {
    // 1. Extract context from AI agent
    const canvasId = (ctx as any).canvasId as Id<"canvases">;
    const organizationId = (ctx as any).organizationId as string;
    const canvasNodeId = (ctx as any).canvasNodeId as Id<"canvas_nodes">;
    const convexThreadId = (ctx as any).convexThreadId as Id<"threads"> | undefined;
    const agentThreadId = (ctx as any).agentThreadId as string | undefined;

    // 2. Calculate position near chat node
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
      console.warn("[Image Tool] Could not get chat node position", error);
    }

    // 3. Create image node
    const result = await ctx.runMutation(internal.canvas.images.createImageNodeInternal, {
      canvasId,
      position,
      prompt: args.prompt,
      organizationId,
      threadId: convexThreadId,
      agentThreadId,
    });

    // 4. Schedule background generation (with callback URL)
    await ctx.scheduler.runAfter(0, internal.canvas.images.generateImageAsync, {
      imageNodeId: result.imageNodeId,
    });

    return `I've started generating the image. It will appear on the canvas shortly.`;
  },
});
```

**Context Passing**:
- `canvasId` - Where to place the node
- `organizationId` - For auth/ownership
- `canvasNodeId` - Chat node position reference
- `convexThreadId` - Convex thread ID (`Id<"threads">`)
- `agentThreadId` - Agent thread ID (string) for saving messages

---

## State Transitions

```
┌─────────┐
│ PENDING │ Initial state after node creation
└────┬────┘
     │
     │ generateImageAsync called
     │ (submits task to Kie.ai with callback URL)
     │
     ▼
┌────────────┐
│ PROCESSING │ Waiting for Kie.ai webhook callback
└────┬───┬───┘
     │   │
     │   │ Webhook receives success
     │   ▼
     │ ┌───────────┐
     │ │ COMPLETED │ Image downloaded & stored
     │ └───────────┘
     │
     │ Webhook receives failure
     ▼
┌────────┐
│ FAILED │ Error message stored in node.error
└────────┘
```

**Status Flow**:
1. **pending** → Node created, waiting for action to start
2. **processing** → Task submitted to Kie.ai, waiting for webhook
3. **completed** → Webhook received, image stored in Convex
4. **failed** → Error at any step (API error, download failure, etc.)

---

## Real-Time Updates

### How Users See Progress

Convex provides **real-time subscriptions** that automatically push updates to the UI:

```typescript
// Frontend component
const imageNode = useQuery(
  api.canvas.functions.getImageNode,
  { imageNodeId: data.imageNodeId }
);

// Automatically re-renders when:
// - Status changes from "pending" → "processing"
// - Status changes from "processing" → "completed"
// - imageStorageId becomes available
// - Error message is added
```

**UI States**:
- `pending` → Show loading spinner + "Queuing generation..."
- `processing` → Show loading spinner + "Generating image..."
- `completed` → Show image with `<img src={imageUrl} />`
- `failed` → Show error message with retry button

---

## Security Considerations

### 1. Webhook Validation

**Current Implementation**:
```typescript
// Validate imageNodeId exists
if (!imageNodeId) {
  return new Response("Missing imageNodeId parameter", { status: 400 });
}

// Validate node exists before processing
const node = await ctx.db.get(imageNodeId);
if (!node) {
  throw new Error("Image node not found");
}
```

**Future Enhancement** (if Kie.ai supports):
- HMAC signature validation
- Timestamp verification (prevent replay attacks)
- IP whitelist for Kie.ai servers

### 2. Organization Ownership

The pattern inherently validates ownership:
1. `imageNodeId` is embedded in callback URL
2. `imageNodeId` references `image_nodes` table
3. `image_nodes` has `organizationId` field
4. Convex auth automatically validates organization access

**No additional auth needed** because:
- Webhook only updates existing node (no new data creation)
- Node already validated on creation
- Organization ownership baked into database design

### 3. Rate Limiting

Convex HTTP routes have **built-in rate limiting**:
- Per-IP rate limits
- Per-deployment rate limits
- DDoS protection

**No custom rate limiting needed** for webhooks.

---

## Error Handling

### 1. Webhook Delivery Failures

**Kie.ai Retry Policy**:
- Retries webhook 3 times
- Exponential backoff (1s, 5s, 15s)
- After 3 failures, stops trying

**Manual Recovery**:
```typescript
// 1. Check image_nodes for stuck "processing" nodes
const stuckNodes = await ctx.db
  .query("image_nodes")
  .filter(q => q.eq(q.field("status"), "processing"))
  .collect();

// 2. Use kieTaskId to manually query Kie.ai API
const response = await fetch(`https://api.kie.ai/api/v1/jobs/getTask/${node.kieTaskId}`, {
  headers: { Authorization: `Bearer ${process.env.KIE_AI_API_KEY}` },
});

// 3. If task completed, manually trigger processKieCallback
if (data.state === "success") {
  await ctx.runAction(internal.canvas.images.processKieCallback, {
    imageNodeId: node._id,
    imageUrl: data.resultUrls[0],
    status: "completed",
  });
}
```

### 2. Image Download Failures

**Handled in `processKieCallback`**:
```typescript
try {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const blob = await response.blob();
  // ... store in Convex
} catch (error) {
  // Update node with failed status
  await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
    imageNodeId: args.imageNodeId,
    status: "failed",
    error: error.message,
  });
}
```

### 3. API Errors

**Handled in `generateImageAsync`**:
```typescript
try {
  const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", { ... });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Kie AI error: ${data.msg || response.statusText}`);
  }
  // ... continue
} catch (error) {
  // Mark node as failed immediately
  await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
    imageNodeId: args.imageNodeId,
    status: "failed",
    error: error.message,
  });
}
```

---

## Local Development Setup

### Problem: Webhooks Don't Work with Localhost

Kie.ai needs to POST to a **publicly accessible URL**, but `http://localhost:3000` is not reachable from the internet.

### Solution: Use ngrok for Local Testing

```bash
# 1. Install ngrok
brew install ngrok

# 2. Start your Convex dev server
npx convex dev

# 3. In a new terminal, start ngrok
# Note: Convex HTTP endpoints are on the .convex.site domain
# Find your deployment URL from Convex dashboard
ngrok http https://your-deployment.convex.site

# 4. Copy ngrok URL (e.g., https://abc123.ngrok.io)
# Set in .env.local:
CONVEX_SITE_URL=https://abc123.ngrok.io

# 5. Restart Convex dev server to pick up new env var
```

**For Production**:
```bash
# Just set your actual Convex site URL
CONVEX_SITE_URL=https://your-deployment.convex.site
```

---

## Extending the Pattern: Videos

The same callback URL pattern is used for **video generation** with minimal changes:

### Differences

| Aspect | Images | Videos |
|--------|--------|--------|
| **API Model** | `google/nano-banana` | `runwayml/gen-3-alpha-turbo` |
| **Processing Time** | 5-30 seconds | 30 seconds - 5+ minutes |
| **File Size** | 1-5 MB | 10-100+ MB |
| **Callback Route** | `/api/kie-callback` | `/api/kie-video-callback` |
| **Table** | `image_nodes` | `video_nodes` |
| **Query Param** | `imageNodeId` | `videoNodeId` |

### Video Callback URL Example
```
https://app.convex.site/api/kie-video-callback?videoNodeId=v17xyz789abc123
```

**Same pattern, different entity!**

---

## Benefits of This Pattern

### 1. Performance
- ✅ 94% reduction in API calls
- ✅ Instant completion notification
- ✅ No polling overhead on server

### 2. Scalability
- ✅ No active connections to maintain
- ✅ Stateless webhooks (no memory usage)
- ✅ Handles high concurrency (many generations at once)

### 3. Simplicity
- ✅ No mapping tables (context in URL)
- ✅ Clear data flow (create → callback → complete)
- ✅ Easy debugging (webhook URL shows exact node)

### 4. Cost Efficiency
- ✅ Minimal API usage
- ✅ No background polling jobs
- ✅ Pay only for actual generation

### 5. Real-Time UX
- ✅ Convex subscriptions push updates instantly
- ✅ No page refresh needed
- ✅ Multi-tab sync (all tabs see updates)

---

## Common Patterns to Reuse

### 1. Async Node Creation Pattern

**Used by**: YouTube nodes, Website nodes, Image nodes, Video nodes

**Flow**:
```typescript
// 1. Create node with "pending" status
const nodeId = await ctx.db.insert("some_nodes", {
  status: "pending",
  // ... other fields
});

// 2. Schedule background processing
await ctx.scheduler.runAfter(0, internal.some_feature.processAsync, {
  nodeId,
});

// 3. External API call updates to "processing"
// 4. Callback/polling updates to "completed"
```

### 2. File Storage Pattern

**Used by**: Images, Videos, Website screenshots, PDF uploads

**Flow**:
```typescript
// 1. Fetch file from external URL
const response = await fetch(fileUrl);
const blob = await response.blob();

// 2. Store in Convex storage
const storageId = await ctx.storage.store(blob);

// 3. Save storageId in database
await ctx.db.patch(nodeId, { fileStorageId: storageId });

// 4. Frontend queries for public URL
const publicUrl = await ctx.storage.getUrl(storageId);
```

### 3. Context Passing via Query Params

**Used by**: Kie.ai callbacks, payment webhooks, OAuth redirects

**Pattern**:
```typescript
// Embed context in callback URL
const callbackUrl = `${baseUrl}/webhook?entityId=${entityId}&action=${action}`;

// Extract context in handler
const entityId = url.searchParams.get("entityId");
const action = url.searchParams.get("action");
```

### 4. Tool Context Injection

**Used by**: All AI tools (generateImage, generateVideo, etc.)

**Pattern**:
```typescript
// Agent injects context into tool handler
const generateTool = createTool({
  handler: async (ctx, args) => {
    const canvasId = (ctx as any).canvasId;
    const organizationId = (ctx as any).organizationId;
    const threadId = (ctx as any).convexThreadId;
    const agentThreadId = (ctx as any).agentThreadId;

    // Use context for node creation
  },
});
```

---

## Troubleshooting

### Issue: Webhook Never Fires

**Possible Causes**:
1. `CONVEX_SITE_URL` not set correctly
2. Firewall blocking Kie.ai IPs
3. Kie.ai task failed before callback

**Debug Steps**:
```typescript
// 1. Check kieTaskId was stored
const node = await ctx.db.get(imageNodeId);
console.log("Task ID:", node.kieTaskId);

// 2. Manually query Kie.ai API
const response = await fetch(`https://api.kie.ai/api/v1/jobs/getTask/${node.kieTaskId}`, {
  headers: { Authorization: `Bearer ${process.env.KIE_AI_API_KEY}` },
});
const data = await response.json();
console.log("Task status:", data);

// 3. Check Convex logs for webhook requests
// Dashboard > Logs > Filter by "/api/kie-callback"
```

### Issue: Image Node Stuck in "Processing"

**Solution**: Manual recovery script
```typescript
// Find stuck nodes (processing for > 10 minutes)
const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
const stuckNodes = await ctx.db
  .query("image_nodes")
  .filter(q =>
    q.and(
      q.eq(q.field("status"), "processing"),
      q.lt(q.field("updatedAt"), tenMinutesAgo)
    )
  )
  .collect();

// For each stuck node, query Kie.ai API and recover
```

### Issue: 400 Error on Webhook

**Possible Causes**:
1. Missing `imageNodeId` query param
2. Invalid `imageNodeId` (node doesn't exist)
3. Malformed JSON in webhook body

**Debug**:
```typescript
// Check Convex logs for error details
console.error("[Kie Webhook] Error:", error.message);
console.log("[Kie Webhook] Request URL:", request.url);
console.log("[Kie Webhook] Request body:", await request.text());
```

---

## Future Enhancements

### 1. Progress Updates
If Kie.ai supports progress webhooks:
```typescript
// Update schema
status: v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed")
),
progress: v.optional(v.number()), // 0-100

// Handle progress webhook
if (body.data?.state === "processing") {
  await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
    imageNodeId: imageNodeId as any,
    status: "processing",
    progress: body.data.progress, // e.g., 45
  });
}
```

### 2. HMAC Signature Validation
```typescript
// Validate webhook authenticity
const signature = request.headers.get("X-Kie-Signature");
const expectedSignature = createHmac("sha256", process.env.KIE_WEBHOOK_SECRET)
  .update(JSON.stringify(body))
  .digest("hex");

if (signature !== expectedSignature) {
  return new Response("Invalid signature", { status: 401 });
}
```

### 3. Retry Button in UI
```typescript
// Allow users to manually retry failed generations
export const retryImageGeneration = mutation({
  args: { imageNodeId: v.id("image_nodes") },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.imageNodeId);
    if (node.status === "failed") {
      // Reset status to pending
      await ctx.db.patch(args.imageNodeId, { status: "pending" });

      // Re-trigger generation
      await ctx.scheduler.runAfter(0, internal.canvas.images.generateImageAsync, {
        imageNodeId: args.imageNodeId,
      });
    }
  },
});
```

---

## Summary

The Kie.ai callback URL pattern is a **webhook-based async processing pattern** that:

1. **Embeds context in URL query params** (e.g., `?imageNodeId=k123`)
2. **Eliminates polling** (saves 94% of API calls)
3. **Provides instant notifications** (via webhook)
4. **Leverages Convex real-time subscriptions** (automatic UI updates)
5. **Stores taskId for debugging** (manual recovery if webhook fails)
6. **Separates concerns** (HTTP handler → action → mutation)
7. **Scales horizontally** (stateless, no memory overhead)

This pattern is reusable for **any external API** that supports webhooks (payments, transcription services, video processing, etc.) and provides a robust foundation for async operations in AI Whiteboard Chat.
