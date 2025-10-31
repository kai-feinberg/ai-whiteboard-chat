// src/features/canvas/components/WebsiteNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Globe, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WebsiteNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  websiteNodeId: Id<"website_nodes">;
}

export function WebsiteNode({ data }: NodeProps<WebsiteNodeData>) {
  const [showContent, setShowContent] = useState(false);

  // Query website node data
  const websiteNode = useQuery(
    api.canvas.functions.getWebsiteNode,
    data.websiteNodeId ? { websiteNodeId: data.websiteNodeId } : "skip"
  );

  if (!websiteNode) {
    return (
      <Node handles={{ target: false, source: true }}>
        <NodeHeader>
          <NodeTitle className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4" />
            Website
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
          <Globe className="h-4 w-4" />
          Website
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <div className="space-y-3">
          {/* Status Display */}
          {websiteNode.status === "pending" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing to scrape...</span>
            </div>
          )}

          {websiteNode.status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Scraping website...</span>
            </div>
          )}

          {websiteNode.status === "failed" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{websiteNode.error || "Failed to scrape website"}</span>
            </div>
          )}

          {websiteNode.status === "completed" && (
            <>
              {/* Screenshot */}
              {websiteNode.screenshotUrl && (
                <div className="relative w-full rounded border overflow-hidden">
                  <img
                    src={websiteNode.screenshotUrl}
                    alt={websiteNode.title || "Website screenshot"}
                    className="w-full h-auto"
                  />
                </div>
              )}

              {/* Title/URL */}
              <div className="text-sm font-medium truncate" title={websiteNode.title || websiteNode.url}>
                {websiteNode.title || websiteNode.url}
              </div>

              {/* Markdown Content */}
              {websiteNode.markdown && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContent(!showContent)}
                    className="w-full justify-between text-sm"
                  >
                    <span>Content</span>
                    {showContent ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  {showContent && (
                    <ScrollArea className="h-48 w-full rounded border bg-muted/50">
                      <div className="p-3 text-xs">
                        <p className="whitespace-pre-wrap">{websiteNode.markdown}</p>
                      </div>
                    </ScrollArea>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {websiteNode.markdown.split(" ").length} words
                  </div>
                </div>
              )}

              {!websiteNode.markdown && (
                <div className="text-sm text-muted-foreground">
                  No content available
                </div>
              )}
            </>
          )}
        </div>
      </NodeContent>
    </Node>
  );
}
