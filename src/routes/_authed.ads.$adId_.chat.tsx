// src/routes/_authed.ads.$adId_.chat.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CanvasLayout } from "@/features/ai-chat/components/CanvasLayout";
import { CanvasEditor } from "@/features/ai-chat/components/CanvasEditor";
import { ChatPanel } from "@/features/ai-chat/components/ChatPanel";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";
import { useUIMessages } from "@convex-dev/agent/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/ads/$adId_/chat")({
  component: AdChat,
});

type DocumentType = "details" | "copy" | "asset_brief" | "notes";

function AdChat() {
  const { adId } = Route.useParams();
  const { orgId } = useAuth();

  // State for active document tab
  const [activeDocType, setActiveDocType] = useState<DocumentType>("copy");

  // Fetch ad details
  const ad = useQuery(api.adCreation.functions.getCreatedAdById, {
    adId: adId as Id<"createdAds">,
  });

  // Fetch all 4 documents for this ad
  const documents = useQuery(api.adCreation.functions.getAdDocuments, {
    adId: adId as Id<"createdAds">,
  });

  // Get the active document based on selected tab
  const activeDocument = documents?.find((doc) => doc.documentType === activeDocType);

  // Get thread for this ad
  const threadData = useQuery(api.adCreation.functions.getAdThreadId, {
    adId: adId as Id<"createdAds">,
  });
  const threadId = threadData?.threadId ?? null;

  // Action to send message to AI
  const sendMessageAction = useAction(api.adCreation.actions.sendAdMessage);

  // Use the useUIMessages hook for streaming support
  const { results: messages } = useUIMessages(
    api.agents.actions.listThreadMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 50,
      stream: true,
    }
  );

  // Check if we're currently streaming
  const isStreaming = messages?.some((m) => m.status === "streaming") ?? false;

  const handleSendMessage = async (message: string) => {
    console.log("[AdChat] Sending message:", message);

    try {
      await sendMessageAction({
        adId: adId as Id<"createdAds">,
        message,
        activeDocumentId: activeDocument?.documentId || "",
      });
    } catch (error) {
      console.error("[AdChat] Error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to get AI response"
      );
    }
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization to use the ad chat.
          </p>
        </div>
      </div>
    );
  }

  if (!ad || !documents) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <CanvasLayout
      documentHeader={
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{ad.name}</h1>
              <p className="text-sm text-muted-foreground">
                {ad.concept?.name} • {ad.angle?.name} • {ad.style?.name}
              </p>
            </div>
            <Tabs value={activeDocType} onValueChange={(value) => setActiveDocType(value as DocumentType)}>
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="copy">Copy</TabsTrigger>
                <TabsTrigger value="asset_brief">Asset Brief</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      }
      documentPanel={
        activeDocument ? (
          <CanvasEditor
            key={activeDocument.documentId} // Force remount on document change
            documentId={activeDocument.documentId}
            documentVersion={activeDocument.documentVersion}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading document...</p>
          </div>
        )
      }
      chatPanel={
        <ChatPanel
          messages={messages ?? []}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
        />
      }
    />
  );
}
