# Deep Search & Social Media Search - Complete Implementation Guide

> A comprehensive guide for implementing AI-powered TikTok search and filtered web search features. This document contains everything needed to recreate these features in another application.

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack & Dependencies](#tech-stack--dependencies)
3. [Architecture](#architecture)
4. [Backend Implementation](#backend-implementation)
   - [Agent Configuration](#agent-configuration)
   - [TikTok Search Tool](#tiktok-search-tool)
   - [Filtered Web Search Tool](#filtered-web-search-tool)
   - [Thread Management](#thread-management)
5. [External API Integrations](#external-api-integrations)
6. [Frontend Implementation](#frontend-implementation)
7. [Data Types & Schemas](#data-types--schemas)
8. [Environment Configuration](#environment-configuration)
9. [Complete Code Reference](#complete-code-reference)

---

## Overview

This system implements an AI chat application with two specialized search capabilities:

1. **TikTok Search** - Searches TikTok via Scrape Creators API, fetches video metadata and transcripts, returns structured results with creator info and engagement stats.

2. **Filtered Web Search** - Searches the web via Exa API, then filters results through Claude Haiku to remove spam, promotional content, and paywalled articles.

**Key Features:**
- Real-time streaming responses (word-by-word)
- Tool execution visualization with loading states
- Rich UI cards for TikTok videos and web articles
- Transparency on filtered content (shows rejection reasons)
- Thread-based conversation management

---

## Tech Stack & Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "@convex-dev/agent": "^0.2.11",
    "ai": "^6.0.39",
    "@openrouter/ai-sdk-provider": "^2.0.0",
    "exa-js": "^2.0.12",
    "convex": "^1.27.3",
    "zod": "^4.1.11",

    "@tanstack/react-router": "^1.132.2",
    "@tanstack/react-start": "^1.132.2",
    "@clerk/tanstack-react-start": "^0.26.3",

    "lucide-react": "^0.544.0",
    "@radix-ui/react-collapsible": "^1.1.12"
  }
}
```

### Key Libraries

| Library | Purpose |
|---------|---------|
| `@convex-dev/agent` | AI agent framework with threading, streaming, tool calls |
| `ai` | Vercel AI SDK for tool definitions |
| `@openrouter/ai-sdk-provider` | OpenRouter provider for Claude models |
| `exa-js` | Web search API client |
| `convex` | Serverless backend with real-time subscriptions |
| `zod` | Schema validation for tool inputs/outputs |

---

## Architecture

```
User Input
    │
    ▼
┌─────────────────────────────────┐
│  Frontend (React/TanStack)      │
│  - PromptInput component        │
│  - useUIMessages hook           │
│  - useSmoothText for streaming  │
└─────────────────────────────────┘
    │
    ▼ sendMessage action
┌─────────────────────────────────┐
│  Convex Backend                 │
│  ┌───────────────────────────┐  │
│  │  Deep Search Agent        │  │
│  │  (Claude Haiku 4.5)       │  │
│  │                           │  │
│  │  Tools:                   │  │
│  │  - searchTikTok           │  │
│  │  - filteredWebSearch      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
    │                    │
    ▼                    ▼
┌──────────────┐  ┌──────────────────┐
│ Scrape       │  │ Exa API          │
│ Creators API │  │ (Web Search)     │
│ (TikTok)     │  │        │         │
└──────────────┘  │        ▼         │
                  │ Claude Haiku     │
                  │ (Filtering)      │
                  └──────────────────┘
```

---

## Backend Implementation

### Agent Configuration

**File: `convex/agent/index.ts`**

```typescript
import { Agent } from "@convex-dev/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { components } from "../_generated/api";
import { searchTikTok, filteredWebSearch } from "./tools";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const deepSearchAgent = new Agent(components.agent, {
  name: "Deep Search Agent",
  languageModel: openrouter.chat("anthropic/claude-haiku-4.5"),

  instructions: `You are a helpful AI assistant that specializes in finding insights from TikTok content.

When users ask questions about products, topics, trends, or recommendations:

1. For social media insights and creator opinions: Use searchTikTok to find relevant videos
2. For web research, articles, and factual information: Use filteredWebSearch to get curated articles

Guidelines for searchTikTok:
- Use for product recommendations, trends, lifestyle tips
- Analyze transcripts and synthesize what creators are saying
- Mention which creators provided helpful information

Guidelines for filteredWebSearch:
- Use for current events, technical info, in-depth articles
- Results are pre-filtered for quality (no spam, promotional, or paywalled content)
- Synthesize information from the full article text provided
- Reference sources in your response

Be conversational and helpful. Be honest if search results don't fully answer the question.`,

  tools: { searchTikTok, filteredWebSearch },
  maxSteps: 10, // Allow multiple tool calls for complex queries
});
```

---

### TikTok Search Tool

**File: `convex/agent/tools.ts`**

```typescript
import { tool, zodSchema } from "ai";
import { z } from "zod/v3";

// ============================================================
// TYPES
// ============================================================

interface TikTokSearchResponse {
  success: boolean;
  credits_remaining: number;
  search_item_list: TikTokItem[];
  cursor: number;
}

interface TikTokItem {
  aweme_id: string;
  desc: string;
  url: string;
  statistics: {
    play_count: number;
    digg_count: number;
    share_count: number;
    comment_count?: number;
  };
  video: {
    cover: {
      url_list: string[];
    };
    duration?: number;
  };
  author: {
    unique_id: string;
    nickname?: string;
    follower_count: number;
  };
  create_time?: number;
}

export interface TikTokVideoResult {
  tiktokId: string;
  videoUrl: string;
  thumbnailUrl: string;
  creatorHandle: string;
  views: number;
  likes: number;
  shares: number;
  transcript: string;
}

interface TranscriptResponse {
  id: string;
  url: string;
  transcript: string;
}

interface SearchTikTokResult {
  success: boolean;
  videos: TikTokVideoResult[];
  totalFound?: number;
  message?: string;
  error?: string;
}

// ============================================================
// WEBVTT PARSER
// ============================================================

/**
 * Parse WebVTT transcript to plain text
 * WebVTT format: "WEBVTT\n\n00:00:00.120 --> 00:00:01.840\nText here\n\n..."
 */
function parseWebVTT(webvtt: string): string {
  if (!webvtt || !webvtt.trim()) {
    return "[No speech detected]";
  }

  const lines = webvtt.split("\n");
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, WEBVTT header, timestamp lines, and cue identifiers
    if (
      !trimmed ||
      trimmed === "WEBVTT" ||
      trimmed.includes("-->") ||
      /^\d+$/.test(trimmed)
    ) {
      continue;
    }
    textLines.push(trimmed);
  }

  const text = textLines.join(" ").trim();
  return text || "[No speech detected]";
}

// ============================================================
// TRANSCRIPT FETCHING
// ============================================================

/**
 * Fetch transcript for a single TikTok video
 */
async function fetchTranscript(videoUrl: string): Promise<string> {
  const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
  if (!apiKey) {
    return "[No speech detected]";
  }

  try {
    const url = new URL(
      "https://api.scrapecreators.com/v1/tiktok/video/transcript"
    );
    url.searchParams.set("url", videoUrl);
    url.searchParams.set("language", "en");
    url.searchParams.set("use_ai_as_fallback", "false");

    const response = await fetch(url.toString(), {
      headers: { "x-api-key": apiKey },
    });

    if (!response.ok) {
      return "[No speech detected]";
    }

    const data: TranscriptResponse = await response.json();

    if (!data.transcript) {
      return "[No speech detected]";
    }

    return parseWebVTT(data.transcript);
  } catch {
    return "[No speech detected]";
  }
}

// ============================================================
// TIKTOK SEARCH
// ============================================================

/**
 * Search TikTok for videos via Scrape Creators API
 * Fetches search results then fetches transcripts for all videos in parallel
 */
async function fetchTikTokSearch(
  query: string,
  limit: number = 10
): Promise<TikTokVideoResult[]> {
  const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPE_CREATORS_API_KEY not configured");
  }

  const url = new URL(
    "https://api.scrapecreators.com/v1/tiktok/search/keyword"
  );
  url.searchParams.set("query", query);
  url.searchParams.set("trim", "true");
  url.searchParams.set("sort_by", "most-liked");

  const response = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401) {
      throw new Error("Invalid API key");
    }
    if (status === 429) {
      throw new Error("Rate limit exceeded - please try again later");
    }
    throw new Error(`TikTok search failed: ${status} ${response.statusText}`);
  }

  const data: TikTokSearchResponse = await response.json();

  if (!data.success || !data.search_item_list?.length) {
    return [];
  }

  const items = data.search_item_list.slice(0, limit);

  // Map items to partial results (without transcripts)
  const partialResults = items.map((item) => ({
    tiktokId: item.aweme_id || "",
    videoUrl: item.url || "",
    thumbnailUrl: item.video?.cover?.url_list?.[0] || "",
    creatorHandle: item.author?.unique_id || "unknown",
    views: item.statistics?.play_count ?? 0,
    likes: item.statistics?.digg_count ?? 0,
    shares: item.statistics?.share_count ?? 0,
  }));

  // Fetch transcripts for all videos in parallel
  const transcripts = await Promise.all(
    partialResults.map((video) => fetchTranscript(video.videoUrl))
  );

  // Combine results with transcripts
  return partialResults.map((video, index) => ({
    ...video,
    transcript: transcripts[index],
  }));
}

// ============================================================
// TOOL DEFINITION
// ============================================================

const searchTikTokInputSchema = z.object({
  query: z.string().describe("Search query (e.g., 'best umbrellas for rain')"),
});

type SearchTikTokInput = z.infer<typeof searchTikTokInputSchema>;

export const searchTikTok = tool({
  description:
    "Search TikTok for videos about a topic. Returns videos with view counts, likes, shares, creator handles, and transcripts of what creators said. Use this when users ask about products, trends, recommendations, or any topic that could benefit from real social media insights.",
  inputSchema: zodSchema(searchTikTokInputSchema),
  execute: async ({ query }: SearchTikTokInput): Promise<SearchTikTokResult> => {
    try {
      const videos = await fetchTikTokSearch(query, 10);

      if (videos.length === 0) {
        return {
          success: true,
          videos: [],
          message: `No TikTok videos found for "${query}"`,
        };
      }

      return {
        success: true,
        videos,
        totalFound: videos.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        videos: [],
        error: message,
      };
    }
  },
});
```

---

### Filtered Web Search Tool

**File: `convex/agent/tools.ts` (continued)**

```typescript
import { generateText } from "ai";
import Exa from "exa-js";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================================
// TYPES
// ============================================================

export interface ExaSearchResult {
  id: string;
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text: string;
  image?: string;
  favicon?: string;
}

export interface FilterCriteria {
  rejectPromotional?: boolean;
  rejectSpam?: boolean;
  rejectPaywalled?: boolean;
}

export interface FilterResult {
  accepted: boolean;
  reason: string;
}

export interface FilteredResults {
  accepted: ExaSearchResult[];
  rejected: Array<ExaSearchResult & { rejectionReason: string }>;
}

export interface FilteredWebSearchResult {
  success: boolean;
  accepted: Array<{
    url: string;
    title: string;
    author?: string;
    publishedDate?: string;
    text: string;
    summary: string;
    image?: string;
    favicon?: string;
  }>;
  rejected: Array<{
    url: string;
    title: string;
    reason: string;
    summary: string;
  }>;
  searchTime: number;
  filterTime: number;
  message?: string;
  error?: string;
}

// ============================================================
// EXA SEARCH
// ============================================================

export async function fetchExaSearch(
  query: string,
  limit: number = 10
): Promise<ExaSearchResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY not configured");
  }

  const exa = new Exa(apiKey);

  try {
    const response = await exa.searchAndContents(query, {
      text: true,
      type: "auto",
      numResults: limit,
    });

    if (!response.results || response.results.length === 0) {
      return [];
    }

    return response.results.map((result) => ({
      id: result.id || "",
      title: result.title || "",
      url: result.url || "",
      publishedDate: result.publishedDate || undefined,
      author: result.author || undefined,
      text: result.text || "",
      image: result.image || undefined,
      favicon: result.favicon || undefined,
    }));
  } catch (error) {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("unauthorized") || msg.includes("401")) {
        throw new Error("Invalid Exa API key");
      }
      if (msg.includes("rate") || msg.includes("429")) {
        throw new Error("Exa rate limit exceeded - please try again later");
      }
      throw new Error(`Exa search failed: ${error.message}`);
    }
    throw new Error("Exa search failed: Unknown error");
  }
}

// ============================================================
// HAIKU FILTERING
// ============================================================

const filterResultSchema = z.object({
  accepted: z.boolean(),
  reason: z.string(),
});

/**
 * Evaluate a single search result using Haiku
 * Uses fail-open design: accepts results if API fails
 */
async function evaluateResultWithHaiku(
  result: ExaSearchResult,
  criteria: FilterCriteria
): Promise<FilterResult> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { accepted: true, reason: "No filter configured" };
  }

  const criteriaList: string[] = [];
  if (criteria.rejectPromotional !== false) {
    criteriaList.push(
      "- Is this promotional content pushing a product/service?"
    );
  }
  if (criteria.rejectSpam !== false) {
    criteriaList.push(
      "- Is this spam or low-quality aggregated content? Ie top 12 best XXX to try"
    );
  }
  if (criteria.rejectPaywalled !== false) {
    criteriaList.push("- Is this paywalled or requires signup to read?");
  }

  if (criteriaList.length === 0) {
    return { accepted: true, reason: "No filter criteria" };
  }

  try {
    const { text } = await generateText({
      model: openrouter("anthropic/claude-haiku-4.5"),
      system: `You evaluate search results for quality. You MUST respond with ONLY a JSON object, no other text.
Format: {"accepted": boolean, "reason": "string"}
Example accept: {"accepted": true, "reason": "Quality content"}
Example reject: {"accepted": false, "reason": "Promotional content for X brand"}`,
      prompt: `Evaluate this search result:

Title: ${result.title || "Untitled"}
URL: ${result.url}
Summary: ${(result.text || "").slice(0, 500)}

Reject if ANY apply:
${criteriaList.join("\n")}

Respond with JSON only:`,
      temperature: 0,
    });

    // Parse JSON - handle potential markdown wrapping
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    const parsed = filterResultSchema.parse(JSON.parse(jsonStr));
    return { accepted: parsed.accepted, reason: parsed.reason };
  } catch (error) {
    console.error("Haiku filter error:", error);
    return { accepted: true, reason: "Filter error" }; // Fail-open
  }
}

