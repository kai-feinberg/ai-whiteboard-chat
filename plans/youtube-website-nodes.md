# YouTube & Website Nodes - Implementation Plan

## 1. Database Design

### New Tables

**youtube_nodes**
- `_id`: ID
- `organizationId`: string (indexed)
- `url`: string (YouTube URL)
- `videoId`: string (extracted from URL)
- `title`: optional string (from API/metadata)
- `transcript`: optional string (full transcript text)
- `thumbnailUrl`: optional string
- `duration`: optional number (seconds)
- `status`: string enum ("pending", "processing", "completed", "failed")
- `error`: optional string (error message if failed)
- `createdAt`: number
- `updatedAt`: number

Index: `by_organization` on `organizationId`

**website_nodes**
- `_id`: ID
- `organizationId`: string (indexed)
- `url`: string (website URL)
- `title`: optional string (page title)
- `markdown`: optional string (scraped content in Markdown)
- `screenshotUrl`: optional string (Convex file storage URL)
- `status`: string enum ("pending", "processing", "completed", "failed")
- `error`: optional string
- `createdAt`: number
- `updatedAt`: number

Index: `by_organization` on `organizationId`

### Schema Updates

**canvas_nodes.nodeType**
- Add: `v.literal("youtube")`, `v.literal("website")`
- Updated: `v.union(v.literal("text"), v.literal("chat"), v.literal("group"), v.literal("youtube"), v.literal("website"))`

**canvas_nodes.data**
- Add: `v.id("youtube_nodes")`, `v.id("website_nodes")`
- Updated: `v.union(v.id("text_nodes"), v.id("chat_nodes"), v.id("group_nodes"), v.id("youtube_nodes"), v.id("website_nodes"))`

### Key Queries/Mutations

**createYouTubeNode** (action)
- Input: `canvasId`, `position`, `url`
- Output: `{ canvasNodeId, youtubeNodeId }`
- Purpose: Create YouTube node + kick off background transcript fetch
- Flow:
  1. Extract videoId from URL
  2. Create youtube_node with status="pending"
  3. Create canvas_node reference
  4. Schedule background action `fetchYouTubeTranscript`

**fetchYouTubeTranscript** (internal action)
- Input: `youtubeNodeId`
- Output: none (updates node in place)
- Purpose: Background job to fetch transcript via YouTube transcript package
- Flow:
  1. Update status to "processing"
  2. Call YouTube transcript API/package
  3. Update node with transcript + metadata or error
  4. Update status to "completed" or "failed"

**createWebsiteNode** (action)
- Input: `canvasId`, `position`, `url`
- Output: `{ canvasNodeId, websiteNodeId }`
- Purpose: Create website node + kick off Firecrawl scraping
- Flow:
  1. Create website_node with status="pending"
  2. Create canvas_node reference
  3. Schedule background action `scrapeWebsite`

**scrapeWebsite** (internal action)
- Input: `websiteNodeId`
- Output: none (updates node in place)
- Purpose: Background scraping via Firecrawl
- Flow:
  1. Update status to "processing"
  2. Call Firecrawl API with screenshot option
  3. Store screenshot in Convex file storage
  4. Update node with markdown + screenshotUrl or error
  5. Update status to "completed" or "failed"

**getYouTubeContext** (query)
- Input: `youtubeNodeId`
- Output: Formatted text for AI (title + transcript)
- Purpose: Extract context from YouTube node for chat

**getWebsiteContext** (query)
- Input: `websiteNodeId`
- Output: Formatted text for AI (title + markdown content)
- Purpose: Extract context from website node for chat

## 2. Data Flow

### YouTube Node Flow

1. User clicks "Add YouTube" in toolbar → paste URL modal appears
2. Frontend validates URL format (youtube.com or youtu.be)
3. Call `createYouTubeNode` action
4. Action creates DB record with status="pending", schedules background job
5. Node appears on canvas with loading state
6. Background action fetches transcript via Firecrawl
7. Real-time update: node status → "completed", transcript populates
8. UI updates to show iframe + transcript button

### Website Node Flow

1. User clicks "Add Website" → paste URL modal
2. Frontend validates URL (basic http/https check)
3. Call `createWebsiteNode` action
4. Action creates DB record with status="pending", schedules Firecrawl job
5. Node appears with loading spinner
6. Background job scrapes website + captures screenshot
7. Screenshot uploaded to Convex file storage
8. Real-time update: node status → "completed"
9. UI shows screenshot + collapsible markdown content

