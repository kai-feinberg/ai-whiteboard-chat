# Sprawl AI

An infinite canvas for AI conversations with rich context inputs. Add YouTube videos, websites, TikToks, Facebook ads, and more to your canvas—then chat with AI agents that understand the full context.

## What It Is

Sprawl AI is a visual workspace where you can:

- **Drop content anywhere** - YouTube videos, websites, social media posts, text, PDFs
- **Connect ideas visually** - Infinite canvas with draggable nodes and connections
- **Chat with context** - AI agents access connected nodes on your canvas for rich, contextual conversations
- **Collaborate in teams** - Share canvases and continue each other's chats via organizations
- **Reuse processed content** - Add processed nodes across multiple canvases without re-processing

Think Miro + ChatGPT with automatic context gathering.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React)                             │
│                        Tanstack Start + Router                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Canvas     │  │  Chat View   │  │   Settings   │                 │
│  │   Editor     │  │ (Full Screen)│  │   & Agents   │                 │
│  │              │  │              │  │              │                 │
│  │  @xyflow/    │  │  Reusable    │  │  Custom      │                 │
│  │   react      │  │  Component   │  │  Agents      │                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│         │                 │                 │                         │
│         └─────────────────┴─────────────────┘                         │
│                           │                                           │
└───────────────────────────┼───────────────────────────────────────────┘
                            │
                   ┌────────▼─────────┐
                   │   Clerk Auth     │
                   │  Organizations   │
                   └────────┬─────────┘
                            │
┌───────────────────────────┼───────────────────────────────────────────┐
│                           │     CONVEX BACKEND                        │
│                           │  (Real-time Serverless)                   │
├───────────────────────────┴───────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│  │  Queries        │   │   Mutations     │   │    Actions      │   │
│  │  (Read Data)    │   │  (Write Data)   │   │  (External APIs)│   │
│  │                 │   │                 │   │                 │   │
│  │ • getCanvas     │   │ • createNode    │   │ • scrapeYouTube │   │
│  │ • listCanvases  │   │ • updateNode    │   │ • scrapeWebsite │   │
│  │ • getThread     │   │ • deleteNode    │   │ • scrapeTikTok  │   │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘   │
│           │                     │                     │            │
│           └─────────────────────┴─────────────────────┘            │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                   DATABASE SCHEMA                           │  │
│  │                                                              │  │
│  │  canvases          ─┬─> canvas_nodes ──> text_nodes        │  │
│  │    │                │       │              chat_nodes        │  │
│  │    │                │       │              youtube_nodes     │  │
│  │    │                │       │              website_nodes     │  │
│  │    │                │       │              tiktok_nodes      │  │
│  │    │                │       │              facebook_ads      │  │
│  │    │                │       │              group_nodes       │  │
│  │    │                │       │                                │  │
│  │    │                └──> canvas_edges (connections)          │  │
│  │    │                                                         │  │
│  │    └────────────────────> threads (AI conversations)        │  │
│  │                                                              │  │
│  │  custom_agents (org-scoped AI configurations)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              CONVEX AI COMPONENTS                            │  │
│  │                                                              │  │
│  │  • Agent Component  - Thread management & usage tracking    │  │
│  │  • Workflow Elements - Node/edge system for canvas          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────────┐
│                     EXTERNAL SERVICES                                 │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Firecrawl   │  │   OpenAI     │  │   Anthropic  │              │
│  │  (Scraping)  │  │  (GPT Models)│  │   (Claude)   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

DATA FLOW:
1. User drops YouTube link on canvas
2. Frontend calls Convex mutation → creates canvas_node + youtube_node
3. Convex action → Firecrawl fetches transcript
4. Real-time update → Frontend reactively shows completed node
5. User opens chat → getNodeContext gathers all connected nodes
6. AI agent receives combined context from all nodes
7. Response streams back via Convex AI component
```

## Core Concepts

### Multi-Tenant Organizations

**Everything is scoped to organizations:**
- Users can have personal org + be invited to team orgs
- Teams share canvases and can continue each other's chats
- All data (canvases, nodes, threads) belongs to `organizationId` + `canvasId`

### Node Architecture

**Two-table pattern:**
1. `canvas_nodes` - Stores position, size, type, notes
2. Type-specific table - Stores actual content (e.g., `youtube_nodes`, `text_nodes`)

**Node Types:**
- **Text** - Markdown notes
- **Chat** - AI conversations with thread management
- **YouTube** - Video transcripts (via Firecrawl)
- **Website** - Scraped page content + screenshots
- **TikTok** - Video transcripts
- **Facebook Ads** - Ad Library content with media
- **Groups** - Container nodes that aggregate child context

### Context Gathering

Each node type implements `getNodeContextInternal` to select what data gets passed to AI:

```typescript
// Example: YouTube node context
{
  type: "youtube",
  title: "Video Title",
  url: "https://youtube.com/...",
  transcript: "Full video transcript...",
  notes: "User added notes"
}
```

When user chats, all connected nodes' context is gathered and sent to AI.

### Chat System

**Reusable component pattern:**
- Chat component takes `size` prop (node vs full-screen)
- Same thread works as canvas node AND dedicated page
- Supports multiple AI models and custom agents
- Real-time streaming responses

### Content Reusability

Add processed nodes across canvases without re-processing:
- YouTube transcript fetched once, reused everywhere
- Scraped websites stored once, referenced multiple times
- Reduces costs and improves performance

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Tanstack Start | React meta-framework with file-based routing |
| **Canvas** | @xyflow/react | Infinite canvas with drag-drop nodes |
| **Database** | Convex | Real-time serverless database |
| **Auth** | Clerk | Authentication with Organizations |
| **AI** | Convex Agent | Thread management, usage tracking |
| **Scraping** | Firecrawl | YouTube, websites, social media |
| **UI** | Radix UI + TailwindCSS | Accessible components + utility styling |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Convex account (free tier available)
- Clerk account (free tier available)
- Firecrawl API key (optional for scraping)

### Installation

```bash
# Clone repo
git clone <repo-url>
cd ai-whiteboard-chat

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in Clerk and Convex credentials