/**
 * Filter search results through Haiku (parallel evaluation)
 */
export async function filterSearchResults(
  results: ExaSearchResult[],
  criteria: FilterCriteria = {}
): Promise<FilteredResults> {
  if (results.length === 0) {
    return { accepted: [], rejected: [] };
  }

  const effectiveCriteria: FilterCriteria = {
    rejectPromotional: criteria.rejectPromotional ?? true,
    rejectSpam: criteria.rejectSpam ?? true,
    rejectPaywalled: criteria.rejectPaywalled ?? true,
  };

  // Evaluate all results in parallel
  const evaluations = await Promise.all(
    results.map((result) => evaluateResultWithHaiku(result, effectiveCriteria))
  );

  const accepted: ExaSearchResult[] = [];
  const rejected: Array<ExaSearchResult & { rejectionReason: string }> = [];

  results.forEach((result, index) => {
    const evaluation = evaluations[index];
    if (evaluation.accepted) {
      accepted.push(result);
    } else {
      rejected.push({ ...result, rejectionReason: evaluation.reason });
    }
  });

  return { accepted, rejected };
}

// ============================================================
// TOOL DEFINITION
// ============================================================

const filteredWebSearchInputSchema = z.object({
  query: z.string().describe("Search query for web articles"),
});

type FilteredWebSearchInput = z.infer<typeof filteredWebSearchInputSchema>;

