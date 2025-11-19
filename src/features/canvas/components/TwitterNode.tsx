// src/features/canvas/components/TwitterNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";
import { Tweet } from "react-tweet";

interface TwitterNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  twitterNodeId: Id<"twitter_nodes">;
}

export function TwitterNode({ data }: NodeProps<TwitterNodeData>) {
  // Query Twitter node data
  const twitterNode = useQuery(
    api.canvas.functions.getTwitterNode,
    data.twitterNodeId ? { twitterNodeId: data.twitterNodeId } : "skip"
  );

  if (!twitterNode) {
    return (
      <Node handles={{ target: false, source: true }}>
        <NodeHeader variant="twitter">
          <NodeTitle className="flex items-center gap-2 text-sm">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Twitter/X
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
      <NodeHeader variant="twitter">
        <NodeTitle className="flex items-center gap-2 text-sm">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Twitter/X
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <div className="space-y-3">
          {/* Status Display */}
          {twitterNode.status === "pending" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing tweet...</span>
            </div>
          )}

          {twitterNode.status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fetching tweet...</span>
            </div>
          )}

          {twitterNode.status === "failed" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{twitterNode.error || "Failed to fetch tweet"}</span>
            </div>
          )}

          {twitterNode.status === "completed" && twitterNode.fullText && (
            <div className="w-full">
              <Tweet id={twitterNode.tweetId} />
            </div>
          )}

          {twitterNode.status === "completed" && !twitterNode.fullText && (
            <div className="text-sm text-muted-foreground">
              No tweet data available
            </div>
          )}
        </div>
      </NodeContent>
    </Node>
  );
}
