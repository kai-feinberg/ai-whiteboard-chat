// src/features/canvas/components/TikTokNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Loader2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TikTokNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  tiktokNodeId: Id<"tiktok_nodes">;
}

export function TikTokNode({ data }: NodeProps<TikTokNodeData>) {
  const [showTranscript, setShowTranscript] = useState(false);

  // Query TikTok node data
  const tiktokNode = useQuery(
    api.canvas.functions.getTikTokNode,
    data.tiktokNodeId ? { tiktokNodeId: data.tiktokNodeId } : "skip"
  );

  if (!tiktokNode) {
    return (
      <Node handles={{ target: false, source: true }}>
        <NodeHeader>
          <NodeTitle className="flex items-center gap-2 text-sm">
            <TikTokIcon />
            TikTok
          </NodeTitle>
        </NodeHeader>
        <NodeContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </NodeContent>
      </Node>
    );
  }

  return (
    <Node handles={{ target: false, source: true }}>
      <NodeHeader>
        <NodeTitle className="flex items-center gap-2 text-sm">
          <TikTokIcon />
          TikTok
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <div className="space-y-3">
          {/* TikTok Video Preview */}
          <div
            className="relative w-full bg-gradient-to-br from-cyan-500 via-pink-500 to-yellow-500 rounded-lg overflow-hidden cursor-pointer group"
            style={{ paddingBottom: "56.25%" }}
            onClick={() => window.open(tiktokNode.url, '_blank')}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
              <TikTokIcon className="w-16 h-16 mb-4" />
              <div className="bg-white/90 rounded-full p-4 group-hover:scale-110 transition-transform">
                <svg
                  className="w-8 h-8 text-pink-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="mt-4 flex items-center gap-2 text-white text-sm">
                <span>Watch on TikTok</span>
                <ExternalLink className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Video Information */}
          {tiktokNode.status === "completed" && (
            <div className="space-y-2">
              {tiktokNode.title && (
                <div className="text-sm">
                  <p className="font-medium line-clamp-2">{tiktokNode.title}</p>
                </div>
              )}
              {tiktokNode.author && (
                <div className="text-xs text-muted-foreground">
                  @{tiktokNode.author}
                </div>
              )}
            </div>
          )}

          {/* Status Display */}
          {tiktokNode.status === "pending" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing video data...</span>
            </div>
          )}

          {tiktokNode.status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fetching transcript...</span>
            </div>
          )}

          {tiktokNode.status === "failed" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{tiktokNode.error || "Failed to fetch video data"}</span>
            </div>
          )}

          {tiktokNode.status === "completed" && tiktokNode.transcript && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full justify-between text-sm"
              >
                <span>Transcript</span>
                {showTranscript ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showTranscript && (
                <ScrollArea className="h-48 w-full rounded border bg-muted/50">
                  <div className="p-3 text-xs">
                    <p className="whitespace-pre-wrap">{tiktokNode.transcript}</p>
                  </div>
                </ScrollArea>
              )}

              <div className="text-xs text-muted-foreground">
                {tiktokNode.transcript.split(" ").length} words
              </div>
            </div>
          )}

          {tiktokNode.status === "completed" && !tiktokNode.transcript && (
            <div className="text-sm text-muted-foreground">
              No transcript available
            </div>
          )}
        </div>
      </NodeContent>
    </Node>
  );
}

// TikTok logo icon component
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || "h-4 w-4"}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}