# Start development server
pnpm dev
```

### Environment Variables

```bash
# Clerk (Authentication)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=...

# Convex (Database)
VITE_CONVEX_URL=https://...convex.cloud
CONVEX_DEPLOYMENT=...

# Firecrawl (Scraping - Optional)
FIRECRAWL_API_KEY=fc-...

# OpenAI (AI Models - Optional)
OPENAI_API_KEY=sk-...
```

### Development

```bash
# Start dev server (web + Convex)
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```
ai-whiteboard-chat/
├── src/
│   ├── routes/              # File-based routing
│   │   ├── __root.tsx       # Root layout with auth providers
│   │   ├── index.tsx        # Canvas list dashboard
│   │   └── canvas/
│   │       └── $canvasId/
│   │           ├── index.tsx       # Canvas editor
│   │           └── chat.$threadId/ # Full-screen chat
│   ├── components/
│   │   ├── ai-elements/     # Canvas node components
│   │   ├── chat/            # Reusable chat interface
│   │   └── ui/              # Radix UI components
│   └── features/            # Feature-based modules
│       └── [feature]/
│           ├── README.md    # Feature documentation
│           ├── components/  # Feature UI
│           ├── hooks/       # Smart hooks with auth
│           ├── types.ts     # TypeScript types
│           └── utils.ts     # Pure functions
│
├── convex/
│   ├── schema.ts            # Database schema
│   ├── auth.config.ts       # Clerk integration
│   ├── canvases.ts          # Canvas CRUD
│   ├── nodes.ts             # Node management
│   ├── chat.ts              # Chat threads
│   ├── youtube.ts           # YouTube scraping
│   ├── website.ts           # Website scraping
│   ├── tiktok.ts            # TikTok scraping
│   └── agents.ts            # Custom agents
│
└── CLAUDE.md                # Development guide (READ THIS!)
```

## How to Use

### 1. Create a Canvas

Navigate to home page → Click "New Canvas" → Name your workspace

### 2. Add Nodes

**From toolbar:**
- Text node - Quick notes
- YouTube - Paste URL, auto-fetches transcript
- Website - Scrape any webpage
- TikTok - Extract video content
- Facebook Ad - Ad Library content
- Chat - Start AI conversation

**Drag and position** nodes anywhere on infinite canvas

### 3. Connect Nodes

Draw edges between nodes to show relationships. Chat nodes automatically gather context from connected nodes.

### 4. Chat with Context

Open chat node → Ask questions → AI sees context from all connected nodes

**Full-screen mode:** Click expand icon for dedicated chat page with same thread

### 5. Custom Agents

Settings → Custom Agents → Create specialized bots with custom prompts (e.g., "VSL Writer", "Ideation Bot")

### 6. Collaborate

Invite team members via Clerk Organizations → Share canvases → Continue each other's threads

## Development Philosophy

### Speed Over Perfection

- Ship features fast, iterate based on feedback
- Choose scrappiest solution that solves core problem
- Users tolerate manual workarounds for real value

### Simple Over Robust

- Avoid over-engineering
- Start with simple patterns
- Add complexity only when needed

### Context-First

- Make it easy to feed AI rich context
- Show users what context costs
- Transparent pricing and usage

## Credits & Pricing

- Organization-scoped credits (not user-scoped)
- Live deduction with real-time updates
- Transparent usage display
- Different rates per AI model
- Top-up purchases available

## License

MIT

## Support

For issues or questions:
- GitHub Issues
- Documentation in `CLAUDE.md`
- Feature READMEs in `/features/`

---