'use client'

import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { cn } from '~/lib/utils'
import {
  ExternalLinkIcon,
  ChevronDownIcon,
  Loader2Icon,
  AlertCircleIcon,
  ArrowUpIcon,
  MessageSquareIcon,
  ClockIcon,
  UserIcon,
} from 'lucide-react'
import { useState, type ComponentProps } from 'react'

// Reddit icon SVG
function RedditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4', className)}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.576 4.778 1.333 1.203-.947 2.01-2.213 2.01-3.656 0-1.211-.47-2.305-1.239-3.11 1.23.082 2.265.73 2.265 2.11 0 1.182-.703 2.22-1.758 2.848.82 1.063 1.31 2.403 1.31 3.87 0 1.786-.68 3.38-1.75 4.576.22.22.35.525.35.863 0 .673-.547 1.22-1.22 1.22-.62 0-1.13-.463-1.2-1.06a6.556 6.556 0 0 1-3.95 1.324c-1.472 0-2.82-.483-3.922-1.306-.07.59-.578 1.051-1.199 1.051-.673 0-1.22-.547-1.22-1.22 0-.337.13-.643.35-.863-1.07-1.196-1.75-2.79-1.75-4.576 0-1.467.49-2.807 1.31-3.87-.77.805-1.239 1.899-1.239 3.11 0 1.443.807 2.709 2.01 3.656 1.298-.757 2.954-1.263 4.778-1.333l-.8-3.747-2.597.547a1.25 1.25 0 0 1-2.498-.056c0-.688.562-1.25 1.25-1.25l2.523.531a.81.81 0 0 1 .17.017l2.513-.53zm-3.446 10.04c-.82 0-1.488.668-1.488 1.49 0 .82.668 1.488 1.488 1.488.82 0 1.49-.667 1.49-1.489 0-.82-.67-1.489-1.49-1.489zm5.952 0c-.82 0-1.488.668-1.488 1.49 0 .82.668 1.488 1.488 1.488.82 0 1.49-.667 1.49-1.489 0-.82-.67-1.489-1.49-1.489zm-5.952 2.978c-.82 0-1.488.668-1.488 1.49 0 .82.668 1.488 1.488 1.488.82 0 1.49-.667 1.49-1.489 0-.82-.67-1.489-1.49-1.489zm5.952 0c-.82 0-1.488.668-1.488 1.49 0 .82.668 1.488 1.488 1.488.82 0 1.49-.667 1.49-1.489 0-.82-.67-1.489-1.49-1.489z" />
    </svg>
  )
}

// Format large numbers (1.2M, 45K, etc.)
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

// Format date to relative time
function formatRelativeDate(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 604800)}w ago`
  if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`
  return `${Math.floor(diffInSeconds / 31536000)}y ago`
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

// Types for Reddit comment
export interface RedditCommentReply {
  id: string
  author: string
  body: string
  score: number
}

export interface RedditComment {
  id: string
  author: string
  body: string
  score: number
  replies: RedditCommentReply[]
}

// Extended WebSearchResult with Reddit-specific fields
export interface RedditSearchResult {
  id: string
  title: string
  url: string
  text?: string
  publishedDate?: string
  author?: string
  image?: string
  favicon?: string
  topComments?: RedditComment[]
  numComments?: number
}

// ============================================================
// RedditSearchCard - Individual Reddit post card with comments
// ============================================================

export interface RedditSearchCardProps extends ComponentProps<'div'> {
  result: RedditSearchResult
}

