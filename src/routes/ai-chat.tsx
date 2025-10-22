// src/routes/ai-chat.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CanvasLayout } from "@/features/ai-chat/components/CanvasLayout";
import { CanvasEditor } from "@/features/ai-chat/components/CanvasEditor";
import { ChatPanel, ChatMessage } from "@/features/ai-chat/components/ChatPanel";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/ai-chat")({
  component: AIChat,
});

function AIChat() {
  const { orgId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Get the playground document for this organization
  const playgroundDoc = useQuery(api.documents.functions.getPlaygroundDocument);

  // Action to send message to AI
  const sendMessageAction = useAction(api.agents.actions.sendMessage);

  // Generate document ID based on organization
  const documentId = orgId ? `playground-doc-${orgId}` : "playground-doc-default";

  // Load chat history (placeholder - in real implementation would fetch from agent component)
  useEffect(() => {
    // For now, start with empty messages
    // In full implementation, would load message history from the thread
    setMessages([]);
  }, []);

  const handleSendMessage = async (message: string) => {
    console.log("[AIChat] Sending message:", message);

    // Add user message immediately (optimistic update)
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      // Let the backend handle thread creation/retrieval
      const result = await sendMessageAction({
        message,
      });

      console.log("[AIChat] Received response:", result);

      // Add AI response
      const aiMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("[AIChat] Error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to get AI response"
      );

      // Remove the optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsStreaming(false);
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
          messages={messages}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
        />
      }
    />
  );
}
