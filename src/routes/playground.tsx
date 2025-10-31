// src/routes/playground.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Chat } from "@/features/chat/components/Chat";
import { ThreadSidebar } from "@/features/chat/components/ThreadSidebar";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";
import { useUIMessages } from "@convex-dev/agent/react";
import type { Id } from "../../convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const { orgId } = useAuth();

  // State for selected thread
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null);

  // Load all threads for the organization
  const threads = useQuery(api.chat.functions.listThreads) ?? [];

  // Get selected thread data
  const selectedThread = useQuery(
    api.chat.functions.getThread,
    selectedThreadId ? { threadId: selectedThreadId } : "skip"
  );

  // Actions
  const createThreadAction = useAction(api.chat.functions.createChatThread);
  const sendMessageAction = useAction(api.chat.functions.sendMessage);
  const deleteThreadMutation = useMutation(api.chat.functions.deleteThread);

  // Load messages for selected thread using useUIMessages hook
  // Only load messages if we have a valid agentThreadId
  const messagesQuery = useUIMessages(
    api.chat.functions.listMessages,
    selectedThread?.agentThreadId ? { threadId: selectedThread.agentThreadId } : "skip",
    {
      initialNumItems: 50,
      stream: true,
    }
  );

  const messages = messagesQuery.results;

  // Check if streaming
  const isStreaming = messages?.some((m) => m.status === "streaming") ?? false;

  // Guard: Only show chat if thread data is fully loaded and messages are from the correct thread
  // This prevents showing stale messages during thread transitions
  const isChatReady = selectedThreadId && selectedThread?.agentThreadId && messages !== undefined;

  // Auto-select first thread if none selected
  useEffect(() => {
    if (threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0]._id);
    }
  }, [threads.length, selectedThreadId]);

  const handleCreateThread = async () => {
    try {
      const result = await createThreadAction({
        title: `Chat ${new Date().toLocaleString()}`,
      });
      toast.success("New chat created");
      setSelectedThreadId(result.threadId as Id<"threads">);
    } catch (error) {
      console.error("[Playground] Error creating thread:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create chat"
      );
    }
  };

  const handleDeleteThread = async (threadId: Id<"threads">) => {
    try {
      await deleteThreadMutation({ threadId });
      toast.success("Chat deleted");

      // If deleted thread was selected, select another or clear
      if (selectedThreadId === threadId) {
        const remainingThreads = threads.filter(t => t._id !== threadId);
        setSelectedThreadId(remainingThreads.length > 0 ? remainingThreads[0]._id : null);
      }
    } catch (error) {
      console.error("[Playground] Error deleting thread:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete chat"
      );
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedThreadId) {
      toast.error("Please select or create a chat first");
      return;
    }

    try {
      await sendMessageAction({
        threadId: selectedThreadId,
        message,
      });
    } catch (error) {
      console.error("[Playground] Error sending message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    }
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization to use the chat playground.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Thread Sidebar */}
      <ThreadSidebar
        threads={threads}
        selectedThreadId={selectedThreadId}
        onSelectThread={setSelectedThreadId}
        onCreateThread={handleCreateThread}
        onDeleteThread={handleDeleteThread}
        className="w-64"
      />

      {/* Chat Area */}
      <div className="flex-1">
        {isChatReady ? (
          <Chat
            key={selectedThread.agentThreadId}
            messages={messages}
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
            streams={[]}
            variant="fullscreen"
          />
        ) : selectedThreadId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mb-2 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Loading chat...</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">No Chat Selected</h2>
              <p className="text-muted-foreground mb-4">
                Create a new chat or select an existing one to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
