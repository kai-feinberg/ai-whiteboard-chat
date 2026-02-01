// convex/chat/tools.ts
// @feature search-tools
// @service exa

import { Exa } from "exa-js";

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