### Context Gathering Flow

**Existing `getNodeContext` update:**
- Add cases for "youtube" and "website" node types
- Call respective context queries
- Aggregate into system messages for AI

```typescript
if (sourceNode.nodeType === "youtube") {
  const youtubeContext = await getYouTubeContext(nodeId)
  contextMessages.push(youtubeContext)
}
```

## 3. User Flows

### YouTube Node Creation
- Click toolbar → "Add YouTube"
- Paste URL (e.g., `https://youtube.com/watch?v=abc123`)
- URL validated client-side → extract videoId
- Node created with pending state
- Background job fetches transcript (5-30s)
- Node updates with video embed + transcript

### Website Node Creation
- Click toolbar → "Add Website"
- Paste URL (e.g., `https://example.com/article`)
- Node created with loading state
- Firecrawl scrapes content (10-60s)
- Node shows screenshot + markdown preview

### Connecting to Chat
- Drag edge from YouTube/Website node → Chat node
- Chat receives full transcript/content as context
- User sends message → AI has video/page content available
- Cost preview shows token count from transcript/markdown

## 4. UI Components

### YouTubeNode (`src/features/canvas/components/YouTubeNode.tsx`)
- **Header:** YouTube icon + "YouTube" title
- **Content:**
  - Pending state: Spinner + "Fetching transcript..."
  - Failed state: Error message + retry button
  - Completed state:
    - iframe embed (16:9 ratio, 400px width)
    - Collapsible "Transcript" button (radix Collapsible)
    - Transcript text area (scrollable, max 300px height)
- **Handles:** Source only (provides context to chat)
- **Data needs:** `url`, `videoId`, `transcript`, `status`, `error`

### WebsiteNode (`src/features/canvas/components/WebsiteNode.tsx`)
- **Header:** Globe icon + "Website" title
- **Content:**
  - Pending: Spinner + "Scraping website..."
  - Failed: Error + retry
  - Completed:
    - Screenshot image (400px width, auto height)
    - Collapsible "Content" button
    - Markdown preview (scrollable, max 300px)
- **Handles:** Source only
- **Data needs:** `url`, `title`, `markdown`, `screenshotUrl`, `status`

### AddNodeModal (Update existing)
- Add YouTube option with URL input field
- Add Website option with URL input field
- Client-side URL validation before submission
- Visual feedback (loading state after submit)

### Toolbar Update
- Add YouTube button (video icon)
- Add Website button (globe icon)
- Both open URL input modal

## 5. API Integration

### Package Dependencies

**Install dependencies:**
```bash
pnpm add @mendable/firecrawl-js youtube-transcript
```

**Environment variables:**
```
FIRECRAWL_API_KEY=fc-xxx
```

### Background Job Pattern (Shared)

Both YouTube and Website nodes follow the same pattern:
1. Create node with status="pending"
2. Schedule background action via `ctx.scheduler.runAfter(0, internal.action)`
3. Background action updates status to "processing"
4. Fetch data from external API
5. Update node with data + status="completed" OR error + status="failed"
6. Convex reactivity updates UI in real-time

**YouTube Transcript Action:**
```typescript
// convex/canvas/youtube.ts
import { YoutubeTranscript } from 'youtube-transcript';

export const fetchYouTubeTranscript = internalAction({
  args: { youtubeNodeId: v.id("youtube_nodes") },
  handler: async (ctx, args) => {
    const node = await ctx.runQuery(internal.canvas.nodes.getYouTubeNode, {
      youtubeNodeId: args.youtubeNodeId
    })

    // Update status to processing
    await ctx.runMutation(internal.canvas.nodes.updateYouTubeNode, {
      youtubeNodeId: args.youtubeNodeId,
      status: "processing"
    })

    try {
      // Fetch transcript using youtube-transcript package
      const transcriptData = await YoutubeTranscript.fetchTranscript(node.videoId)

      // Combine transcript segments into single text
      const transcript = transcriptData
        .map(segment => segment.text)
        .join(' ')

      // Get video metadata (could use youtube API or extract from page)
      const title = `Video ${node.videoId}` // TODO: fetch actual title
      const thumbnailUrl = `https://img.youtube.com/vi/${node.videoId}/maxresdefault.jpg`

      // Save transcript
      await ctx.runMutation(internal.canvas.nodes.updateYouTubeNode, {
        youtubeNodeId: args.youtubeNodeId,
        title,
        transcript,
        thumbnailUrl,
        status: "completed"
      })
    } catch (error) {
      await ctx.runMutation(internal.canvas.nodes.updateYouTubeNode, {
        youtubeNodeId: args.youtubeNodeId,
        status: "failed",
        error: error.message
      })
    }
  }
})
```

**Website Scraping Action:**
```typescript
// convex/canvas/firecrawl.ts
import FirecrawlApp from '@mendable/firecrawl-js';