export const filteredWebSearch = tool({
  description:
    "Search the web for articles and automatically filter out promotional content, spam, and paywalled articles. Returns curated, high-quality search results with full article text. Use this for informational queries that need web research, current events, product reviews, or technical information.",
  inputSchema: zodSchema(filteredWebSearchInputSchema),
  execute: async ({
    query,
  }: FilteredWebSearchInput): Promise<FilteredWebSearchResult> => {
    try {
      // Phase 1: Search via Exa
      const searchStart = Date.now();
      const searchResults = await fetchExaSearch(query, 10);
      const searchTime = Date.now() - searchStart;

      if (searchResults.length === 0) {
        return {
          success: true,
          accepted: [],
          rejected: [],
          searchTime,
          filterTime: 0,
          message: `No web results found for "${query}"`,
        };
      }

      // Phase 2: Filter through Haiku
      const filterStart = Date.now();
      const filtered = await filterSearchResults(searchResults);
      const filterTime = Date.now() - filterStart;

      // Transform to output format
      const accepted = filtered.accepted.map((r) => ({
        url: r.url,
        title: r.title,
        author: r.author,
        publishedDate: r.publishedDate,
        text: r.text,
        summary: r.text.slice(0, 300) + (r.text.length > 300 ? "..." : ""),
        image: r.image,
        favicon: r.favicon,
      }));

      const rejected = filtered.rejected.map((r) => ({
        url: r.url,
        title: r.title,
        reason: r.rejectionReason,
        summary: r.text.slice(0, 200) + (r.text.length > 200 ? "..." : ""),
      }));

      return {
        success: true,
        accepted,
        rejected,
        searchTime,
        filterTime,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        accepted: [],
        rejected: [],
        searchTime: 0,
        filterTime: 0,
        error: message,
      };
    }
  },
});
```

---

### Thread Management

**File: `convex/agent/threads.ts`**

```typescript
import { action, query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { deepSearchAgent } from "./index";

/**
 * Create a new conversation thread
 */
export const createThread = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const { threadId } = await deepSearchAgent.createThread(ctx, {
      userId,
      title: "New Chat",
    });

    return { threadId };
  },
});

