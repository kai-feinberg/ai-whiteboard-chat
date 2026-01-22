# Chat Interface UI Implementation Guide

## Feature Overview

### Purpose and User Value
A reusable chat component that handles message display, auto-scrolling, streaming responses, and sticky input prompt. Works in both compact (canvas node) and full-screen contexts.

### Key Functionality
- Real-time message streaming with smooth text animation
- Auto-scroll to bottom on new messages
- Manual scroll-to-bottom button when user scrolls up
- Sticky input at bottom of container
- Copy message functionality
- Agent/model selection dropdowns
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

### User Flow
1. User sees message history in scrollable container
2. New messages auto-scroll to bottom
3. User can scroll up to view history - scroll button appears
4. Click scroll button to jump back to latest
5. Input stays fixed at bottom regardless of scroll position
6. Type message and press Enter to send
7. AI response streams in character-by-character

---

## Architecture

### Data Flow
```
Parent Component
    ↓ (messages, onSendMessage)
Chat Component
    ↓ (renders)
Conversation Container (StickToBottom)
    ↓ (manages scroll)
ConversationContent
    ↓ (maps messages)
StreamingMessage Components
    ↓ (smooth text animation)
Response/MessageContent
```

```
User Input Flow:
PromptInputTextarea
    ↓ (Enter key)
PromptInput onSubmit
    ↓ (calls)
Parent's onSendMessage
    ↓ (creates)
New Message in messages array
    ↓ (triggers)
Re-render + Auto-scroll
```

### Component Interaction Map

**Top-level Chat Component** (`Chat.tsx`)
- Receives: `messages[]`, `onSendMessage`, `isStreaming`, `variant`, agent/model selection props
- Manages: Form submission, streaming state display
- Delegates scrolling to: `Conversation` components
- Delegates input to: `PromptInput` components

**Conversation System** (`conversation.tsx`)
- `<Conversation>` - Wrapper using `use-stick-to-bottom` library
- `<ConversationContent>` - Message container with padding
- `<ConversationScrollButton>` - Auto-hide scroll-to-bottom button
- Auto-scrolls on new content unless user manually scrolled up

**Message Display** (`message.tsx`)
- `<Message>` - Container with role-based styling (user vs assistant)
- `<MessageContent>` - Bubble with variant styles (contained vs flat)
- Uses flexbox to align user messages right, AI left

**Input System** (`prompt-input.tsx`)
- `<PromptInput>` - Form wrapper with file drop support
- `<PromptInputTextarea>` - Auto-resizing textarea with keyboard handlers
- `<PromptInputSubmit>` - Submit button with status icons
- Handles Enter/Shift+Enter, paste, file attachments

**Response Rendering** (`response.tsx`)
- `<Response>` - Memoized markdown renderer using `streamdown`
- Prevents re-renders unless content changes
- Supports real-time streaming markdown

### Integration Points
- **Convex Agent SDK**: `useSmoothText` hook for streaming animation
- **use-stick-to-bottom**: Third-party library handling scroll behavior
- **streamdown**: Markdown renderer for AI responses
- **lucide-react**: Icon library

---

## Core Logic

### Auto-Scroll Behavior Pattern

The key to sticky scrolling is the `use-stick-to-bottom` library:

```typescript
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

// Wrapper component
<StickToBottom
  className="relative flex-1 overflow-y-auto min-h-0"
  initial="smooth"    // Scroll mode on mount
  resize="smooth"     // Scroll mode when content resizes
  role="log"
>
  {/* Content here */}
</StickToBottom>

// Access scroll state in child components
const { isAtBottom, scrollToBottom } = useStickToBottomContext();
```

**How it works:**
- `StickToBottom` wrapper tracks scroll position
- Automatically scrolls when content grows IF user is at bottom
- If user scrolls up, stops auto-scrolling
- `isAtBottom` tells you if user is at bottom
- `scrollToBottom()` manually jumps to bottom