export function RedditSearchCard({
  result,
  className,
  ...props
}: RedditSearchCardProps) {
  const [imgError, setImgError] = useState(false)
  const [commentsCollapsed, setCommentsCollapsed] = useState(true)

  const formattedDate = formatRelativeDate(result.publishedDate)
  const decodedTitle = decodeHtmlEntities(result.title || 'Untitled')
  const decodedText = decodeHtmlEntities(
    result.text?.slice(0, 300) +
      (result.text && result.text.length > 300 ? '...' : '') || '',
  )
  const hasImage = result.image && !imgError
  const hasComments = result.topComments && result.topComments.length > 0

  // Extract subreddit from URL
  const subredditMatch = result.url.match(/reddit\.com\/r\/([^/]+)/)
  const subreddit = subredditMatch ? `r/${subredditMatch[1]}` : 'Reddit'

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-md',
        className,
      )}
      {...props}
    >
      {/* Post content */}
      <CardContent className="p-3">
        {/* Header with subreddit and date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1 font-medium text-orange-600">
            <RedditIcon className="size-3" />
            {subreddit}
          </span>
          {formattedDate && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3" />
                {formattedDate}
              </span>
            </>
          )}
        </div>

        {/* Title (clickable) */}
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-semibold line-clamp-2 mb-2 hover:text-primary transition-colors"
        >
          {decodedTitle}
        </a>

        {/* Thumbnail if available */}
        {hasImage && (
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted mb-2">
            <img
              src={result.image}
              alt={decodedTitle}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* Text snippet */}
        {decodedText && (
          <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
            {decodedText}
          </p>
        )}

        {/* Stats and comments toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {result.numComments !== undefined && (
              <span className="flex items-center gap-1">
                <MessageSquareIcon className="size-3" />
                {formatNumber(result.numComments)} comments
              </span>
            )}
            {hasComments && (
              <span className="flex items-center gap-1 text-orange-600">
                <ArrowUpIcon className="size-3" />
                {result.topComments?.length} top loaded
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            asChild
          >
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLinkIcon className="size-3" />
              Open
            </a>
          </Button>
        </div>

        {/* Collapsible Comments Section */}
        {hasComments && (
          <Collapsible
            open={!commentsCollapsed}
            onOpenChange={(o) => setCommentsCollapsed(!o)}
            className="mt-3 border-t pt-2"
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors">
              <MessageSquareIcon className="size-3" />
              <span className="flex-1">
                {result.topComments?.length} top comments
              </span>
              <ChevronDownIcon
                className={cn(
                  'size-3 transition-transform duration-200',
                  commentsCollapsed && '-rotate-90',
                )}
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {result.topComments?.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-md bg-muted/50 p-2 text-xs"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <UserIcon className="size-3 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        u/{comment.author}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <ArrowUpIcon className="size-3" />
                        {formatNumber(comment.score)}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-4 leading-relaxed">
                      {comment.body}
                    </p>

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-2 pl-2 border-l-2 border-muted-foreground/20 space-y-1">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="text-[10px]">
                            <span className="font-medium text-foreground/80">
                              u/{reply.author}
                            </span>
                            <span className="text-muted-foreground ml-1">
                              {formatNumber(reply.score)} pts
                            </span>
                            <p className="mt-0.5 text-muted-foreground/80 line-clamp-2">
                              {reply.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// RedditSearchTool - Main component for Reddit search results
// ============================================================

export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export interface RedditSearchToolOutput {
  success?: boolean
  query?: string
  accepted?: RedditSearchResult[]
  rejected?: any[]
  totalFound?: number
  totalAccepted?: number
  totalRejected?: number
  searchTime?: number
  filterTime?: number
  message?: string
  error?: string
}

export interface RedditSearchToolProps extends ComponentProps<'div'> {
  state: ToolState
  input?: { query?: string } | string
  output?: RedditSearchToolOutput
}

export function RedditSearchTool({
  state,
  input,
  output,
  className,
  ...props
}: RedditSearchToolProps) {
  // Main results collapsed by default
  const [isCollapsed, setIsCollapsed] = useState(true)

  // Parse input
  const query =
    typeof input === 'string'
      ? input
      : typeof input === 'object'
        ? input?.query
        : undefined

  // Determine display state
  const isLoading = state === 'input-streaming' || state === 'input-available'
  const isError = state === 'output-error' || (output && !output.success)
  const isSuccess = state === 'output-available' && output?.success

  const accepted = output?.accepted ?? []
  const errorMessage = output?.error ?? 'Reddit search failed'

  return (
    <div
      className={cn(
        'my-2 rounded-lg border bg-card p-3 max-w-full overflow-hidden',
        isLoading && 'border-primary/30 bg-primary/5',
        isError && 'border-destructive/50 bg-destructive/5',
        className,
      )}
      {...props}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Searching Reddit...</span>
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
              Fetching posts & comments...
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
        <Collapsible
          open={!isCollapsed}
          onOpenChange={(o) => setIsCollapsed(!o)}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
            <RedditIcon className="size-4 text-orange-600" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">
                {accepted.length} {accepted.length === 1 ? 'post' : 'posts'}{' '}
                found
              </span>
              {query && (
                <p className="truncate text-xs text-muted-foreground">
                  "{query}"
                </p>
              )}
            </div>
            <ChevronDownIcon
              className={cn(
                'size-4 flex-shrink-0 text-muted-foreground transition-transform duration-200',
                isCollapsed && '-rotate-90',
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            {accepted.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-3">
                {accepted.map((result, index) => (
                  <RedditSearchCard
                    key={result.id || result.url || index}
                    result={result}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                {output?.message ?? 'No Reddit results found for this query.'}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

// Export for fetchRedditPost compatibility (kept separate tool)
export const RedditPostCommentsTool = RedditSearchTool
export type RedditPostCommentsToolOutput = RedditSearchToolOutput
