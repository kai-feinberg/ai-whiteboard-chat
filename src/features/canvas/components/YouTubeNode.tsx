// src/features/canvas/components/YouTubeNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Video, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface YouTubeNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  youtubeNodeId: Id<"youtube_nodes">;
}

export function YouTubeNode({ data }: NodeProps<YouTubeNodeData>) {
  const [showTranscript, setShowTranscript] = useState(false);

  // Query YouTube node data
  const youtubeNode = useQuery(
    api.canvas.functions.getYouTubeNode,
    data.youtubeNodeId ? { youtubeNodeId: data.youtubeNodeId } : "skip"
  );

  if (!youtubeNode) {
    return (
      <Node handles={{ target: false, source: true }}>
        <NodeHeader>
          <NodeTitle className="flex items-center gap-2 text-sm">
            <Video className="h-4 w-4" />
            YouTube
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
          <Video className="h-4 w-4" />
          YouTube
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <div className="space-y-3">
          {/* Video Embed */}
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${youtubeNode.videoId}`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full rounded border-0"
            />
          </div>

          {/* Status Display */}
          {youtubeNode.status === "pending" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing transcript...</span>
            </div>
          )}

          {youtubeNode.status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fetching transcript...</span>
            </div>
          )}

          {youtubeNode.status === "failed" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{youtubeNode.error || "Failed to fetch transcript"}</span>
            </div>
          )}

          {youtubeNode.status === "completed" && youtubeNode.transcript && (
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
                    <p className="whitespace-pre-wrap">{youtubeNode.transcript}</p>
                  </div>
                </ScrollArea>
              )}

              <div className="text-xs text-muted-foreground">
                {youtubeNode.transcript.split(" ").length} words
              </div>
            </div>
          )}

          {youtubeNode.status === "completed" && !youtubeNode.transcript && (
            <div className="text-sm text-muted-foreground">
              No transcript available
            </div>
          )}
        </div>
      </NodeContent>
    </Node>
  );
}