### Smooth Text Streaming

Uses Convex's `useSmoothText` hook:

```typescript
const [visibleText] = useSmoothText(message.text, {
  startStreaming: message.status === "streaming",
});

// Render:
{visibleText && <Response>{visibleText}</Response>}
```

**Behavior:**
- Animates text character-by-character even if full text arrives instantly
- Provides better UX than instant appearance
- Works with streaming or complete responses

### Sticky Input Layout Strategy

CSS flexbox pattern:

```typescript
<div className="flex flex-col h-full">
  {/* Scrollable area - takes available space */}
  <Conversation className="flex-1">
    <ConversationContent>
      {/* Messages */}
    </ConversationContent>
  </Conversation>

  {/* Fixed input area - doesn't scroll */}
  <div className="shrink-0 border-t">
    <PromptInput />
  </div>
</div>
```

**Key CSS classes:**
- Parent: `flex flex-col h-full` - Vertical stack filling container
- Scroll area: `flex-1` - Grows to fill space, has `overflow-y-auto`
- Input area: `shrink-0` - Fixed size, doesn't participate in flex growth

### State Management

**Local state in Chat component:**
- `copied` state for copy button feedback (2s timeout)

**Props-based state:**
- `messages` - Controlled by parent, Chat is stateless
- `isStreaming` - Controls submit button disabled state
- `selectedAgentId/ModelId` - Controlled agent/model selection

**Input state:**
- Managed by `PromptInput` component internally
- Can optionally use `PromptInputProvider` for global state
- Clears automatically on successful submission

---

## Frontend Structure

### Component Hierarchy

```
Chat (src/features/chat/components/Chat.tsx)
├── Conversation (ai-elements/conversation.tsx)
│   ├── ConversationContent
│   │   ├── ConversationEmptyState (if no messages)
│   │   └── StreamingMessage[] (map of messages)
│   │       └── Message
│   │           └── MessageContent
│   │               ├── Loader (if streaming + no text)
│   │               ├── Response (markdown rendered text)
│   │               └── Copy button (for assistant messages)
│   └── ConversationScrollButton (shown when not at bottom)
└── Input Section (shrink-0 container)
    ├── AgentSelector (optional)
    ├── ModelSelector (optional)
    └── PromptInput
        ├── PromptInputTextarea
        └── PromptInputSubmit
```

### Component Variants

**Message variants:**
- `contained` - Colored bubbles (default)
- `flat` - Minimal styling for assistant, secondary bg for user

**PromptInput size:**
- Controlled via textarea `className` props
- Uses `field-sizing-content` for auto-resize
- `max-h-48` prevents infinite growth

**Chat variants:**
- `fullscreen` - Default, full-page experience
- `compact` - Canvas node version (same component, smaller container)

---

## Key Code Snippets

### Auto-Scroll Container Setup

```typescript
export const Conversation = ({ className, ...props }) => (
  <StickToBottom
    className={cn(
      "relative flex-1 overflow-y-auto min-h-0 flex",
      className
    )}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);
```

**Why this works:**
- `flex-1` makes it grow within flex container
- `overflow-y-auto` enables scrolling
- `min-h-0` prevents flex item from growing beyond parent
- `role="log"` for accessibility

### Conditional Scroll Button

```typescript
export const ConversationScrollButton = ({ className, ...props }) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
```

**Key details:**
- Only renders when `!isAtBottom`
- Positioned absolutely within `Conversation` container
- Centered horizontally with `left-50% translate-x--50%`
- Calls `scrollToBottom()` from context

### Enter Key Submit Handler

```typescript
const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
  if (e.key === "Enter") {
    // Don't submit during IME composition (e.g., Asian languages)
    if (isComposing || e.nativeEvent.isComposing) {
      return;
    }

    // Shift+Enter = new line
    if (e.shiftKey) {
      return;
    }

    // Enter alone = submit
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }

  // Backspace on empty field = remove last attachment
  if (
    e.key === "Backspace" &&
    e.currentTarget.value === "" &&
    attachments.files.length > 0
  ) {
    e.preventDefault();
    const lastAttachment = attachments.files.at(-1);
    if (lastAttachment) {
      attachments.remove(lastAttachment.id);
    }
  }
};
```

