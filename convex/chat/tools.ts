// convex/chat/tools.ts
// @feature search-tools
// @service exa, ai-gateway

import { Exa } from "exa-js";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

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

export interface FilterResult {
  accepted: boolean;
  reason: string;
}

export interface FilteredResults {
  accepted: ExaSearchResult[];
  rejected: Array<ExaSearchResult & { rejectionReason: string }>;
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
