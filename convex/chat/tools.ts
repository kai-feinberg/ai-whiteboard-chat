// convex/chat/tools.ts
// @feature search-tools
// @service exa, ai-gateway, scrape-creators

import { Exa } from "exa-js";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

// ============================================================
// TYPES - EXA SEARCH
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

export interface FilterResult {
  accepted: boolean;
  reason: string;
}

export interface FilteredResults {
  accepted: ExaSearchResult[];
  rejected: Array<ExaSearchResult & { rejectionReason: string }>;
}

// ============================================================
// TYPES - TIKTOK SEARCH
// ============================================================

interface TikTokSearchResponse {
  success: boolean;
  credits_remaining: number;
  search_item_list: TikTokSearchItem[];
  cursor: number;
}

interface TikTokSearchItem {
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

interface TranscriptResponse {
  id: string;
  url: string;
  transcript: string;
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

// ============================================================
// EXA SEARCH
// ============================================================

/**
 * Search the web via Exa API and retrieve article content
 *
 * @param query - Search query string
 * @param numResults - Number of results to return (default: 10)
 * @returns Array of ExaSearchResult with full article text
 * @throws Error for API key issues, rate limits, or network errors
 */
export async function fetchExaSearch(
  query: string,
  numResults: number = 10
): Promise<ExaSearchResult[]> {
  // Input validation
  if (!query.trim()) {
    throw new Error("Search query cannot be empty");
  }
  const clampedNumResults = Math.min(Math.max(numResults, 1), 100);

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY not configured");
  }

  const exa = new Exa(apiKey);