**Important details:**
- Respects IME composition (prevents double submission)
- Shift+Enter for multiline (browser default)
- Uses `requestSubmit()` to trigger validation
- Bonus: Backspace removes last attachment when field empty

### Message Copy Implementation

```typescript
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  if (!message.text) return;

  try {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (error) {
    console.error("Failed to copy text:", error);
  }
};

// In render:
{message.role === "assistant" && message.text && (
  <button onClick={handleCopy}>
    {copied ? (
      <><Check /><span>Copied</span></>
    ) : (
      <><Copy /><span>Copy</span></>
    )}
  </button>
)}
```

### Streaming Message with Loading State

```typescript
function StreamingMessage({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  return (
    <Message from={message.role} key={message.id}>
      <MessageContent>
        {/* Show loading only if streaming with no text yet */}
        {message.status === "streaming" && !visibleText && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        )}

        {/* Show text when available */}
        {visibleText && <Response>{visibleText}</Response>}

        {/* Copy button for complete assistant messages */}
        {message.role === "assistant" && message.text && (
          <CopyButton />
        )}
      </MessageContent>
    </Message>
  );
}
```

**State transitions:**
1. `streaming` + no text → Loading spinner
2. `streaming` + text → Smooth text animation
3. Complete → Full text + copy button

### Sticky Layout Pattern

```typescript
export function Chat({ messages, onSendMessage, ...props }) {
  return (
    <div className="flex flex-col h-full">
      {/* Scrollable message area */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map(msg => <StreamingMessage key={msg.id} message={msg} />)}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Fixed input area */}
      <div className="shrink-0 border-t">
        <div className="p-4">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea />
            <PromptInputSubmit status={isStreaming ? "streaming" : "ready"} />
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
```

**Layout breakdown:**
- Parent `h-full` ensures it fills container
- `flex flex-col` creates vertical stack
- `Conversation` with `flex-1` grows, has internal scroll
- Input area with `shrink-0` stays fixed at bottom
- `border-t` creates visual separator

---

## Configuration

### Required Dependencies

```json
{
  "dependencies": {
    "use-stick-to-bottom": "^1.1.1",
    "@convex-dev/agent": "*",
    "streamdown": "*",
    "lucide-react": "*",
    "class-variance-authority": "*"
  }
}
```

### Third-Party Setup

**use-stick-to-bottom:**
- No config needed
- Works out of the box
- Docs: https://github.com/stipsan/use-stick-to-bottom

**streamdown:**
- Markdown renderer for streaming content
- Handles partial markdown gracefully
- No config needed

**Convex Agent SDK:**
- Provides `useSmoothText` hook
- Part of Convex AI integration
- Requires Convex project setup

### CSS Requirements

**Critical utility classes:**
- `flex`, `flex-col`, `flex-1` - Flexbox layout
- `overflow-y-auto` - Enable scrolling
- `min-h-0` - Prevent flex item overflow
- `shrink-0` - Prevent shrinking
- `h-full` - Fill parent height

**Auto-resize textarea:**
- `field-sizing-content` - Browser native feature (modern browsers)
- Fallback: Use JavaScript ResizeObserver if needed

---

## Implementation Checklist

### Setup Tasks
- [ ] Install `use-stick-to-bottom` package
- [ ] Install `streamdown` package
- [ ] Set up Convex Agent SDK (if using streaming)
- [ ] Create `/components/ai-elements/` directory structure
- [ ] Add lucide-react icons

### Backend Implementation
- [ ] Create message data structure with `role`, `text`, `status`, `id`
- [ ] Implement streaming message handler
- [ ] Set up real-time message sync (e.g., Convex subscriptions)
- [ ] Create `onSendMessage` handler in parent component

