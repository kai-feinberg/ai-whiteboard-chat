// src/features/canvas/components/TextNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { FileText } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import type { NodeProps } from "@xyflow/react";

interface TextNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  content: string;
}

export function TextNode({ data }: NodeProps<TextNodeData>) {
  const [content, setContent] = useState(data.content || "");
  const [lastSavedContent, setLastSavedContent] = useState(data.content || "");
  const updateTextNode = useMutation(api.canvas.nodes.updateTextNode);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Only sync from DB when content is different from what we've saved locally
  useEffect(() => {
    // Only update local state if DB content is different from what we last saved
    // This prevents overwriting user's unsaved changes
    if (data.content !== lastSavedContent && data.content !== content) {
      setContent(data.content || "");
      setLastSavedContent(data.content || "");
    }
  }, [data.content]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const saveContent = useCallback(async (contentToSave: string) => {
    if (contentToSave === lastSavedContent) {
      return; // No changes to save
    }

    try {
      await updateTextNode({
        canvasNodeId: data.canvasNodeId,
        content: contentToSave,
      });

      if (isMountedRef.current) {
        setLastSavedContent(contentToSave);
      }
    } catch (error) {
      console.error("[TextNode] Error updating content:", error);
      if (isMountedRef.current) {
        toast.error("Failed to save text");
      }
    }
  }, [updateTextNode, data.canvasNodeId, lastSavedContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce save for 500ms
    debounceTimerRef.current = setTimeout(() => {
      saveContent(newContent);
    }, 500);
  };

  const handleBlur = () => {
    // Save immediately on blur
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    saveContent(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      saveContent(content);
    }
  };

  return (
    <Node handles={{ target: false, source: true }}>
      <NodeHeader>
        <NodeTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          Text Node
        </NodeTitle>
      </NodeHeader>
      <NodeContent>
        <textarea
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type your text here..."
          className="w-full h-48 p-2 text-sm bg-transparent border-none outline-none resize-none focus:ring-0"
          style={{ minHeight: "12rem" }}
        />
      </NodeContent>
    </Node>
  );
}
