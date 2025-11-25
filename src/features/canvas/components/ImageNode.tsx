// src/features/canvas/components/ImageNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NodeProps } from "@xyflow/react";

interface ImageNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  imageNodeId: Id<"image_nodes">;
}

export function ImageNode({ data }: NodeProps<ImageNodeData>) {
  // Query image node data
  const imageNode = useQuery(
    api.canvas.functions.getImageNode,
    data.imageNodeId ? { imageNodeId: data.imageNodeId } : "skip"
  );

  if (!imageNode) {
    return (
      <Node handles={{ target: false, source: false }}>
        <NodeHeader variant="default">
          <NodeTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" />
            AI Image
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
    <Node handles={{ target: false, source: false }}>
      <NodeHeader variant="default" className="bg-gradient-to-br from-violet-50 to-purple-100/70 text-purple-900 border-purple-200/60">
        <NodeTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4" />
          {imageNode.isAiGenerated ? "AI Generated Image" : "Image"}
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <div className="space-y-3">
          {/* Status Display */}
          {imageNode.status === "pending" && (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <span className="text-sm text-muted-foreground">Preparing image generation...</span>
            </div>
          )}

          {imageNode.status === "processing" && (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <span className="text-sm text-muted-foreground">Generating image...</span>
            </div>
          )}

          {imageNode.status === "failed" && (
            <div className="flex flex-col items-center gap-2 p-8 text-destructive">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm text-center">{imageNode.error || "Failed to generate image"}</span>
            </div>
          )}

          {imageNode.status === "completed" && imageNode.imageUrl && (
            <div className="space-y-2">
              {/* Generated Image */}
              <div className="relative w-full overflow-hidden rounded">
                <img
                  src={imageNode.imageUrl}
                  alt={imageNode.prompt}
                  className="w-full h-auto"
                  style={{ maxHeight: "512px", objectFit: "contain" }}
                />
              </div>

              {/* Prompt Display */}
              <div className="text-xs text-muted-foreground px-2 py-1 bg-secondary/50 rounded">
                <span className="font-medium">Prompt:</span> {imageNode.prompt}
              </div>
            </div>
          )}

          {imageNode.status === "completed" && !imageNode.imageUrl && (
            <div className="flex items-center justify-center p-8">
              <span className="text-sm text-muted-foreground">Image not available</span>
            </div>
          )}
        </div>
      </NodeContent>
    </Node>
  );
}