### Frontend Implementation Steps

**Core Components:**
- [ ] Build `Conversation` wrapper with StickToBottom
- [ ] Build `ConversationContent` with padding
- [ ] Build `ConversationScrollButton` using context hook
- [ ] Build `Message` with role-based alignment
- [ ] Build `MessageContent` with variant styles
- [ ] Build `Response` wrapper for streamdown
- [ ] Build `PromptInput` form wrapper
- [ ] Build `PromptInputTextarea` with keyboard handlers
- [ ] Build `PromptInputSubmit` with status icons

**Chat Assembly:**
- [ ] Create `StreamingMessage` component with smooth text
- [ ] Add loading state for streaming start
- [ ] Add copy button for assistant messages
- [ ] Wire up `Conversation` components
- [ ] Wire up `PromptInput` components
- [ ] Add agent/model selectors (if needed)
- [ ] Test sticky layout with `flex` pattern

**Polish:**
- [ ] Add empty state for no messages
- [ ] Style message bubbles (user vs assistant)
- [ ] Add focus states for input
- [ ] Add disabled state for streaming
- [ ] Test keyboard shortcuts
- [ ] Test scroll behavior on mobile

### Testing Requirements
- [ ] Auto-scroll works on new messages
- [ ] Scroll stops when user manually scrolls up
- [ ] Scroll button appears/hides correctly
- [ ] Scroll button jumps to bottom
- [ ] Input stays at bottom when scrolling
- [ ] Enter submits, Shift+Enter adds newline
- [ ] IME composition doesn't double-submit
- [ ] Streaming animation is smooth
- [ ] Loading state shows before text
- [ ] Copy button works
- [ ] Copy feedback shows for 2s
- [ ] Component works in both fullscreen and compact mode
- [ ] Layout doesn't break on window resize
- [ ] Works on mobile (touch scrolling)

### Deployment Considerations
- [ ] Test on target browsers (especially `field-sizing-content` support)
- [ ] Add fallback for auto-resize textarea if needed
- [ ] Ensure z-index works for scroll button
- [ ] Test with very long messages
- [ ] Test with rapid message streams
- [ ] Monitor memory leaks in smooth text animation
- [ ] Test clipboard API permissions

---

## Common Patterns

### Dual-Size Chat Component

```typescript
// Same component, different container sizes
interface ChatProps {
  variant?: "fullscreen" | "compact";
  // ... other props
}

// Usage in full-screen page:
<Chat variant="fullscreen" messages={messages} ... />

// Usage in canvas node:
<div className="w-[400px] h-[600px]">
  <Chat variant="compact" messages={messages} ... />
</div>
```

**Don't create separate components** - use the same Chat component everywhere.

### Empty State Pattern

```typescript
{messages.length === 0 ? (
  <ConversationEmptyState
    icon={<MessageSquare className="size-12" />}
    title="Start a conversation"
    description="Send a message to begin chatting with the AI"
  />
) : (
  messages.map(msg => <StreamingMessage key={msg.id} message={msg} />)
)}
```

### Message Alignment Pattern

```typescript
// In message.tsx
<div
  className={cn(
    "group flex w-full items-end gap-2 py-4",
    from === "user"
      ? "justify-end"                        // User right-aligned
      : "flex-row-reverse justify-end",      // AI left-aligned (reversed)
  )}
>
  {/* Content here */}
</div>
```

**Why `flex-row-reverse`?**
- Keeps consistent markup order (avatar, content)
- Flips visual order for AI messages
- Both aligned to edges via `justify-end`

---

## Anti-Patterns to Avoid

### ❌ Don't manually manage scroll position
```typescript
// BAD
const scrollRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  scrollRef.current?.scrollTo({ top: 9999999 });
}, [messages]);
```

**Why?** Loses user scroll intent, no smooth behavior.

