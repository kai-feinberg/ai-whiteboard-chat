// src/features/canvas/components/GroupNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Folder, Edit2, Check, FileText, MessageSquare, Video, Globe, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import type { NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCanvasContext } from "../../../routes/canvas/$canvasId";

interface GroupNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  groupNodeId: Id<"group_nodes">;
}

// Helper to get node icon
const getNodeIcon = (nodeType: string) => {
  switch (nodeType) {
    case "text":
      return <FileText className="h-3 w-3" />;
    case "chat":
      return <MessageSquare className="h-3 w-3" />;
    case "youtube":
      return <Video className="h-3 w-3" />;
    case "website":
      return <Globe className="h-3 w-3" />;
    case "tiktok":
      return <Video className="h-3 w-3" />;
    case "facebook_ad":
      return <Globe className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

// Helper to get node title
const getNodeTitle = (child: any) => {
  switch (child.nodeType) {
    case "text":
      return "Text Note";
    case "chat":
      return "Chat";
    case "youtube":
      return child.youtubeTitle || "YouTube Video";
    case "website":
      return child.websiteTitle || "Website";
    case "tiktok":
      return child.tiktokTitle || "TikTok Video";
    case "facebook_ad":
      return child.facebookAdTitle || "Facebook Ad";
    default:
      return "Node";
  }
};

// Helper to get node preview content
const getNodePreview = (child: any) => {
  switch (child.nodeType) {
    case "text":
      return child.textContent?.substring(0, 60) || "Empty text node";
    case "chat":
      return "AI conversation";
    case "youtube":
      return child.youtubeUrl;
    case "website":
      return child.websiteUrl;
    case "tiktok":
      return `by ${child.tiktokAuthor || "Unknown"}`;
    case "facebook_ad":
      return child.facebookAdPageName || "Facebook Ad";
    default:
      return "";
  }
};

export function GroupNode({ data }: NodeProps<GroupNodeData>) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { onNodeUngrouped } = useCanvasContext();

  const updateGroupTitle = useMutation(api.canvas.groups.updateGroupTitle);
  const removeNodeFromGroup = useMutation(api.canvas.groups.removeNodeFromGroup);
  const groupChildren = useQuery(api.canvas.groups.getGroupChildren, {
    canvasNodeId: data.canvasNodeId,
  });

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = async () => {
    if (title.trim()) {
      try {
        await updateGroupTitle({
          canvasNodeId: data.canvasNodeId,
          title: title.trim(),
        });
        setIsEditingTitle(false);
      } catch (error) {
        console.error("[GroupNode] Error updating title:", error);
        toast.error("Failed to update group title");
      }
    } else {
      setIsEditingTitle(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
    }
  };

  const handleRemoveChild = async (childId: Id<"canvas_nodes">, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    try {
      const result = await removeNodeFromGroup({ canvasNodeId: childId });

      // Notify canvas to add node back to React Flow
      if (result.node && onNodeUngrouped) {
        onNodeUngrouped(result.node);
      }

      toast.success("Node removed from group");
    } catch (error) {
      console.error("[GroupNode] Error removing child:", error);
      toast.error("Failed to remove node from group");
    }
  };

  const childCount = groupChildren?.length || 0;

  return (
    <Node
      handles={{ target: true, source: true }}
      className="border-2 border-dashed border-primary/30 bg-primary/5"
      style={{
        width: "900px",
        height: "700px",
      }}
    >
      <NodeHeader variant="group">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            {isEditingTitle ? (
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-sm font-medium focus:ring-0"
                placeholder="Group Name"
              />
            ) : (
              <NodeTitle className="flex items-center gap-2 text-sm">
                <span>Group</span>
                {childCount > 0 && (
                  <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full">
                    {childCount} items
                  </span>
                )}
              </NodeTitle>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              if (isEditingTitle) {
                handleSaveTitle();
              } else {
                setIsEditingTitle(true);
              }
            }}
          >
            {isEditingTitle ? (
              <Check className="h-3 w-3" />
            ) : (
              <Edit2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </NodeHeader>
      <NodeContent className="p-4 overflow-auto" style={{ minHeight: "620px", maxHeight: "620px" }}>
        {childCount === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            <p>Drag nodes here to group them</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 auto-rows-min">
            {groupChildren?.map((child) => (
              <Card
                key={child._id}
                className="relative p-3 hover:shadow-md transition-shadow cursor-pointer border border-border/50"
                style={{
                  width: "400px",
                  height: "280px",
                  position: "relative",
                }}
              >
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemoveChild(child._id, e)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors z-10"
                  title="Remove from group"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>

                {/* Node icon and title */}
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className="text-muted-foreground">
                    {getNodeIcon(child.nodeType)}
                  </div>
                  <div className="font-medium text-sm truncate">
                    {getNodeTitle(child)}
                  </div>
                </div>

                {/* Node preview content */}
                <div className="text-xs text-muted-foreground overflow-hidden">
                  <div className="line-clamp-6">
                    {getNodePreview(child)}
                  </div>
                </div>

                {/* Position indicator (for debugging) */}
                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/50">
                  {Math.round(child.position.x)}, {Math.round(child.position.y)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </NodeContent>
    </Node>
  );
}
