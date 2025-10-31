# Poppy Clone - Product Spec

## Tech Stack
- **Frontend:** Next.js
- **Backend:** Convex
- **Auth:** Clerk (with organizations support)
- **Scraping:** Firecrawl
- **AI:** Convex AI agent component to manage threads, track usage, etc
- **Whiteboard:** AI sdk workflow elements (handle edges, nodes, connections, etc)
- **Pricing/Usage:** Autumn pricing

## Core Features (MVP)

### Canvas System
- **Node Types (Priority Order):**
  Essential: 
    chat node with threads, different agents, different models that can connect to other nodes
    text nodes
  1. YouTube videos (with transcript)
  2. Twitter/X posts
  3. Voice notes
  4. TikTok, instagram, facebook ads
  5. PDF/Google Docs uploads

- **Groups:** Container nodes that hold multiple nodes with function to retrieve combined context

### AI Chat Interface
- Multiple configurable agents per canvas
- Full-screen chat view (separate page/URL for easier sharing/management)
- Chat component renders at different sizes via prop (reusable between canvas node and full-screen page)
- Auth check via beforeLoad hook on full-screen routes

### Node Architecture
**Display vs. Context Pattern:**
- Display: What users see (YouTube embed, tweet via react-tweet, etc.)
- Context: What gets passed to AI (transcript, tweet text, file content)
- Each node has "notes" field users can add
- Clear UI showing what context goes into model + pricing

**Schema Approach:**
- Separate table per node type
- Canvas stores: node positions + references to node IDs
- Enables easy reconstruction and type-specific handling

**Component Reusability**
Chat component takes size prop to work both as canvas node and full-screen page
Avoid embedding full page as node - recreate with shared component instead

## Organizations & Scoping

### Clerk Organizations
- Everything scoped to organization + canvas (not individual users)
- Users can have personal org + be invited to team orgs
- Teams can share canvases, continue each other's chats

## Pricing Tiers

### Tier Structure
**Base Tier:**
- Solo use or 5 people max
- 3 canvases
- Included credits

**Higher Tier:**
- 20 people
- Unlimited canvases
- More included credits

### Credit System
- Organization-scoped credits
- Live deduction using Convex
- Top-up purchases available
- Transparent usage (unlike Poppy)
- Leverage Convex Thread and AI agent component for usage tracking

## Nice-to-Have Features

### Most important: Content Reusability
- Reuse uploaded/processed nodes across canvases
- No re-downloading/re-transcribing required
- Save YouTube videos, tweets, documents for quick re-use

### Sharing & Collaboration
- Public chat node from canvas sharing
- Rate limiting via Convex component for public shares
- Usage billed to org owner

### AI Output Nodes
- Generate downloadable documents/PDFs from chat
- AI can create nodes on canvas via tool calls
- Image generation (Banana-type tool)
- Text node generation with content setting

### Model Options
- OpenAI (GPT-4, GPT-4 mini)
- Claude (Haiku, Sonnet)
- Grok models
- Qwen models (fast options)
- Bill differently per model

### Custom Agents/Prompts
- Org-level custom bot configuration
- Preset bots (e.g., "Ideation")
- Custom bots (e.g., "VSL Writer" with custom prompt)
- Available in chat interface dropdown

### Future Ideas
- View-only canvas mode
- Canvas preview alongside full-screen chat

## Technical Notes

### File Storage
- Use Convex file storage

### Third-Party Integrations
- react-tweet library for Twitter embeds
- Check YouPac for YouTube implementation reference

### Chat Thread Management
- Pass thread ID to chat component
- Consistent rendering between canvas node and full-screen page

## Why Build This?

1. **Context Management:** AI struggles with non-text inputs; this handles transcription and formatting automatically
2. **Cross-Chat Context:** Difficult to reuse prompts/context across conversations currently
3. **Agent Specificity:** Custom system prompts + context + multiple agents = better, personalized outputs
4. **Social Media Integration:** Work directly with YouTube, Twitter, etc. without manual workarounds