**✅ Instead:** Use `use-stick-to-bottom` library.

### ❌ Don't create separate full-screen chat component
```typescript
// BAD
<ChatNode />  // Different component
<ChatPage />  // Different component
```

**Why?** Duplicates code, creates sync issues.

**✅ Instead:** One `Chat` component with `variant` prop.

### ❌ Don't use fixed heights for chat container
```typescript
// BAD
<div className="h-[600px]">
  <Chat />
</div>
```

**Why?** Breaks responsive layouts.

**✅ Instead:** Use `h-full` and control size from parent flex/grid.

### ❌ Don't put input inside scroll container
```typescript
// BAD
<Conversation>
  <ConversationContent>
    {messages}
    <PromptInput />  {/* WRONG - will scroll away */}
  </ConversationContent>
</Conversation>
```

**Why?** Input scrolls out of view with messages.

**✅ Instead:** Sibling relationship with `shrink-0`.

---

## Performance Considerations

### Message Rendering
- Use `key={message.id}` for stable React keys
- Memoize `Response` component (prevents re-renders)
- Don't render all messages if list is huge (virtualize)

### Smooth Text Animation
- Each streaming message runs independent animation
- Monitor performance with many simultaneous streams
- Consider debouncing if >5 concurrent streams

### Scroll Performance
- `use-stick-to-bottom` uses IntersectionObserver (efficient)
- Avoid heavy renders during scroll
- Use CSS `will-change: scroll-position` if needed

### Input Auto-Resize
- Modern `field-sizing-content` is performant
- If using JS fallback, debounce resize calculations
- Set `max-h-48` to prevent runaway growth

---

## Accessibility

### Semantic HTML
- `role="log"` on Conversation container
- Form submission via Enter (keyboard accessible)
- Focus management in input

### ARIA Labels
- `aria-label` on submit button
- `aria-label` on scroll button
- `aria-label` on file input

### Keyboard Navigation
- Tab through selectors and input
- Enter/Shift+Enter for submission
- Focus visible states

### Screen Readers
- Messages announce as they arrive (role="log")
- Loading states announced
- Button states announced (copied, streaming, etc.)

---

## Troubleshooting

### Scroll doesn't stick to bottom
- Check `flex-1` on Conversation
- Check `min-h-0` on scrollable container
- Verify parent has fixed height (`h-full` chain)

### Input not staying at bottom
- Check `shrink-0` on input container
- Verify it's **outside** Conversation
- Check parent is `flex flex-col`

### Enter key not submitting
- Check `requestSubmit()` browser support
- Verify form wrapper exists
- Check `isComposing` state for IME

### Smooth text not animating
- Verify `useSmoothText` hook usage
- Check `startStreaming` condition
- Ensure `message.status === "streaming"`

### Messages not updating
- Check React keys are stable (`message.id`)
- Verify parent re-renders on new messages
- Check Convex subscriptions are active

---

## Summary

**Core Architecture:**
- `use-stick-to-bottom` for smart auto-scrolling
- Flexbox sticky layout (`flex-1` + `shrink-0`)
- Convex `useSmoothText` for streaming animation
- `streamdown` for markdown rendering

**Critical CSS Pattern:**
```typescript
<div className="flex flex-col h-full">
  <Conversation className="flex-1">...</Conversation>
  <div className="shrink-0">
    <PromptInput />
  </div>
</div>
```

**Key Behaviors:**
- Auto-scroll when at bottom
- Stop auto-scroll when user scrolls up
- Show scroll button when not at bottom
- Input always visible at bottom
- Smooth streaming animation
- Enter submits, Shift+Enter newline

**Libraries:**
- `use-stick-to-bottom` (scroll management)
- `streamdown` (markdown)
- `@convex-dev/agent` (smooth text)
- `lucide-react` (icons)

This pattern is production-ready and powers real chat interfaces handling thousands of messages with smooth UX.
