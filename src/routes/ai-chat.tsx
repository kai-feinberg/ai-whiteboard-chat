// src/routes/ai-chat.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CanvasLayout } from "@/features/ai-chat/components/CanvasLayout";
import { CanvasEditor } from "@/features/ai-chat/components/CanvasEditor";
import { ChatPanel } from "@/features/ai-chat/components/ChatPanel";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";
import { useUIMessages } from "@convex-dev/agent/react";

export const Route = createFileRoute("/ai-chat")({
  component: AIChat,
});

function AIChat() {
  const { orgId } = useAuth();

  // Get the playground document for this organization
  const playgroundDoc = useQuery(api.documents.functions.getPlaygroundDocument);

  // Get the playground thread (loads on page load)
  const playgroundThread = useQuery(api.agents.actions.getPlaygroundThread);
  const threadId = playgroundThread?.threadId ?? null;

  // Action to send message to AI
  const sendMessageAction = useAction(api.agents.actions.sendMessage);

  // Generate document ID based on organization
  const documentId = orgId ? `playground-doc-${orgId}` : "playground-doc-default";

  // Use the useUIMessages hook for streaming support
  const { results: messages, streams } = useUIMessages(
    api.agents.actions.listThreadMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 50,
      stream: true, // Enable streaming support
    }
  );

  // Debug logging for streams
  useEffect(() => {
    if (streams && streams.length > 0) {
      console.log("[AIChat] Streams updated:", {
        count: streams.length,
        streams: streams.map((s: any) => ({
          messageId: s.messageId,
          deltas: s.deltas?.map((d: any) => ({
            type: d.type,
            toolCallId: d.toolCallId,
            toolName: d.toolName,
            inputTextDelta: d.inputTextDelta
          }))
        }))
      });
    }
  }, [streams]);

  // Debug logging for messages state changes
  useEffect(() => {
    console.log("[AIChat] Messages updated:", {
      count: messages?.length ?? 0,
      messages: messages?.map(m => ({
        id: m.id,
        role: m.role,
        status: m.status,
        textLength: m.text?.length ?? 0,
        hasParts: !!m.parts,
        partsCount: m.parts?.length ?? 0,
        parts: m.parts?.map((p: any) => ({ type: p.type, toolName: p.toolName }))
      }))
    });
  }, [messages]);

  // Check if we're currently streaming (any message has streaming status)
  const isStreaming = messages?.some((m) => m.status === "streaming") ?? false;

  useEffect(() => {
    console.log("[AIChat] isStreaming changed:", isStreaming);
  }, [isStreaming]);

  const handleSendMessage = async (message: string) => {
    console.log("[AIChat] Sending message:", message);

    try {
      // Let the backend handle thread creation/retrieval
      await sendMessageAction({
        message,
      });

      // Thread will be automatically picked up by the query on the next refresh
    } catch (error) {
      console.error("[AIChat] Error:", error);
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
            Please select an organization to use the AI Chat playground.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CanvasLayout
      documentPanel={
        <CanvasEditor
          documentId={documentId}
          documentVersion={playgroundDoc?.documentVersion}
        />
      }
      chatPanel={
        <ChatPanel
          messages={messages ?? []}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          streams={streams ?? []}
        />
      }
    />
  );
}