  try {
    const response = await exa.searchAndContents(query, {
      text: true,
      type: "auto",
      numResults: clampedNumResults,
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

/**
 * Evaluate a single search result using Claude Haiku via AI Gateway
 * Uses fail-open design: accepts results if API call fails
 *
 * @param result - Search result to evaluate
 * @returns FilterResult with accepted boolean and reason
 */
async function evaluateResultWithHaiku(
  result: ExaSearchResult
): Promise<FilterResult> {
  try {
    const { text: responseText } = await generateText({
      model: gateway("anthropic/claude-3-5-haiku-20241022"),
      system: `You evaluate search results for quality. You MUST respond with ONLY a JSON object, no other text.
Format: {"accepted": boolean, "reason": "string"}
Example accept: {"accepted": true, "reason": "Quality content"}
Example reject: {"accepted": false, "reason": "Promotional content for X brand"}`,
      prompt: `Evaluate this search result:

Title: ${result.title || "Untitled"}
URL: ${result.url}
Summary: ${(result.text || "").slice(0, 500)}

Reject if ANY apply:
- Is this promotional content pushing a product/service?
- Is this spam or low-quality aggregated content (e.g., "top 12 best XXX to try")?
- Is this paywalled or requires signup to read?

Respond with JSON only:`,
      temperature: 0,
    });

    // Parse JSON - handle potential markdown wrapping
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    const parsed = JSON.parse(jsonStr) as { accepted: boolean; reason: string };
    if (typeof parsed.accepted !== "boolean" || typeof parsed.reason !== "string") {
      throw new Error("Invalid response format");
    }
    return { accepted: parsed.accepted, reason: parsed.reason };
  } catch (error) {
    // Fail-open: accept the result if Haiku call fails
    console.error("[filterSearchResults] Haiku evaluation error:", error);
    return { accepted: true, reason: "Filter error - accepted by default" };
  }
}

/**
 * Filter search results through Claude Haiku to remove low-quality content
 * Evaluates each result in parallel for performance
 * Uses fail-open design: if Haiku call fails, result is accepted
 *
 * @param results - Array of ExaSearchResult to filter
 * @returns FilteredResults with accepted and rejected arrays
 */
export async function filterSearchResults(
  results: ExaSearchResult[]
): Promise<FilteredResults> {
  if (results.length === 0) {
    return { accepted: [], rejected: [] };
  }

  // Evaluate all results in parallel
  const evaluations = await Promise.all(
    results.map((result) => evaluateResultWithHaiku(result))
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
// TIKTOK SEARCH
// ============================================================

/**
 * Parse WebVTT transcript to plain text
 * WebVTT format: "WEBVTT\n\n00:00:00.120 --> 00:00:01.840\nText here\n\n..."
 *
 * Handles:
 * - WEBVTT header
 * - Timestamp lines (00:00:00.000 --> 00:00:01.000)
 * - Cue identifiers (numeric)
 * - NOTE blocks (comments)
 * - STYLE/REGION blocks (CSS styling)
 * - WebVTT styling tags (<v Speaker>, <b>, <i>, etc.)
 *
 * @param webvtt - Raw WebVTT formatted string
 * @returns Plain text transcript or "[No speech detected]" if empty
 */
export function parseWebVTT(webvtt: string): string {
  if (!webvtt || !webvtt.trim()) {
    return "[No speech detected]";
  }

  const lines = webvtt.split("\n");
  const textLines: string[] = [];
  let inStyleOrRegion = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      inStyleOrRegion = false; // Empty line ends STYLE/REGION blocks
      continue;
    }

    // Skip WEBVTT header
    if (trimmed === "WEBVTT") {
      continue;
    }

    // Skip NOTE blocks (single line or start of block)
    if (trimmed.startsWith("NOTE")) {
      continue;
    }

    // Skip STYLE and REGION blocks (they end on empty line)
    if (trimmed === "STYLE" || trimmed === "REGION") {
      inStyleOrRegion = true;
      continue;
    }
    if (inStyleOrRegion) {
      continue;
    }

    // Skip timestamp lines
    if (trimmed.includes("-->")) {
      continue;
    }

    // Skip cue identifiers (purely numeric)
    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    // Strip WebVTT styling tags (<v Speaker>, <b>, <i>, <c>, etc.)
    const cleanedLine = trimmed.replace(/<[^>]+>/g, "");
    if (cleanedLine) {
      textLines.push(cleanedLine);
    }
  }

  const text = textLines.join(" ").trim();
  return text || "[No speech detected]";
}

/**
 * Fetch transcript for a single TikTok video
 * Silent fallback: returns "[No speech detected]" if transcript fetch fails
 *
 * @param videoUrl - TikTok video URL
 * @returns Plain text transcript or "[No speech detected]"
 */
async function fetchTikTokTranscript(videoUrl: string): Promise<string> {
  // Skip API call if no URL provided
  if (!videoUrl) {
    return "[No speech detected]";
  }

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

    const data = (await response.json()) as TranscriptResponse;

    if (!data.transcript) {
      return "[No speech detected]";
    }

    return parseWebVTT(data.transcript);
  } catch {
    return "[No speech detected]";
  }
}

/**
 * Search TikTok for videos via Scrape Creators API
 * Fetches search results sorted by most-liked, then fetches transcripts in parallel
 *
 * @param query - Search query string
 * @param limit - Maximum number of videos to return (default: 10)
 * @returns Array of TikTokVideoResult with metadata and transcripts
 * @throws Error for API key issues or rate limits
 */
export async function fetchTikTokSearch(
  query: string,
  limit: number = 10
): Promise<TikTokVideoResult[]> {
  const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPE_CREATORS_API_KEY not configured");
  }

  // Input validation
  if (!query.trim()) {
    throw new Error("Search query cannot be empty");
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
      throw new Error("Invalid Scrape Creators API key");
    }
    if (status === 429) {
      throw new Error("Rate limit exceeded - please try again later");
    }
    throw new Error(`TikTok search failed: ${status} ${response.statusText}`);
  }

  const data = (await response.json()) as TikTokSearchResponse;

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
    partialResults.map((video) => fetchTikTokTranscript(video.videoUrl))
  );

  // Combine results with transcripts
  return partialResults.map((video, index) => ({
    ...video,
    transcript: transcripts[index],
  }));
}
