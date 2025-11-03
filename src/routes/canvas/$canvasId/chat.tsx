// src/routes/canvas/$canvasId.chat.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Chat } from "@/features/chat/components/Chat";
import { ThreadSidebar } from "@/features/chat/components/ThreadSidebar";
import { useUIMessages } from "@convex-dev/agent/react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/canvas/$canvasId/chat")({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error("Not authenticated");
    }
    if (!context.orgId) {
      throw new Error("No organization selected");
    }
  },
  component: FullScreenChat,
  errorComponent: ({ error }) => {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  },
});

function FullScreenChat() {
  const { canvasId } = Route.useParams();
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null);

  // Load canvas data
  const canvasData = useQuery(
    api.canvas.functions.getCanvasWithNodes,
    { canvasId: canvasId as Id<"canvases"> }
  );

  // Load all threads for this canvas
  const threads = useQuery(
    api.canvas.threads.listCanvasThreads,
    canvasId ? { canvasId: canvasId as Id<"canvases"> } : "skip"
  ) ?? [];

  // Auto-select first thread on load
  useEffect(() => {
    if (threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0]._id);
    }
  }, [threads, selectedThreadId]);

  // Get selected thread data
  const selectedThread = threads.find((t) => t._id === selectedThreadId);

  // Load messages for selected thread
  const messagesQuery = useUIMessages(
    api.chat.functions.listMessages,
    selectedThread?.agentThreadId ? { threadId: selectedThread.agentThreadId } : "skip",
    {
      initialNumItems: 50,
      stream: true,
    }
  );

  const messages = messagesQuery.results;
  const isStreaming = messages?.some((m) => m.status === "streaming") ?? false;

  // Find first chat node on canvas for context gathering
  const chatNode = canvasData?.nodes?.find((node) => node.nodeType === "chat");

  // Get context from connected nodes (using first chat node)
  const contextMessages = useQuery(
    api.canvas.nodes.getNodeContext,
    chatNode ? { canvasNodeId: chatNode._id } : "skip"
  );

  // Actions
  const createThread = useAction(api.canvas.threads.createCanvasThread);
  const deleteThreadMutation = useMutation(api.chat.functions.deleteThread);
  const sendMessage = useAction(api.canvas.chat.sendMessage);

  const handleCreateThread = async () => {
    if (!canvasId) {
      toast.error("Cannot create thread: missing canvas ID");
      return;
    }

    try {
      const result = await createThread({
        canvasId: canvasId as Id<"canvases">,
      });
      toast.success("New thread created");
      setSelectedThreadId(result.threadId);
    } catch (error) {
      console.error("[FullScreenChat] Error creating thread:", error);
      toast.error("Failed to create thread");
    }
  };

  const handleSelectThread = async (threadId: Id<"threads">) => {
    setSelectedThreadId(threadId);
  };

  const handleDeleteThread = async (threadId: Id<"threads">) => {
    try {
      await deleteThreadMutation({ threadId });
      toast.success("Thread deleted");

      // If deleted thread was selected, select another or clear
      if (selectedThreadId === threadId) {
        const remainingThreads = threads.filter((t) => t._id !== threadId);
        if (remainingThreads.length > 0) {
          setSelectedThreadId(remainingThreads[0]._id);
        } else {
          setSelectedThreadId(null);
        }
      }
    } catch (error) {
      console.error("[FullScreenChat] Error deleting thread:", error);
      toast.error("Failed to delete thread");
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedThreadId) {
      toast.error("Please select a thread first");
      return;
    }

    // Find any chat node on the canvas to use for context gathering
    // Prioritize the first chat node found
    const chatNode = canvasData?.nodes?.find((node) => node.nodeType === "chat");

    if (!chatNode) {
      toast.error("No chat node found on canvas. Please add a chat node first.");
      return;
    }

    try {
      await sendMessage({
        threadId: selectedThreadId,
        canvasNodeId: chatNode._id,
        message,
      });
    } catch (error) {
      console.error("[FullScreenChat] Error sending message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    }
  };

  const isChatReady = selectedThread?.agentThreadId && messages !== undefined;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/canvas/$canvasId" params={{ canvasId }}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Canvas
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">
              {canvasData?.canvas?.title || "Canvas Chat"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Full-screen chat view
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thread Sidebar */}
        <ThreadSidebar
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
          onCreateThread={handleCreateThread}
          onDeleteThread={handleDeleteThread}
          contextMessages={contextMessages}
          className="w-64 border-r"
        />

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {isChatReady ? (
            <Chat
              key={selectedThread.agentThreadId}
              messages={messages || []}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              streams={[]}
              variant="fullscreen"
              className="h-full"
            />
          ) : selectedThreadId ? (
            <div className="flex items-center justify-center flex-1">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mb-2 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Loading chat...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">No Thread Selected</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Create or select a thread to start chatting
                </p>
                <Button onClick={handleCreateThread}>
                  Create New Thread
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
