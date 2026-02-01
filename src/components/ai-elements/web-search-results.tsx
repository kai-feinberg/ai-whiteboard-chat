"use client";

import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { GlobeIcon } from "lucide-react";
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
