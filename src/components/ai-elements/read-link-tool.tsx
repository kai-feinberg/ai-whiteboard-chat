"use client";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  CheckCircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  YoutubeIcon,
  TwitterIcon,
  GlobeIcon,
  LinkIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

// Platform icons
const PlatformIcon = ({ platform }: { platform: string | null }) => {
  const iconClass = "size-4";
  switch (platform) {
    case "youtube":
      return <YoutubeIcon className={cn(iconClass, "text-red-500")} />;
    case "twitter":
      return <TwitterIcon className={cn(iconClass, "text-sky-500")} />;
    case "tiktok":
      return (
        <svg
          className={cn(iconClass, "text-black dark:text-white")}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    case "facebook_ad":
      return (
        <svg
          className={cn(iconClass, "text-blue-600")}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "website":
      return <GlobeIcon className={cn(iconClass, "text-muted-foreground")} />;
    default:
      return <LinkIcon className={cn(iconClass, "text-muted-foreground")} />;
  }
};

// Platform display names
const getPlatformLabel = (platform: string | null): string => {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "twitter":
      return "Twitter/X";
    case "tiktok":
      return "TikTok";
    case "facebook_ad":
      return "Facebook Ad";
    case "website":
      return "Website";
    default:
      return "Link";
  }
};

// Truncate text helper
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

// Extract title from content based on platform
const getTitle = (content: Record<string, unknown> | null): string => {
  if (!content) return "Unknown";
  return (
    (content.title as string) ||
    (content.authorName as string) ||
    (content.pageName as string) ||
    "Content"
  );
};

// Extract preview text from content based on platform
const getPreview = (content: Record<string, unknown> | null): string | null => {
  if (!content) return null;
  const text =
    (content.transcript as string) ||
    (content.text as string) ||
    (content.markdown as string) ||
    (content.body as string);
  return text ? truncateText(text, 200) : null;
};

// Extract author from content
const getAuthor = (content: Record<string, unknown> | null): string | null => {
  if (!content) return null;
  return (content.author as string) || (content.authorName as string) || null;
};

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export interface ReadLinkToolProps extends ComponentProps<"div"> {
  state: ToolState;
  input?: { url?: string } | string;
  output?: {
    success?: boolean;
    platform?: string | null;
    content?: Record<string, unknown> | null;
    error?: string | null;
  };
}

export function ReadLinkTool({
  state,
  input,
  output,
  className,
  ...props
}: ReadLinkToolProps) {
  // Parse input
  const url =
    typeof input === "string" ? input : typeof input === "object" ? input?.url : undefined;

  // Determine display state
  const isLoading = state === "input-streaming" || state === "input-available";
  const isError = state === "output-error" || (output && !output.success);
  const isSuccess = state === "output-available" && output?.success;

  const platform = output?.platform ?? null;
  const content = output?.content ?? null;
  const errorMessage = output?.error ?? "Failed to read link";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 my-2",
        isError && "border-destructive/50 bg-destructive/5",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {isLoading ? (
          <ClockIcon className="size-4 animate-pulse text-muted-foreground" />
        ) : isError ? (
          <AlertCircleIcon className="size-4 text-destructive" />
        ) : (
          <CheckCircleIcon className="size-4 text-green-600" />
        )}

        <span className="text-sm font-medium">
          {isLoading ? "Reading link..." : isError ? "Failed to read" : "Link read"}
        </span>

        {platform && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <PlatformIcon platform={platform} />
            {getPlatformLabel(platform)}
          </Badge>
        )}
      </div>

      {/* Loading state */}
      {isLoading && url && (
        <div className="text-xs text-muted-foreground truncate">{url}</div>
      )}

      {/* Error state */}
      {isError && (
        <div className="text-sm text-destructive">{errorMessage}</div>
      )}

      {/* Success state */}
      {isSuccess && content && (
        <div className="space-y-2">
          {/* Title */}
          <div className="font-medium text-sm">{getTitle(content)}</div>

          {/* Author if available */}
          {Boolean(getAuthor(content)) && (
            <div className="text-xs text-muted-foreground">
              by {getAuthor(content)}
            </div>
          )}

          {/* Preview */}
          {getPreview(content) !== null && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded max-h-24 overflow-y-auto">
              {getPreview(content)}
            </div>
          )}

          {/* Link to original */}
          {typeof content.url === "string" && (
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLinkIcon className="size-3" />
              View original
            </a>
          )}
        </div>
      )}
    </div>
  );
}
