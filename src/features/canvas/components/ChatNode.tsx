// src/features/canvas/components/ChatNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Chat } from "@/features/chat/components/Chat";
import { ThreadSidebar } from "@/features/chat/components/ThreadSidebar";
import { MessageSquare } from "lucide-react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useUIMessages } from "@convex-dev/agent/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import { useState, useEffect } from "react";

interface ChatNodeData {
  canvasNodeId: Id<"canvas_nodes">;
  chatNodeId: Id<"chat_nodes"> | null;
  canvasId: Id<"canvases">;
  selectedThreadId: Id<"threads"> | null;
  selectedAgentThreadId: string | null;
}

export function ChatNode({ data }: NodeProps<ChatNodeData>) {
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(
    data.selectedThreadId
  );

  // Sync selected thread when data changes
  useEffect(() => {
    if (data.selectedThreadId !== selectedThreadId) {
      setSelectedThreadId(data.selectedThreadId);
    }
  }, [data.selectedThreadId]);

  // Get context from connected nodes
  const contextMessages = useQuery(
    api.canvas.nodes.getNodeContext,
    data.canvasNodeId ? { canvasNodeId: data.canvasNodeId } : "skip"
  );

  // Load all threads for this canvas
  const threads = useQuery(
    api.canvas.threads.listCanvasThreads,
    data.canvasId ? { canvasId: data.canvasId } : "skip"
  ) ?? [];

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

  // Actions
  const createThread = useAction(api.canvas.threads.createCanvasThread);
  const selectThread = useMutation(api.canvas.threads.selectThread);
  const sendMessage = useAction(api.canvas.chat.sendMessage);
  const deleteThreadMutation = useMutation(api.chat.functions.deleteThread);

  const handleCreateThread = async () => {
    console.log("[ChatNode] handleCreateThread called", { canvasId: data.canvasId, chatNodeId: data.chatNodeId });

    if (!data.canvasId || !data.chatNodeId) {
      console.error("[ChatNode] Missing required data:", { canvasId: data.canvasId, chatNodeId: data.chatNodeId });
      toast.error("Cannot create thread: missing required data");
      return;
    }

    try {
      const result = await createThread({
        canvasId: data.canvasId,
      });
      toast.success("New thread created");

      // Select the new thread
      await selectThread({
        chatNodeId: data.chatNodeId,
        threadId: result.threadId,
      });
      setSelectedThreadId(result.threadId);
    } catch (error) {
      console.error("[ChatNode] Error creating thread:", error);
      toast.error("Failed to create thread");
    }
  };

  const handleSelectThread = async (threadId: Id<"threads">) => {
    if (!data.chatNodeId) return;

    try {
      await selectThread({
        chatNodeId: data.chatNodeId,
        threadId,
      });
      setSelectedThreadId(threadId);
    } catch (error) {
      console.error("[ChatNode] Error selecting thread:", error);
      toast.error("Failed to select thread");
    }
  };

  const handleDeleteThread = async (threadId: Id<"threads">) => {
    try {
      await deleteThreadMutation({ threadId });
      toast.success("Thread deleted");

      // If deleted thread was selected, select another or clear
      if (selectedThreadId === threadId) {
        const remainingThreads = threads.filter((t) => t._id !== threadId);
        if (remainingThreads.length > 0) {
          handleSelectThread(remainingThreads[0]._id);
        } else {
          setSelectedThreadId(null);
        }
      }
    } catch (error) {
      console.error("[ChatNode] Error deleting thread:", error);
      toast.error("Failed to delete thread");
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedThreadId || !data.canvasNodeId) {
      toast.error("Please select a thread first");
      return;
    }

    try {
      await sendMessage({
        threadId: selectedThreadId,
        canvasNodeId: data.canvasNodeId,
        message,
      });
    } catch (error) {
      console.error("[ChatNode] Error sending message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    }
  };

  const isChatReady = selectedThread?.agentThreadId && messages !== undefined;

  return (
    <Node handles={{ target: true, source: false }} width="800px" height="600px" className="flex flex-col">
      <NodeHeader>
        <NodeTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" />
          Chat Node
        </NodeTitle>
      </NodeHeader>
      <NodeContent className="p-0 flex-1 flex flex-col overflow-hidden">
        <div className="flex h-full w-full">
          {/* Thread Sidebar */}
          <ThreadSidebar
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            onCreateThread={handleCreateThread}
            onDeleteThread={handleDeleteThread}
            className="w-48 border-r"
          />

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Context indicator */}
            {contextMessages && contextMessages.length > 0 && (
              <div className="px-3 py-2 bg-muted border-b text-xs text-muted-foreground">
                <span className="font-medium">
                  Context from {contextMessages.length} connected node
                  {contextMessages.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {isChatReady ? (
              <Chat
                key={selectedThread.agentThreadId}
                messages={messages || []}
                onSendMessage={handleSendMessage}
                isStreaming={isStreaming}
                streams={[]}
                variant="compact"
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
                  <MessageSquare className="h-12 w-12 mb-2 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium mb-1">No Thread Selected</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Create or select a thread to start chatting
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </NodeContent>
    </Node>
  );
}