export const scrapeWebsite = internalAction({
  args: { websiteNodeId: v.id("website_nodes") },
  handler: async (ctx, args) => {
    const node = await ctx.runQuery(internal.canvas.nodes.getWebsiteNode, {
      websiteNodeId: args.websiteNodeId
    })

    // Update status to processing
    await ctx.runMutation(internal.canvas.nodes.updateWebsiteNode, {
      websiteNodeId: args.websiteNodeId,
      status: "processing"
    })

    try {
      const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY })

      // Scrape with markdown + screenshot
      const result = await firecrawl.scrapeUrl(node.url, {
        formats: ['markdown', 'screenshot'],
        onlyMainContent: true
      })

      // Upload screenshot to Convex storage
      const screenshotBlob = await fetch(result.screenshot.url).then(r => r.blob())
      const screenshotUrl = await ctx.storage.store(screenshotBlob)

      // Save results
      await ctx.runMutation(internal.canvas.nodes.updateWebsiteNode, {
        websiteNodeId: args.websiteNodeId,
        title: result.metadata?.title,
        markdown: result.markdown,
        screenshotUrl,
        status: "completed"
      })
    } catch (error) {
      await ctx.runMutation(internal.canvas.nodes.updateWebsiteNode, {
        websiteNodeId: args.websiteNodeId,
        status: "failed",
        error: error.message
      })
    }
  }
})
```

## 6. Patterns to Reuse

### URL Validation (Client-Side)
```typescript
// src/features/canvas/utils/url.ts
export function isYouTubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/.test(url)
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)
  return match?.[1] ?? null
}

export function isValidWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
```

### Node Creation Pattern (from TextNode/ChatNode)
- Use same dual-table pattern: type-specific table + canvas_node reference
- Action for async operations (scheduling background jobs)
- Internal mutation for DB updates (called from actions)
- Real-time status updates via Convex reactivity

### Background Job Pattern (CRITICAL - Same for Both Node Types)

**Pattern Flow:**
1. User action creates node record with `status: "pending"`
2. Immediately schedule background job: `ctx.scheduler.runAfter(0, internal.action, { nodeId })`
3. Return node IDs to client (node appears in loading state)
4. Background action runs:
   - Update status to "processing"
   - Fetch data from external API (YouTube transcript or Firecrawl)
   - On success: update node with data + `status: "completed"`
   - On error: update node with error message + `status: "failed"`
5. Convex reactivity automatically updates UI

**Example Structure:**
```typescript
// Public action - creates node and schedules job
export const createYouTubeNode = action({
  handler: async (ctx, args) => {
    // Create node with status="pending"
    const { youtubeNodeId, canvasNodeId } = await ctx.runMutation(
      internal.canvas.nodes.createYouTubeNodeInternal,
      { ...args, status: "pending" }
    )

    // Schedule background job
    await ctx.scheduler.runAfter(0, internal.canvas.youtube.fetchYouTubeTranscript, {
      youtubeNodeId
    })

    return { youtubeNodeId, canvasNodeId }
  }
})

// Internal action - background job
export const fetchYouTubeTranscript = internalAction({
  handler: async (ctx, args) => {
    // Update to processing
    await ctx.runMutation(internal.canvas.nodes.updateYouTubeNode, {
      nodeId: args.youtubeNodeId,
      status: "processing"
    })

    try {
      // Fetch data
      const data = await externalAPI()

      // Update to completed
      await ctx.runMutation(internal.canvas.nodes.updateYouTubeNode, {
        nodeId: args.youtubeNodeId,
        ...data,
        status: "completed"
      })
    } catch (error) {
      // Update to failed
      await ctx.runMutation(internal.canvas.nodes.updateYouTubeNode, {
        nodeId: args.youtubeNodeId,
        status: "failed",
        error: error.message
      })
    }
  }
})
```

### Context Gathering Pattern (Update existing)
```typescript
// In convex/canvas/nodes.ts getNodeContext query
case "youtube": {
  const youtubeNode = await ctx.db.get(sourceNode.data.nodeId)
  if (youtubeNode?.transcript) {
    contextMessages.push({
      role: "system",
      content: `YouTube Video: ${youtubeNode.title}\n\nTranscript:\n${youtubeNode.transcript}`
    })
  }
  break
}

