# Dynamic Thread Titles with Convex AI Agent

## 1. Database Design

**Existing tables - no changes needed:**
- `threads` table already has `title` field (string, optional)
- `threads` table has `agentThreadId` linking to Convex Agent component

**New mutation:**
- `updateThreadTitle` - Update thread title after generation
  - Input: `threadId` (Id<"threads">), `title` (string)
  - Output: Updated thread object
  - Purpose: Persist AI-generated title to threads table

## 2. Data Flow

1. User sends first message in new thread → triggers title generation
2. After AI response completes, extract first 2-3 messages from thread history
3. Pass messages to separate lightweight LLM call with prompt "Generate concise title (5 words max)"
4. LLM returns structured object with title field (using `generateObject`)
5. Update thread record in DB with new title

**Key transformations:**
- Message history → truncated context (first 2-3 messages)
- Context → title generation prompt
- LLM object response → thread title string
- Title → DB update

## 3. User Flows

**End user flow:**
- Create new thread (shows "Chat Thread N" initially)
- Send first message
- Receive AI response
- Thread title automatically updates to AI-generated title (no reload needed, real-time update)
- Title appears in sidebar thread list

**Edge cases:**
- Title generation fails → keep default title "Chat Thread N"
- User has 0 credits → skip title generation, keep default
- Network error → log error, keep default title

## 4. UI Components

**ThreadSidebar (existing):**
- Already displays `thread.title`
- No changes needed - will show updated title via Convex real-time sync

**Chat component:**
- No UI changes
- Add optional title generation trigger after message sent

## 5. API Routes

**Backend functions needed:**

1. `generateThreadTitle` (action)
   - Purpose: Generate title from thread messages using AI
   - Input: `threadId` (Id<"threads">), `organizationId` (string)
   - Output: `{ title: string }`
   - Flow: Fetch messages → call `agent.generateObject` with schema → return title

2. `updateThreadTitle` (mutation)
   - Purpose: Update thread title in DB
   - Input: `threadId`, `title`, `organizationId`
   - Output: Updated thread
   - Validates: Thread belongs to org before updating

3. Modify `sendMessage` (action)
   - Add: After successful AI response, check if thread has default title
   - If yes: Schedule `internal.canvas.threads.generateTitleAsync` to run after 0ms
   - If no: Skip title generation (already has custom/generated title)

## 6. Patterns to Reuse

**From existing codebase:**

1. **Agent usage pattern** (from `convex/canvas/chat.ts`):
   - Create agent with `new Agent(components.agent, {...})`
   - Use `agent.generateObject()` for structured title output
   - Pass Zod schema for validation: `z.object({ title: z.string().max(50) })`

2. **Auth pattern** (from all existing functions):
   - Get identity, verify `organizationId`, check ownership
   - Use internal actions/mutations to bypass auth for scheduled tasks

3. **Message fetching** (from Convex Agent docs):
   - Use `listMessages` from `@convex-dev/agent`
   - Limit to first 3 messages: `paginationOpts: { numItems: 3 }`
   - Filter: `excludeToolMessages: true`

4. **Async scheduling** (from `sendMessage`):
   - Use `ctx.scheduler.runAfter(0, internal.path.to.action, args)`
   - Prevents blocking user response with title generation

5. **Credit checking** (from `sendMessage`):
   - Optional: Skip title generation if credits low
   - Or use ultra-cheap model (gpt-4o-mini) so cost negligible

**Implementation approach:**
- Use `generateObject` not `generateText` for reliability
- Keep title generation separate from main chat flow (async)
- Use lightweight model to minimize cost
- Schema validation ensures titles are reasonable length
- Real-time DB updates → UI updates automatically

**Cost optimization:**
- Only generate title once per thread
- Check if title is still default before generating
- Use cheapest model for title generation
- Estimated: ~100 tokens = $0.0001 per title with gpt-4o-mini
