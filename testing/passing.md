## Use this to keep track of a list of passing acceptance criteria (sort by feature)

### Thread Management (US-004, US-006)
- [ ] User clicks "New Chat" button and a new thread is created
- [ ] User is navigated to the new thread after creation
- [ ] User sees list of their threads in the sidebar
- [ ] User sees thread titles and relative timestamps (e.g., "2 hours ago")
- [ ] User's active thread is visually highlighted in the sidebar
- [ ] User clicks delete on a thread and sees confirmation dialog
- [ ] User confirms delete and thread is removed from sidebar
- [ ] User visits home page and is redirected to /chat
- [ ] User on mobile can open sidebar via sheet/drawer

### Messaging (US-005)
- [ ] User sends a message in a thread
- [ ] User sees their message appear immediately
- [ ] User sees AI response stream word-by-word in real-time
- [ ] User can view message history when returning to a thread

### AI Search (US-002, US-003)
- [ ] User asks about a product/topic and AI searches TikTok
- [ ] User receives TikTok video results with metadata (views, likes, shares)
- [ ] User receives video transcripts converted from WebVTT to plain text
- [ ] User sees graceful fallback message when transcript unavailable

### Auth & Security
- [ ] Unauthenticated user cannot access threads
- [ ] User can only see their own threads (not other users')
- [ ] User can only delete their own threads
- [ ] Thread messages query verifies thread ownership

### Web Search (US-WS-004)
- [x] User sends message triggering filteredWebSearch tool
- [x] Tool shows loading state "Searching web..."
- [x] Accepted results render as cards with favicon, title (linked), summary, author, date
- [x] Cards display article thumbnail image when available
- [x] Cards appear in responsive grid layout (1/2/3 columns based on viewport)
- [x] Clicking card opens article in new tab

### Rejected Results (US-WS-005)
- [x] Collapsed section shows "X results filtered out" header with expand chevron
- [x] Badge showing count of rejected items on the right
- [x] When expanded, rejected results show as smaller cards with title (linked) and rejection reason
- [x] Section is collapsed by default
- [x] Smooth expand/collapse animation (chevron rotation)
- [x] Section is hidden entirely when no rejected results

### UI Polish (US-WS-006)
- [x] HTML entities (e.g., &amp;) display correctly as decoded characters in card titles/summaries
- [x] Text truncates gracefully with ellipsis on card titles (line-clamp-2) and summaries (line-clamp-2)
- [x] Cards have proper padding (p-3) and spacing
- [x] No text overflow issues on mobile or desktop

### Visual Design (US-WS-007)
- [x] Consistent color palette with gold accents in dark mode
- [x] Cards have hover effects (shadow, translate-y, border color change)
- [x] Cards have staggered fade-in animations on load
- [x] Loading states have animated ping effect
- [x] Sidebar has improved visual hierarchy with borders and spacing
- [x] Empty state has hero icon with glow effect and feature pills
- [x] Prompt input has rounded corners, shadows, and focus states
- [x] Cards and UI elements feel polished and cohesive
- [x] Mobile responsive: cards stack vertically, sidebar collapses

### Style Tuner Session Creation (US-ST-001)
- [x] User navigates to /style-tuner and sees session creation form
- [x] Form displays 3 sample textareas by default
- [x] User can add more sample textareas via "Add Another Sample" button
- [x] User can remove extra samples (keeps minimum of 3)
- [x] Form displays 1 topic input by default
- [x] User can add more topic inputs via "Add Another Topic" button
- [x] User can remove extra topics (keeps minimum of 1)
- [x] Validation shows error if sample is empty or < 100 characters
- [x] Validation shows error if no topics provided
- [x] Validation shows general error "At least 3 valid samples required"
- [x] Character count shown below each sample textarea
- [x] Form submission logs session data to console (backend stub until US-ST-002)

### Style Tuner Session Overview (US-ST-009)
- [x] /style-tuner shows list of user's sessions (grid of cards)
- [x] Each session card shows: created date (relative), status badge, iteration count
- [x] Status badges display correctly: pending, running, completed, max_iterations_reached
- [x] Click session card → navigates to /style-tuner/:sessionId detail view
- [x] Loading state shows skeleton cards while fetching sessions
- [x] Empty state (no sessions) hides the "Your Sessions" section
- [x] Form is wired to backend: createSession → generateStylePrompt → startIterationLoop
- [x] After form submission, user is navigated to the new session's detail page

### Style Tuner Session Detail (US-ST-010)
- [x] /style-tuner/:sessionId shows session detail page
- [x] Header shows session status badge (running, completed, max_iterations_reached)
- [x] Header shows session metadata: created date (relative), iteration count/max
- [x] Original samples shown in collapsible card (expands to show all samples)
- [x] Test topics displayed as badges
- [x] Final prompt shown when session completed (with "Copy Prompt" button)
- [x] Copy Prompt button copies to clipboard and shows "Copied" feedback
- [x] Iteration history shows as accordion list
- [x] Each iteration shows: iteration number, timestamp, fooled judges percentage with progress bar
- [x] Iteration expands to show: prompt used, generated sample, judge evaluations
- [x] Judge evaluations show: judge number, Fooled/Detected AI badge, confidence %, reasoning
- [x] Fooled judges show green background, detected AI shows red background
- [x] Changes/feedback shown at bottom of expanded iteration (amber highlight)
- [x] Back to sessions link navigates to /style-tuner
- [x] Loading states show skeleton placeholders
- [x] Not found state shown for invalid session IDs (handled by Convex validation)

### Documents System (US-DOC-003, US-DOC-004)
- [x] User navigates to /documents and sees documents list page
- [x] "Documents" link appears in main sidebar navigation
- [x] Page shows empty state with icon and "Create Your First Document" button when no documents
- [x] "New Document" button creates document with "Untitled Document" title
- [x] After creating, user is navigated to /documents/:documentId
- [x] Documents list shows title and last updated date for each document
- [x] Hovering document card reveals delete button (trash icon)
- [x] Clicking delete shows confirmation dialog with "Cancel" and "Delete" buttons
- [x] Confirming delete removes document and shows toast notification
- [x] Loading state shows skeleton cards while fetching
- [x] Document editor page has editable title field that auto-saves on blur
- [x] Document editor page has large textarea for content (markdown placeholder text)
- [x] Content auto-saves with debounced ~1s delay after typing stops
- [x] "Saved" / "Saving..." indicator shows in header based on save status
- [x] Back button in header navigates to documents list
- [x] Loading state shows spinner while document is loading
- [x] Updated title persists and shows in documents list after save

### Link Reading Tool (US-LR-001, US-LR-002, US-LR-003, US-LR-004)
- [x] User pastes YouTube URL in chat, AI uses readLink tool to extract transcript
- [x] AI receives structured content (title, transcript, URL) and incorporates into response
- [x] Tool detects platform from URL (YouTube, Twitter, TikTok, Facebook Ads, websites)
- [x] Tool handles errors gracefully - returns error message instead of crashing
- [x] readLink tool call shows "Reading link..." loading state with spinner icon
- [x] Loading state shows URL being fetched and progress bar with "Fetching content..." text
- [x] Loading state card has primary border/background tint for visibility
- [x] Completed tool shows title, platform badge (YouTube/Twitter/Website), and truncated preview
- [x] Tool display includes clickable "View original" link to source URL
- [x] "View full content" button appears when transcript is longer than 200 characters
- [x] Clicking "View full content" opens modal with full transcript
- [x] Modal shows platform icon, title, author (if available), and scrollable full text
- [x] Modal includes "View original source" link at bottom
- [x] Platform icons display correctly (YouTube red, Twitter blue, Globe for website)
- [x] Styling consistent with existing tool displays (card with border, spacing)
- [x] Invalid URL format returns helpful error with supported platforms list
- [x] Failed extractions include supported platforms in error message
- [x] AI responds helpfully when given invalid URL, suggesting valid formats and supported platforms

### Full-Screen Chat Links (US-NAV-001)
- [x] Canvas cards on dashboard show chat button (MessageSquare icon) on hover
- [x] Chat button only appears on canvas cards that have chat nodes
- [x] Chat button has green hover styling
- [x] Chat button has "Open Chat" tooltip
- [x] Clicking chat button navigates to /canvas/{canvasId}/chat
- [x] Chat page loads with "Back to Canvas" button and thread sidebar visible
- [x] Sidebar navigation does not show "Chats" link (removed /chats route)

### Canvas Switcher Dropdown (US-NAV-002)
- [x] Dropdown shows in chat page header next to the current canvas name
- [x] Dropdown trigger is a button with canvas title and chevron icon
- [x] Clicking canvas name opens dropdown menu
- [x] Loading state shows spinner while fetching canvas list
- [x] Empty state shows "No other canvases with chats" when only current canvas has chats
- [x] Current canvas would be highlighted with checkmark when multiple canvases exist
- [x] Clicking different canvas navigates to `/canvas/{canvasId}/chat`
- [x] After switching canvas, first thread is automatically selected so chat loads immediately

### TikTok Search API (US-TK-001)
- [x] `fetchTikTokSearch` function searches TikTok via Scrape Creators API with `sort_by: most-liked`, `trim: true`
- [x] `parseWebVTT` helper converts WebVTT transcripts to plain text (handles STYLE, REGION, NOTE blocks, tags)
- [x] Transcripts fetched in parallel for all videos via `GET /v1/tiktok/video/transcript`
- [x] Returns array with: `tiktokId`, `videoUrl`, `thumbnailUrl`, `creatorHandle`, `views`, `likes`, `shares`, `transcript`
- [x] API errors handled: 401 (invalid key), 429 (rate limit), other HTTP errors
- [x] Silent fallback to `"[No speech detected]"` if transcript fetch fails
- [x] Convex codegen passes

### searchTikTok AI Tool (US-TK-002)
- [x] `searchTikTok` tool defined with Zod schema: `{ query: string }`
- [x] Tool description explains it searches TikTok for videos with transcripts
- [x] Output schema: `{ success, videos[], totalFound?, message?, error? }`
- [x] Tool registered in agent definition alongside filteredWebSearch and readLink
- [x] Tool accessible from chat sendMessage flow
- [x] Convex codegen passes