// src/features/canvas/components/FacebookAdNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { TranscriptDialog } from "@/components/TranscriptDialog";

interface FacebookAdNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  facebookAdNodeId: Id<"facebook_ads_nodes">;
}

export function FacebookAdNode({ data }: NodeProps<FacebookAdNodeData>) {
  const [showFullCopy, setShowFullCopy] = useState(false);

  // Query Facebook Ad node data
  const facebookAdNode = useQuery(
    api.canvas.functions.getFacebookAdNode,
    data.facebookAdNodeId ? { facebookAdNodeId: data.facebookAdNodeId } : "skip"
  );

  if (!facebookAdNode) {
    return (
      <Node handles={{ target: false, source: true }}>
        <NodeHeader>
          <NodeTitle className="flex items-center gap-2 text-sm">
            <FacebookIcon />
            Facebook Ad
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
          <FacebookIcon />
          Facebook Ad
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <div className="space-y-3">
          {/* Ad Media Preview */}
          {facebookAdNode.status === "completed" && (
            <div>
              {/* Video Preview */}
              {facebookAdNode.mediaType === "video" && (
                <div
                  className="relative w-full max-h-[300px] bg-black rounded-lg overflow-hidden cursor-pointer group flex items-center justify-center"
                  onClick={() => facebookAdNode.url && window.open(facebookAdNode.url, '_blank')}
                >
                  {facebookAdNode.videoThumbnailUrl ? (
                    <>
                      <img
                        src={facebookAdNode.videoThumbnailUrl}
                        alt="Video thumbnail"
                        className="max-w-full max-h-[300px] object-contain"
                      />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-blue-600/90 rounded-full p-4 group-hover:bg-blue-600 group-hover:scale-110 transition-all shadow-lg">
                          <svg
                            className="w-8 h-8 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 p-8">
                      <FacebookIcon className="w-16 h-16 mb-4 text-white" />
                      <div className="bg-white/90 rounded-full p-4 group-hover:scale-110 transition-transform">
                        <svg
                          className="w-8 h-8 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-white text-sm">
                        <span>View on Facebook</span>
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image Preview (carousel for multiple images) */}
              {facebookAdNode.mediaType === "image" && facebookAdNode.imageUrls && facebookAdNode.imageUrls.length > 0 && (
                <div className="relative w-full max-h-[300px] rounded-lg overflow-hidden bg-black flex items-center justify-center">
                  <div
                    className="cursor-pointer"
                    onClick={() => facebookAdNode.url && window.open(facebookAdNode.url, '_blank')}
                  >
                    {facebookAdNode.imageUrls[0] && (
                      <img
                        src={facebookAdNode.imageUrls[0]}
                        alt="Ad image"
                        className="max-w-full max-h-[300px] object-contain rounded-lg"
                      />
                    )}
                  </div>
                  {facebookAdNode.imageUrls.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      +{facebookAdNode.imageUrls.length - 1} more
                    </div>
                  )}
                </div>
              )}

              {/* Fallback for no media */}
              {facebookAdNode.mediaType === "none" && (
                <div
                  className="relative w-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg overflow-hidden cursor-pointer group p-8"
                  onClick={() => facebookAdNode.url && window.open(facebookAdNode.url, '_blank')}
                >
                  <div className="flex flex-col items-center justify-center text-white">
                    <FacebookIcon className="w-16 h-16 mb-2" />
                    <div className="flex items-center gap-2 text-sm">
                      <span>View on Facebook</span>
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ad Information */}
          {facebookAdNode.status === "completed" && (
            <div className="space-y-2">
              {/* Title */}
              {facebookAdNode.title && (
                <div className="text-sm">
                  <p className="font-semibold line-clamp-2">{facebookAdNode.title}</p>
                </div>
              )}

              {/* Page Name */}
              {facebookAdNode.pageName && (
                <div className="text-xs text-muted-foreground">
                  {facebookAdNode.pageName}
                </div>
              )}

              {/* Ad Body Copy */}
              {facebookAdNode.body && (
                <div className="space-y-1">
                  <div className={`text-xs ${showFullCopy ? '' : 'line-clamp-3'}`}>
                    {facebookAdNode.body}
                  </div>
                  {facebookAdNode.body.length > 150 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullCopy(!showFullCopy)}
                      className="h-6 text-xs px-2"
                    >
                      {showFullCopy ? "Show less" : "Show more"}
                    </Button>
                  )}
                </div>
              )}

              {/* Link Description */}
              {facebookAdNode.linkDescription && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  {facebookAdNode.linkDescription}
                </div>
              )}

              {/* Publisher Platforms */}
              {facebookAdNode.publisherPlatform && facebookAdNode.publisherPlatform.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {facebookAdNode.publisherPlatform.map((platform) => (
                    <span
                      key={platform}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded capitalize"
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Display */}
          {facebookAdNode.status === "pending" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing ad data...</span>
            </div>
          )}

          {facebookAdNode.status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fetching ad details...</span>
            </div>
          )}

          {facebookAdNode.status === "failed" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{facebookAdNode.error || "Failed to fetch ad data"}</span>
            </div>
          )}

          {/* Transcript Section */}
          {facebookAdNode.status === "completed" && facebookAdNode.transcript && (
            <TranscriptDialog
              transcript={facebookAdNode.transcript}
              title="Video Transcript"
              triggerText="View Transcript"
              triggerClassName="w-full"
            />
          )}
        </div>
      </NodeContent>
    </Node>
  );
}

// Facebook logo icon component
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || "h-4 w-4"}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
