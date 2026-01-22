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