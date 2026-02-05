"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import {
  ExternalLinkIcon,
  EyeIcon,
  HeartIcon,
  Share2Icon,
  ChevronDownIcon,
  Loader2Icon,
  AlertCircleIcon,
  ImageOffIcon,
} from "lucide-react";
import { useState, type ComponentProps } from "react";

// TikTok icon SVG (reused from read-link-tool.tsx)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

// Format large numbers (1.2M, 45K, etc.)
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

// Video data type matching TikTokVideoResult from convex/chat/tools.ts
export interface TikTokVideo {
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
// TikTokResultsCard - Individual video card
// ============================================================

export interface TikTokResultsCardProps extends ComponentProps<"div"> {
  video: TikTokVideo;
}

export function TikTokResultsCard({
  video,
  className,
  ...props
}: TikTokResultsCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const hasTranscript =
    video.transcript && video.transcript !== "[No speech detected]";

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden transition-shadow hover:shadow-md cursor-pointer",
          className
        )}
        onClick={() => setIsModalOpen(true)}
        {...props}
      >
        {/* Thumbnail - 9:16 aspect ratio, capped height */}
        <div className="relative aspect-[9/16] max-h-32 w-full overflow-hidden bg-muted">
          {video.thumbnailUrl && !imgError ? (
            <img
              src={video.thumbnailUrl}
              alt={`Video by @${video.creatorHandle}`}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOffIcon className="size-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Creator handle and stats */}
        <CardContent className="p-3">
          <p className="truncate text-sm font-semibold">
            @{video.creatorHandle}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <EyeIcon className="size-3.5" />
              {formatNumber(video.views)}
            </span>
            <span className="flex items-center gap-1">
              <HeartIcon className="size-3.5" />
              {formatNumber(video.likes)}
            </span>
            <span className="flex items-center gap-1">
              <Share2Icon className="size-3.5" />
              {formatNumber(video.shares)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Transcript Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TikTokIcon className="size-5" />
              @{video.creatorHandle}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <EyeIcon className="size-4" />
                  {formatNumber(video.views)}
                </span>
                <span className="flex items-center gap-1">
                  <HeartIcon className="size-4" />
                  {formatNumber(video.likes)}
                </span>
                <span className="flex items-center gap-1">
                  <Share2Icon className="size-4" />
                  {formatNumber(video.shares)}
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Transcript with capped scrollable height */}
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Transcript
              </p>
              <div className="max-h-[50vh] overflow-y-auto rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
                {hasTranscript ? video.transcript : "[No speech detected]"}
              </div>
            </div>

            {/* Open on TikTok button */}
            <Button variant="outline" className="w-full" asChild>
              <a
                href={video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TikTokIcon className="mr-2 size-4" />
                Open on TikTok
                <ExternalLinkIcon className="ml-1 size-3.5" />
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// TikTokSearchTool - Wrapper for tool state + results grid
// ============================================================

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export interface TikTokSearchToolOutput {
  success?: boolean;
  videos?: TikTokVideo[];
  totalFound?: number;
  message?: string;
  error?: string;
}

export interface TikTokSearchToolProps extends ComponentProps<"div"> {
  state: ToolState;
  input?: { query?: string } | string;
  output?: TikTokSearchToolOutput;
}

export function TikTokSearchTool({
  state,
  input,
  output,
  className,
  ...props
}: TikTokSearchToolProps) {
  // Collapsed by default after initial render, per PRD US-UI-002
  const [isCollapsed, setIsCollapsed] = useState(true);

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

  const allVideos = output?.videos ?? [];
  // Filter out videos with no speech detected
  const videos = allVideos.filter(
    (v) => v.transcript && v.transcript !== "[No speech detected]"
  );
  const errorMessage = output?.error ?? "TikTok search failed";
  const resultCount = videos.length;

  return (
    <div
      className={cn(
        "my-2 rounded-lg border bg-card p-3 max-w-full overflow-hidden",
        isLoading && "border-primary/30 bg-primary/5",
        isError && "border-destructive/50 bg-destructive/5",
        className
      )}
      {...props}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Searching TikTok...</span>
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
              Fetching videos...
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
        <Collapsible open={!isCollapsed} onOpenChange={(o) => setIsCollapsed(!o)}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
            <TikTokIcon className="size-4 text-foreground" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">
                {resultCount} {resultCount === 1 ? "video" : "videos"} found
              </span>
              {query && (
                <p className="truncate text-xs text-muted-foreground">
                  "{query}"
                </p>
              )}
            </div>
            <ChevronDownIcon
              className={cn(
                "size-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
                isCollapsed && "-rotate-90"
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            {videos.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {videos.map((video, index) => (
                  <TikTokResultsCard
                    key={video.tiktokId || video.videoUrl || index}
                    video={video}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                {output?.message ?? "No videos found for this query."}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