/**
 * List all threads for authenticated user (newest first)
 */
export const listThreads = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    const result = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId,
        order: "desc",
        paginationOpts: { cursor: null, numItems: 100 },
      }
    );

    return result.page;
  },
});

/**
 * Delete a thread (owner only)
 */
export const deleteThread = action({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== userId) {
      throw new Error("Not authorized to delete this thread");
    }

    await ctx.runAction(components.agent.threads.deleteAllForThreadIdSync, {
      threadId,
    });

    return { success: true };
  },
});

/**
 * Update thread title (owner only)
 */
export const updateThreadTitle = action({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { threadId, title }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== userId) {
      throw new Error("Not authorized to update this thread");
    }

    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { title },
    });

    return { success: true };
  },
});

/**
 * Send message and stream AI response
 * Uses word chunking with 100ms throttle for smooth UI rendering
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { threadId, message }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== userId) {
      throw new Error("Not authorized to send to this thread");
    }

    // Stream response with delta saves for frontend subscription
    const result = await (deepSearchAgent as any).streamText(
      ctx,
      { threadId },
      { prompt: message },
      {
        saveStreamDeltas: {
          chunking: "word",
          throttleMs: 100,
        },
      }
    );

    await result.consumeStream();
    const responseText = await result.text;

    return { success: true, response: responseText, threadId };
  },
});

/**
 * List messages with streaming support
 * Returns paginated messages + stream deltas for in-progress responses
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      const emptyStreams = await syncStreams(ctx, components.agent, {
        ...args,
        threadId: args.threadId,
      });
      return {
        page: [] as Awaited<ReturnType<typeof listUIMessages>>["page"],
        isDone: true,
        continueCursor: "",
        streams: emptyStreams,
      };
    }

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread || thread.userId !== identity.subject) {
      const emptyStreams = await syncStreams(ctx, components.agent, {
        ...args,
        threadId: args.threadId,
      });
      return {
        page: [] as Awaited<ReturnType<typeof listUIMessages>>["page"],
        isDone: true,
        continueCursor: "",
        streams: emptyStreams,
      };
    }

    const paginated = await listUIMessages(ctx, components.agent, args);
    const streams = await syncStreams(ctx, components.agent, args);

    return { ...paginated, streams };
  },
});
```

---

## External API Integrations

### 1. Scrape Creators API (TikTok)

**Search Endpoint:**
```
GET https://api.scrapecreators.com/v1/tiktok/search/keyword
Headers: x-api-key: {SCRAPE_CREATORS_API_KEY}
Params:
  - query: Search term
  - trim: true
  - sort_by: most-liked
```

**Transcript Endpoint:**
```
GET https://api.scrapecreators.com/v1/tiktok/video/transcript
Headers: x-api-key: {SCRAPE_CREATORS_API_KEY}
Params:
  - url: TikTok video URL
  - language: en
  - use_ai_as_fallback: false
```

**Cost:** 1 search credit + N transcript credits (N = number of videos)

### 2. Exa API (Web Search)

```typescript
const exa = new Exa(process.env.EXA_API_KEY);
const response = await exa.searchAndContents(query, {
  text: true,      // Include full article text
  type: "auto",    // Auto-detect content type
  numResults: 10,  // Max results
});
```

### 3. OpenRouter (Claude Models)

```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// For agent
openrouter.chat("anthropic/claude-haiku-4.5")

// For filtering
const { text } = await generateText({
  model: openrouter("anthropic/claude-haiku-4.5"),
  temperature: 0,
  // ...
});
```

---

## Frontend Implementation

### Chat Page Component

**File: `src/routes/chat.$threadId.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useUIMessages, useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { useState, memo, useCallback } from "react";
import { Loader2, ExternalLink, Eye, Heart, Share2, ChevronDown } from "lucide-react";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return text.replace(/&(?:amp|lt|gt|quot|#039|apos|nbsp);/g, (match) => entities[match] || match);
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

// ============================================================
// TYPES
// ============================================================

interface TikTokVideo {
  tiktokId: string;
  videoUrl: string;
  thumbnailUrl: string;
  creatorHandle: string;
  views: number;
  likes: number;
  shares: number;
  transcript: string;
}

interface AcceptedWebResult {
  url: string;
  title: string;
  author?: string;
  publishedDate?: string;
  text: string;
  summary: string;
  image?: string;
  favicon?: string;
}

interface RejectedWebResult {
  url: string;
  title: string;
  reason: string;
  summary: string;
}

type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error";

interface ToolPart {
  type: `tool-${string}`;
  toolCallId: string;
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

// ============================================================
// TIKTOK CARD COMPONENT
// ============================================================

function TikTokCard({ video }: { video: TikTokVideo }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="w-64 flex-shrink-0 overflow-hidden hover:shadow-lg">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="relative aspect-[9/16] w-full max-h-32 overflow-hidden bg-muted">
              {video.thumbnailUrl && (
                <img
                  src={video.thumbnailUrl}
                  alt={`Video by ${video.creatorHandle}`}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <CardContent className="p-3.5">
              <p className="font-semibold text-sm truncate">@{video.creatorHandle}</p>
              <div className="flex items-center gap-3 mt-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  {formatNumber(video.views)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5" />
                  {formatNumber(video.likes)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5" />
                  {formatNumber(video.shares)}
                </span>
              </div>
            </CardContent>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3.5 pb-3.5 space-y-3 border-t pt-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Transcript</p>
              <p className="text-sm max-h-32 overflow-y-auto">
                {video.transcript || "[No speech detected]"}
              </p>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={video.videoUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Open on TikTok
              </a>
            </Button>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============================================================
// TIKTOK RESULTS GRID
// ============================================================

function TikTokResults({ videos }: { videos: TikTokVideo[] }) {
  if (!videos || videos.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs text-muted-foreground mb-3">
        {videos.length} videos found
      </p>
      <div className="flex gap-3.5 overflow-x-auto pb-3">
        {videos.map((video) => (
          <TikTokCard key={video.tiktokId} video={video} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// WEB SEARCH CARD
// ============================================================

function WebSearchCard({ result }: { result: AcceptedWebResult }) {
  const [imgError, setImgError] = useState(false);
  const dateStr = formatDate(result.publishedDate);

  return (
    <a href={result.url} target="_blank" rel="noopener noreferrer" className="block">
      <Card className="h-full overflow-hidden hover:shadow-lg">
        {result.image && !imgError && (
          <div className="aspect-video w-full overflow-hidden bg-muted">
            <img
              src={result.image}
              alt={result.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex items-start gap-2.5 mb-2.5">
            {result.favicon && (
              <img src={result.favicon} alt="" className="w-4 h-4 rounded-sm" />
            )}
            <h3 className="font-semibold text-sm line-clamp-2">
              {decodeHtmlEntities(result.title)}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {decodeHtmlEntities(result.summary)}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {result.author && <span className="truncate max-w-[120px]">{result.author}</span>}
            {result.author && dateStr && <span>·</span>}
            {dateStr && <span>{dateStr}</span>}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

// ============================================================
// REJECTED RESULTS SECTION
// ============================================================

function RejectedResultsSection({ results }: { results: RejectedWebResult[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!results || results.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-5">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground">
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
        <span>{results.length} results filtered out</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/10">
          {results.map((result, idx) => (
            <a key={`${result.url}-${idx}`} href={result.url} target="_blank" rel="noopener noreferrer">
              <Card className="bg-muted/20 hover:bg-muted/30">
                <CardContent className="p-3">
                  <h4 className="text-sm font-medium line-clamp-1 text-muted-foreground">
                    {decodeHtmlEntities(result.title)}
                  </h4>
                  <p className="text-xs text-muted-foreground/60 mt-1.5 italic">
                    {result.reason}
                  </p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================
// WEB SEARCH RESULTS GRID
// ============================================================

function WebSearchResults({ results, rejected }: { results: AcceptedWebResult[]; rejected?: RejectedWebResult[] }) {
  if ((!results || results.length === 0) && (!rejected || rejected.length === 0)) return null;

  return (
    <div className="mt-5">
      {results && results.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mb-4">
            {results.length} results found
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result, idx) => (
              <WebSearchCard key={`${result.url}-${idx}`} result={result} />
            ))}
          </div>
        </>
      )}
      <RejectedResultsSection results={rejected || []} />
    </div>
  );
}

// ============================================================
// TOOL OUTPUT EXTRACTION
// ============================================================

function extractVideosFromToolOutput(output: unknown): TikTokVideo[] | null {
  if (!output || typeof output !== "object") return null;
  const result = output as { success?: boolean; videos?: TikTokVideo[] };
  if (result.success && Array.isArray(result.videos)) {
    return result.videos;
  }
  return null;
}

interface WebSearchOutput {
  success?: boolean;
  accepted?: AcceptedWebResult[];
  rejected?: RejectedWebResult[];
}

function extractWebSearchFromToolOutput(output: unknown): WebSearchOutput | null {
  if (!output || typeof output !== "object") return null;
  const result = output as WebSearchOutput;
  if (result.success !== undefined && Array.isArray(result.accepted)) {
    return result;
  }
  return null;
}

// ============================================================
// TOOL DISPLAY
// ============================================================

function ToolDisplay({ part }: { part: ToolPart }) {
  const videos = extractVideosFromToolOutput(part.output);
  const webSearch = extractWebSearchFromToolOutput(part.output);
  const toolName = part.type.replace("tool-", "");
  const isTikTokSearch = toolName === "searchTikTok";
  const isWebSearch = toolName === "filteredWebSearch";

  // Loading state
  if (part.state === "input-streaming" || part.state === "input-available") {
    const loadingText = isWebSearch ? "Searching web..." :
                        isTikTokSearch ? "Searching TikTok..." :
                        `Running ${toolName}...`;
    return (
      <div className="mb-4 flex items-center gap-3 text-muted-foreground py-3 px-4 rounded-lg bg-muted/20">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">{loadingText}</span>
      </div>
    );
  }

  // TikTok results
  if (isTikTokSearch && videos && part.state === "output-available") {
    return (
      <div className="mb-4">
        <TikTokResults videos={videos} />
      </div>
    );
  }

  // Web search results
  if (isWebSearch && webSearch && part.state === "output-available") {
    return (
      <div className="mb-4">
        <WebSearchResults
          results={webSearch.accepted || []}
          rejected={webSearch.rejected}
        />
      </div>
    );
  }

  // Default: show raw tool output
  return (
    <pre className="text-xs bg-muted p-2 rounded overflow-auto">
      {JSON.stringify(part.output, null, 2)}
    </pre>
  );
}

// ============================================================
// STREAMING MESSAGE
// ============================================================

const StreamingMessage = memo(
  ({ message }: { message: UIMessage }) => {
    const textContent = message.text || "";
    const [visibleText] = useSmoothText(textContent, {
      startStreaming: message.status === "streaming",
    });

    // Extract tool parts
    const toolParts: ToolPart[] = [];
    for (const part of message.parts || []) {
      if (part.type.startsWith("tool-")) {
        toolParts.push(part as unknown as ToolPart);
      }
    }

    const hasToolsInProgress = toolParts.some(
      (p) => p.state !== "output-available" && p.state !== "output-error"
    );

    return (
      <div className={`p-4 ${message.role === "user" ? "bg-muted/50" : ""}`}>
        {/* Thinking indicator */}
        {message.role === "assistant" && message.status === "streaming" && !visibleText && !hasToolsInProgress && toolParts.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        )}

        {/* Tool parts */}
        {toolParts.map((part) => (
          <ToolDisplay key={part.toolCallId} part={part} />
        ))}

        {/* Text content */}
        {visibleText && (
          <div className="prose prose-sm max-w-none">
            {visibleText}
            {message.status === "streaming" && (
              <span className="inline-block w-2 h-4 ml-1 bg-foreground animate-pulse" />
            )}
          </div>
        )}

        {/* Error state */}
        {message.status === "failed" && (
          <div className="text-destructive text-sm">
            Error generating response. Please try again.
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.message.key === next.message.key &&
      prev.message.status === next.message.status &&
      prev.message.parts === next.message.parts
    );
  }
);

