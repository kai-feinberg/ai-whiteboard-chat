// src/features/ai-chat/components/CanvasEditor.tsx
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { api } from "../../../../convex/_generated/api";
import { useEffect } from "react";

interface CanvasEditorProps {
  documentId: string;
  documentVersion?: number;
}

export function CanvasEditor({ documentId, documentVersion }: CanvasEditorProps) {
  const sync = useTiptapSync(api.agents.canvas, documentId);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Disable local history since we're using sync
        heading: { levels: [1, 2, 3, 4, 5, 6] }, // Customize heading levels
        // All other extensions use defaults (including inputRules for markdown shortcuts)
      }),
      ...(sync.extension ? [sync.extension] : []),
    ],
    content: sync.initialContent || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none p-8",
      },
    },
  }, [sync.initialContent, sync.extension]);

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
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <div className="border-t p-2 text-xs text-muted-foreground">
        {sync.extension ? "✓ Connected" : "⚠ Not synced"} • Version {documentVersion || 1}
      </div>
    </div>
  );
}
