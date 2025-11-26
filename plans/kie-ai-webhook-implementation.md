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
1. Build callback URL: `${SITE_URL}/api/kie-callback?imageNodeId=${imageNodeId}`
2. Replace placeholder fetch with real Kie AI API call:
   - Endpoint: `https://api.kie.ai/nano-banana/create-task`
   - Headers: `Authorization: Bearer ${KIE_AI_API_KEY}`
   - Body: `{ callBackUrl, model: "nano-banana-pro", input: { prompt, aspect_ratio, resolution, output_format } }`
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
- Support for different Kie AI models (beyond nano-banana-pro)
- Batch image generation (multiple images from one prompt)
