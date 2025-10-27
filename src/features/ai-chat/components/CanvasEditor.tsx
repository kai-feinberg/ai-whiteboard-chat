// src/features/ai-chat/components/CanvasEditor.tsx
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { api } from "../../../../convex/_generated/api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CanvasEditorProps {
  documentId: string;
  documentVersion?: number;
}

export function CanvasEditor({ documentId, documentVersion }: CanvasEditorProps) {
  const sync = useTiptapSync(api.agents.canvas, documentId);
  const [isHovering, setIsHovering] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Disable local history since we're using sync
        heading: { levels: [1, 2, 3, 4, 5, 6] }, // Customize heading levels
        // All other extensions use defaults (includes bold, italic, strike, etc.)
      }),
      Markdown, // Enable markdown parsing/serialization (must match server)
      ...(sync.extension ? [sync.extension] : []),
    ],
    content: sync.initialContent || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none p-8",
      },
    },
  }, [sync.initialContent, sync.extension]);

  const copyAsMarkdown = async () => {
    console.log('[CanvasEditor] Copy clicked');

    if (!editor) {
      console.error('[CanvasEditor] No editor instance');
      return;
    }

    try {
      // Get text content from the editor
      const content = editor.getText();
      console.log('[CanvasEditor] Extracted text:', content);

      await navigator.clipboard.writeText(content);
      console.log('[CanvasEditor] Successfully copied to clipboard');

      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("[CanvasEditor] Failed to copy:", error);
      toast.error("Failed to copy: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Log sync state for debugging
  useEffect(() => {
    console.log('[CanvasEditor] Sync state:', {
      isLoading: sync.isLoading,
      hasInitialContent: !!sync.initialContent,
      hasExtension: !!sync.extension,
      documentId,
      documentVersion,
    });
  }, [sync.isLoading, sync.initialContent, sync.extension, documentId, documentVersion]);

  // Handle document version changes (AI edits) - force editor to reload
  useEffect(() => {
    console.log('[CanvasEditor] Document version changed:', documentVersion);

    // When AI updates the document, the version changes
    // The sync system should automatically pull the changes, but we can force a refresh
    if (editor && documentVersion && documentVersion > 1) {
      console.log('[CanvasEditor] AI updated document, sync will pull changes automatically');
      // The useTiptapSync hook automatically handles syncing new changes
      // No manual intervention needed - the extension handles it
    }
  }, [documentVersion, editor]);

  if (sync.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2 mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (sync.initialContent === null && sync.create) {
    // Document doesn't exist yet, create it
    console.log('[CanvasEditor] Creating initial document');
    sync.create({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "AI Playground Document" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Start typing or ask the AI to write something..." }],
        },
      ],
    });
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Initializing document...</p>
      </div>
    );
  }

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 overflow-y-auto flex justify-center relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="w-[80%]">
          <EditorContent editor={editor} />
        </div>

        {/* Copy as Markdown button - appears on hover */}
        {isHovering && (
          <div className="absolute top-4 right-4">
            <Button
              variant="outline"
              size="sm"
              onClick={copyAsMarkdown}
              className="shadow-md hover:shadow-lg transition-all"
              title="Copy document text"
            >
              {isCopied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
