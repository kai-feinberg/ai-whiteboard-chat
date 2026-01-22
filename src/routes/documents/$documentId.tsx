import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import * as React from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/documents/$documentId")({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error("Not authenticated");
    }
    if (!context.orgId) {
      throw new Error("No organization selected");
    }
  },
  component: DocumentEditorPage,
});

function DocumentEditorPage() {
  const navigate = useNavigate();
  const { documentId } = Route.useParams();
  const { orgId } = useAuth();

  const document = useQuery(api.documents.functions.getDocument, {
    documentId: documentId as Id<"documents">,
  });
  const updateDocument = useMutation(api.documents.functions.updateDocument);

  // Local state for editing
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [hasInitialized, setHasInitialized] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "idle">("idle");

  // Track last saved content to avoid race conditions with Convex subscription
  const lastSavedContentRef = React.useRef<string>("");
  const lastSavedTitleRef = React.useRef<string>("");
  // Track pending saves to avoid premature "saved" status
  const pendingSavesRef = React.useRef(0);

  // Initialize local state when document loads
  React.useEffect(() => {
    if (document && !hasInitialized) {
      setTitle(document.title);
      setContent(document.content);
      lastSavedContentRef.current = document.content;
      lastSavedTitleRef.current = document.title;
      setHasInitialized(true);
      setSaveStatus("saved");
    }
  }, [document, hasInitialized]);

  // Debounced save for content
  React.useEffect(() => {
    if (!hasInitialized) return;

    // Only save if content differs from last saved value
    if (content === lastSavedContentRef.current) return;

    const timeoutId = setTimeout(async () => {
      // Double-check before saving
      if (content === lastSavedContentRef.current) return;

      pendingSavesRef.current++;
      setSaveStatus("saving");
      try {
        await updateDocument({
          documentId: documentId as Id<"documents">,
          content,
        });
        lastSavedContentRef.current = content;
        pendingSavesRef.current--;
        if (pendingSavesRef.current === 0) {
          setSaveStatus("saved");
        }
      } catch (error) {
        console.error("[Document] Error saving content:", error);
        pendingSavesRef.current--;
        toast.error("Failed to save document");
        setSaveStatus("idle");
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [content, documentId, hasInitialized, updateDocument]);

  // Save title on blur
  const handleTitleBlur = async () => {
    const titleToSave = title || "Untitled Document";
    if (titleToSave === lastSavedTitleRef.current) return;

    pendingSavesRef.current++;
    setSaveStatus("saving");
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        title: titleToSave,
      });
      lastSavedTitleRef.current = titleToSave;
      pendingSavesRef.current--;
      if (pendingSavesRef.current === 0) {
        setSaveStatus("saved");
      }
    } catch (error) {
      console.error("[Document] Error saving title:", error);
      pendingSavesRef.current--;
      toast.error("Failed to save title");
      setSaveStatus("idle");
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate({ to: "/documents" });
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization to view documents.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (document === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  // 404 - document not found or wrong org
  if (document === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Document Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This document doesn't exist or you don't have access to it.
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaveStatus("idle");
            }}
            onBlur={handleTitleBlur}
            placeholder="Untitled Document"
            className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 w-full max-w-xl"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4 overflow-auto">
        <Textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaveStatus("idle");
          }}
          placeholder="Start writing your notes here... (Markdown supported)"
          className="w-full h-full min-h-[calc(100vh-200px)] resize-none border-none shadow-none focus-visible:ring-0 text-base font-mono"
        />
      </div>
    </div>
  );
}
