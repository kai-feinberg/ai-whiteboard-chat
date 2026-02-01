"use client";

import { Card, CardContent } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import {
  GlobeIcon,
  ChevronDownIcon,
  Loader2Icon,
  AlertCircleIcon,
  FilterIcon,
} from "lucide-react";
import { useState, type ComponentProps } from "react";

// ============================================================
// Utility Functions
// ============================================================

/**
 * Decode HTML entities in text using DOMParser for comprehensive coverage.
 * Falls back to basic replacement for SSR environments.
 */
function decodeHtmlEntities(text: string): string {
  // SSR guard - use basic replacement when document is unavailable
  if (typeof document === "undefined") {
    const entities: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#039;": "'",
      "&apos;": "'",
      "&nbsp;": " ",
    };
    return text.replace(
      /&(?:amp|lt|gt|quot|#039|apos|nbsp);/g,
      (match) => entities[match] || match
    );
  }

  // Client-side: use browser's built-in decoder for comprehensive entity support
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Format date as relative time (Today, 3d ago, 2w ago, Jan 2024)
 */
function formatRelativeDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle future dates gracefully
    if (diffMs < 0) {
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1d ago";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

// ============================================================
// Types
// ============================================================

export interface WebSearchResult {
  url: string;
  title: string;
  author?: string;
  publishedDate?: string;
  text?: string;
  summary: string;
  image?: string;
  favicon?: string;
}

// ============================================================
// WebSearchCard - Individual article card
// ============================================================

export interface WebSearchCardProps extends ComponentProps<"a"> {
  result: WebSearchResult;
}

export function WebSearchCard({
  result,
  className,
  ...props
}: WebSearchCardProps) {
  const [imgError, setImgError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const formattedDate = formatRelativeDate(result.publishedDate);
  const decodedTitle = decodeHtmlEntities(result.title || "Untitled");
  const decodedSummary = decodeHtmlEntities(result.summary || "");
  const hasImage = result.image && !imgError;
  const hasFavicon = result.favicon && !faviconError;

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Read "${decodedTitle}" - opens in new tab`}
      className={cn("block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg", className)}
      {...props}
    >
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        {/* Featured image - aspect-video, hidden if missing */}
        {hasImage && (
          <div className="aspect-video w-full overflow-hidden bg-muted">
            <img
              src={result.image}
              alt={decodedTitle}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <CardContent className="p-4">
          {/* Favicon + Title */}
          <div className="flex items-start gap-2 mb-2">
            {hasFavicon ? (
              <img
                src={result.favicon}
                alt=""
                className="size-4 shrink-0 rounded-sm mt-0.5"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <GlobeIcon className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            )}
            <h3 className="font-semibold text-sm line-clamp-2 leading-snug">
              {decodedTitle}
            </h3>
          </div>

          {/* Summary - truncated to 2 lines */}
          {decodedSummary && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {decodedSummary}
            </p>
          )}

          {/* Author + Date */}
          {(result.author || formattedDate) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {result.author && (
                <span className="truncate max-w-[120px]">{result.author}</span>
              )}
              {result.author && formattedDate && <span>·</span>}
              {formattedDate && <span>{formattedDate}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </a>
  );
}

// ============================================================
// Types for WebSearchTool
// ============================================================

export interface RejectedWebResult {
  url: string;
  title: string;
  reason: string;
  summary: string;
}

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export interface WebSearchToolOutput {
  success?: boolean;
  accepted?: WebSearchResult[];
  rejected?: RejectedWebResult[];
  searchTime?: number;
  filterTime?: number;
  message?: string;
  error?: string;
}

export interface WebSearchToolProps extends ComponentProps<"div"> {
  state: ToolState;
  input?: { query?: string } | string;
  output?: WebSearchToolOutput;
}

// ============================================================
// WebSearchTool - Wrapper for tool state + results grid
// ============================================================

export function WebSearchTool({
  state,
  input,
  output,
  className,
  ...props
}: WebSearchToolProps) {
  // Main results collapsed by default (per pattern from TikTokSearchTool)
  const [isCollapsed, setIsCollapsed] = useState(true);
  // Rejected section collapsed by default
  const [isRejectedCollapsed, setIsRejectedCollapsed] = useState(true);

  // Parse input
  const query =
    typeof input === "string"
      ? input
      : typeof input === "object"
        ? input?.query
        : undefined;

  // Determine display state
  const isLoading = state === "input-streaming" || state === "input-available";
  const isError = state === "output-error" || (output && !output.success);
  const isSuccess = state === "output-available" && output?.success;

  const accepted = output?.accepted ?? [];
  const rejected = output?.rejected ?? [];
  const errorMessage = output?.error ?? "Web search failed";

  return (
    <div
      className={cn(
        "my-2 rounded-lg border bg-card p-3",
        isLoading && "border-primary/30 bg-primary/5",
        isError && "border-destructive/50 bg-destructive/5",
        className
      )}
      {...props}
    >
      {/* Loading state - search + filter happen together */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Searching & filtering web...</span>
          </div>
          {query && (
            <div className="truncate text-xs text-muted-foreground">
              Query: "{query}"
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary/60" />
            </div>
            <span className="text-xs text-muted-foreground">
              Filtering for quality...
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-2">
          <AlertCircleIcon className="size-4 text-destructive" />
          <span className="text-sm text-destructive">{errorMessage}</span>
        </div>
      )}

      {/* Success state with results */}
      {isSuccess && (
        <div className="space-y-3">
          {/* Accepted results - collapsible with responsive grid */}
          <Collapsible
            open={!isCollapsed}
            onOpenChange={(o) => setIsCollapsed(!o)}
          >
            <CollapsibleTrigger
              className="flex w-full items-center gap-2 text-left"
              aria-label={`${accepted.length} results found. ${isCollapsed ? "Click to expand" : "Click to collapse"}`}
            >
              <GlobeIcon className="size-4 text-foreground" />
              <span className="flex-1 text-sm font-medium">
                {accepted.length} {accepted.length === 1 ? "result" : "results"}{" "}
                found
              </span>
              <ChevronDownIcon
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  isCollapsed && "-rotate-90"
                )}
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              {accepted.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {accepted.map((result, index) => (
                    <WebSearchCard
                      key={result.url || index}
                      result={result}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted-foreground">
                  {output?.message ?? "No results passed quality filters."}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Rejected results - collapsed by default, hidden if empty */}
          {rejected.length > 0 && (
            <Collapsible
              open={!isRejectedCollapsed}
              onOpenChange={(o) => setIsRejectedCollapsed(!o)}
            >
              <CollapsibleTrigger
                className="flex w-full items-center gap-2 text-left text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`${rejected.length} results filtered out. ${isRejectedCollapsed ? "Click to expand" : "Click to collapse"}`}
              >
                <FilterIcon className="size-3.5" />
                <span className="flex-1 text-xs">
                  {rejected.length}{" "}
                  {rejected.length === 1 ? "result" : "results"} filtered out
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    isRejectedCollapsed && "-rotate-90"
                  )}
                />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  {rejected.map((result, index) => (
                    <div
                      key={result.url || index}
                      className="rounded border border-muted bg-muted/30 p-2"
                    >
                      <div className="text-xs font-medium text-muted-foreground line-clamp-1">
                        {decodeHtmlEntities(result.title || "Untitled")}
                      </div>
                      <div className="mt-1 text-xs italic text-muted-foreground/70">
                        {result.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