// ============================================================
// CHAT PAGE
// ============================================================

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const [inputValue, setInputValue] = useState("");
  const sendMessageAction = useAction(api.agent.threads.sendMessage);

  const {
    results: messages,
    status,
    loadMore,
  } = useUIMessages(
    api.agent.threads.listThreadMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 50,
      stream: true,
    }
  );

  const isStreaming = messages?.some((m) => m.status === "streaming") ?? false;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || !threadId || isStreaming) return;

      const text = inputValue.trim();
      setInputValue("");

      try {
        await sendMessageAction({ threadId, message: text });
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [threadId, inputValue, isStreaming, sendMessageAction]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {status === "CanLoadMore" && (
          <div className="flex justify-center py-4">
            <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
              Load older messages
            </Button>
          </div>
        )}

        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h2 className="text-xl font-semibold mb-2">Start exploring</h2>
            <p className="text-muted-foreground">
              Ask about products, trends, or topics
            </p>
          </div>
        )}

        {messages?.map((message) => (
          <StreamingMessage key={message.key} message={message} />
        ))}
      </div>

      {/* Input form */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about products, trends, or topics..."
            disabled={isStreaming}
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <Button type="submit" disabled={!inputValue.trim() || isStreaming}>
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

---

## Data Types & Schemas

### TikTok Video Result

```typescript
interface TikTokVideoResult {
  tiktokId: string;      // Video ID
  videoUrl: string;      // Full TikTok URL
  thumbnailUrl: string;  // Video thumbnail image
  creatorHandle: string; // @username
  views: number;         // Play count
  likes: number;         // Digg count
  shares: number;        // Share count
  transcript: string;    // Plain text transcript or "[No speech detected]"
}
```

### Web Search Result (Accepted)

```typescript
interface AcceptedWebResult {
  url: string;
  title: string;
  author?: string;
  publishedDate?: string;
  text: string;          // Full article text
  summary: string;       // First 300 chars
  image?: string;        // Featured image
  favicon?: string;      // Site favicon
}
```

### Web Search Result (Rejected)

```typescript
interface RejectedWebResult {
  url: string;
  title: string;
  reason: string;        // Why it was filtered
  summary: string;       // First 200 chars
}
```

### UIMessage (from @convex-dev/agent)

```typescript
interface UIMessage {
  key: string;
  role: "user" | "assistant";
  status: "streaming" | "done" | "failed";
  text: string;
  parts: MessagePart[];
}
```

---

## Environment Configuration

```bash
# Required Environment Variables

# AI Models (OpenRouter)
OPENROUTER_API_KEY=sk-or-...

# TikTok Search (Scrape Creators)
SCRAPE_CREATORS_API_KEY=...

# Web Search (Exa)
EXA_API_KEY=...

# Authentication (Clerk)
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Convex
CONVEX_DEPLOYMENT=...
VITE_CONVEX_URL=https://your-project.convex.cloud
```

---

## Complete Code Reference

### File Structure

```
/convex/
  agent/
    index.ts       - Agent configuration (45 lines)
    tools.ts       - TikTok + web search tools (597 lines)
    threads.ts     - Thread management (245 lines)
  convex.config.ts - Component registration
  schema.ts        - Database schema

/src/
  routes/
    chat.$threadId.tsx  - Chat UI (687 lines)
    chat.index.tsx      - Empty state (44 lines)
  components/
    app-sidebar.tsx     - Thread sidebar (~400 lines)
    ai-elements/
      conversation.tsx  - Message list container
      message.tsx       - Message rendering
      tool.tsx          - Tool UI wrapper
      prompt-input.tsx  - Text input
```

### Key Hooks

```typescript
// Fetch messages with streaming
const { results, status, loadMore } = useUIMessages(
  api.agent.threads.listThreadMessages,
  { threadId },
  { initialNumItems: 50, stream: true }
);

// Smooth text animation
const [visibleText] = useSmoothText(textContent, {
  startStreaming: message.status === "streaming",
});

// Call backend actions
const sendMessage = useAction(api.agent.threads.sendMessage);
```

### Error Handling Strategy

| Scenario | Strategy |
|----------|----------|
| TikTok search fails | Return `{ success: false, error: "..." }` |
| Transcript fetch fails | Silent fallback to `"[No speech detected]"` |
| Exa search fails | Return error, tool fails |
| Haiku filter fails | **Fail-open**: accept all results |
| Auth fails | Throw `"Not authenticated"` |
| Not thread owner | Throw `"Not authorized"` |

### Performance Characteristics

| Operation | Typical Latency |
|-----------|-----------------|
| TikTok search (10 videos + transcripts) | 3-5 seconds |
| Web search + filter (10 articles) | 4-6 seconds |
| Streaming throttle | 100ms |

### Cost Per Query

| Tool | API Calls |
|------|-----------|
| searchTikTok | 1 search + 10 transcripts = 11 credits |
| filteredWebSearch | 1 Exa + 10 Haiku = 11 API calls |

---

## Implementation Checklist

- [ ] Install dependencies (`@convex-dev/agent`, `ai`, `exa-js`, etc.)
- [ ] Configure Convex with agent component
- [ ] Set up authentication (Clerk recommended)
- [ ] Add environment variables for all APIs
- [ ] Implement agent with tool definitions
- [ ] Implement thread management actions
- [ ] Build chat UI with streaming support
- [ ] Add tool-specific result components (TikTok cards, web cards)
- [ ] Handle loading states and errors
- [ ] Add rejected results transparency (optional)

---

## Gotchas & Notes

1. **Type assertion needed** for `streamText`: `(agent as any).streamText()`
2. **Thread list is not reactive** - must manually refetch after create/delete
3. **Tool outputs are generic** - parse and type-check manually
4. **TikTok thumbnails may expire** - handle broken images gracefully
5. **HTML entities in web results** - decode `&amp;`, `&lt;`, etc.
6. **Streaming requires vStreamArgs** - query args must include stream args
7. **All Convex functions check auth** - throw early if not authenticated
