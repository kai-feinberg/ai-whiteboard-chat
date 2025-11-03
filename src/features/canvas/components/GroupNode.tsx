// src/features/canvas/components/GroupNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Folder, Edit2, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import type { NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";

interface GroupNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  groupNodeId: Id<"group_nodes">;
}

export function GroupNode({ data }: NodeProps<GroupNodeData>) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const updateGroupTitle = useMutation(api.canvas.groups.updateGroupTitle);
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

  const childCount = groupChildren?.length || 0;

  return (
    <Node
      handles={{ target: true, source: true }}
      className="border-2 border-dashed border-primary/30 bg-primary/5"
      style={{
        // Groups should be larger and act as containers
        minWidth: "600px",
        minHeight: "400px",
      }}
    >
      <NodeHeader className="bg-primary/10">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary" />
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
      <NodeContent className="flex items-center justify-center text-muted-foreground text-xs min-h-[300px]">
        {childCount === 0 ? (
          <div className="text-center">
            <p>Drag nodes here to group them</p>
          </div>
        ) : (
          <div className="text-center opacity-30">
            <p>Contains {childCount} node{childCount !== 1 ? "s" : ""}</p>
          </div>
        )}
      </NodeContent>
    </Node>
  );
}