case "website": {
  const websiteNode = await ctx.db.get(sourceNode.data.nodeId)
  if (websiteNode?.markdown) {
    contextMessages.push({
      role: "system",
      content: `Website: ${websiteNode.title || websiteNode.url}\n\nContent:\n${websiteNode.markdown}`
    })
  }
  break
}
```

### File Storage Pattern (for screenshots)
- Upload blob: `await ctx.storage.store(blob)`
- Get URL: `await ctx.storage.getUrl(storageId)`
- Use in component: `<img src={screenshotUrl} />`

### Status-Based Rendering Pattern
```typescript
// In node component
{status === "pending" && <LoadingSpinner />}
{status === "processing" && <ProcessingIndicator />}
{status === "failed" && <ErrorMessage error={error} onRetry={retry} />}
{status === "completed" && <NodeContent />}
```

### Auth Pattern (Standard)
- All mutations/queries check `identity.organizationId`
- Verify canvas/node ownership before operations
- Use same pattern from existing node types

### Collapsible Pattern (Radix UI)
```typescript
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@radix-ui/react-collapsible"

<Collapsible>
  <CollapsibleTrigger>View Transcript</CollapsibleTrigger>
  <CollapsibleContent>
    <pre>{transcript}</pre>
  </CollapsibleContent>
</Collapsible>
```

## Implementation Checklist

### Phase 1: Database & Backend
- [ ] Add youtube_nodes + website_nodes tables to schema
- [ ] Update canvas_nodes.nodeType union
- [ ] Install dependencies: `@mendable/firecrawl-js`, `youtube-transcript`
- [ ] Create convex/canvas/youtube.ts for YouTube actions
- [ ] Create convex/canvas/firecrawl.ts for Website actions
- [ ] Add createYouTubeNode action (creates node + schedules background job)
- [ ] Add fetchYouTubeTranscript internal action (background job)
- [ ] Add createWebsiteNode action (creates node + schedules background job)
- [ ] Add scrapeWebsite internal action (background job)
- [ ] Add internal mutations: updateYouTubeNode, updateWebsiteNode
- [ ] Add internal queries: getYouTubeNode, getWebsiteNode
- [ ] Update getNodeContext query for new types

### Phase 2: UI Components
- [ ] Create YouTubeNode component with embed + collapsible
- [ ] Create WebsiteNode component with screenshot + markdown
- [ ] Add URL validation utils
- [ ] Update toolbar with YouTube/Website buttons
- [ ] Add URL input modal/dialog
- [ ] Update node type mapping in Canvas component

### Phase 3: Integration
- [ ] Test YouTube transcript fetching
- [ ] Test website scraping with screenshots
- [ ] Test context gathering from new node types
- [ ] Test real-time status updates
- [ ] Add retry mechanism for failed scrapes
- [ ] Add loading/error states

### Phase 4: Polish
- [ ] Truncate long transcripts in node preview
- [ ] Show transcript word count
- [ ] Add thumbnail fallback for YouTube
- [ ] Optimize screenshot sizes
- [ ] Add markdown syntax highlighting
- [ ] Cost transparency (show token count)

## Edge Cases & Error Handling

**YouTube:**
- Invalid URL → Client-side validation error
- Video unavailable → Firecrawl error → Show retry
- No transcript available → Store empty, show "No transcript"
- Rate limiting → Exponential backoff retry

**Website:**
- Invalid URL → Client validation
- 404/403 errors → Show error message + retry
- Scraping timeout → Set timeout limit (60s)
- Screenshot too large → Resize before storage
- Paywall/login required → Firecrawl limitation, show error

**General:**
- Convex storage limits → Check file size before upload
- Firecrawl API key missing → Fail gracefully with env error
- Network errors → Retry with exponential backoff
- Multiple retries → Limit to 3 attempts, then fail permanently

## Cost Considerations

**Firecrawl Pricing:**
- Per-page scraping cost
- Screenshot adds extra cost
- Transcript extraction may vary

**Optimization:**
- Cache results (don't re-scrape same URL)
- Add "refresh" button for manual re-scrape
- Show cost estimate before scraping (if available)

**Token Cost:**
- Long transcripts = high token cost
- Truncate to first N characters option
- Show preview of what context will be sent
- Allow user to exclude from context (checkbox)
