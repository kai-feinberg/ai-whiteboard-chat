// src/features/canvas/components/ChatNode.tsx
import { Node, NodeHeader, NodeTitle, NodeContent } from "@/components/ai-elements/canvas/node";
import { Chat } from "@/features/chat/components/Chat";
import { ThreadSidebar } from "@/features/chat/components/ThreadSidebar";
import { MessageSquare, Maximize2, Loader2 } from "lucide-react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useUIMessages } from "@convex-dev/agent/react";
import { toast } from "sonner";
import type { NodeProps } from "@xyflow/react";
import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCustomer } from "autumn-js/react";

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

  // Agent state management with localStorage persistence
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => {
    // Try to load from localStorage on mount
    if (typeof window !== "undefined" && data.canvasId) {
      const stored = localStorage.getItem(`canvas-agent-${data.canvasId}`);
      return stored || null;
    }
    return null;
  });

  // Model state management with localStorage persistence
  const [selectedModelId, setSelectedModelId] = useState<string | null>(() => {
    // Try to load from localStorage on mount
    if (typeof window !== "undefined" && data.canvasId) {
      const stored = localStorage.getItem(`canvas-model-${data.canvasId}`);
      return stored || "anthropic/claude-haiku-4.5"; // Default to Claude Haiku
    }
    return "anthropic/claude-haiku-4.5"; // Default to Claude Haiku
  });

  // Sync selected thread when data changes
  useEffect(() => {
    if (data.selectedThreadId !== selectedThreadId) {
      setSelectedThreadId(data.selectedThreadId);
    }
  }, [data.selectedThreadId]);

  // Load default agent on mount if no stored agent
  const defaultAgent = useQuery(api.agents.functions.getDefaultAgent);
  useEffect(() => {
    if (defaultAgent && !selectedAgentId) {
      setSelectedAgentId(defaultAgent);
    }
  }, [defaultAgent, selectedAgentId]);

  // Persist agent selection to localStorage
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    if (typeof window !== "undefined" && data.canvasId) {
      localStorage.setItem(`canvas-agent-${data.canvasId}`, agentId);
    }
  };

  // Persist model selection to localStorage
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    if (typeof window !== "undefined" && data.canvasId) {
      localStorage.setItem(`canvas-model-${data.canvasId}`, modelId);
    }
  };

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
        modelId: selectedModelId || undefined,
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

  // Get customer data for credit balance
  const { customer, refetch } = useCustomer();

  const handleSendMessage = async (message: string, agentId?: string, modelId?: string) => {
    if (!selectedThreadId || !data.canvasNodeId) {
      toast.error("Please select a thread first");
      return;
    }

    // Check credit balance before sending
    const monthlyBalance = customer?.features?.ai_credits?.balance || 0;
    const topUpBalance = customer?.features?.topup_credits?.balance || 0;
    const totalBalance = monthlyBalance + topUpBalance;

    // Block send if no credits
    if (totalBalance <= 0) {
      toast.error("Out of credits! Purchase top-up credits to continue.", {
        duration: 5000,
        action: {
          label: "Buy Credits",
          onClick: () => {
            window.location.href = "/credits";
          },
        },
      });
      return;
    }

    // Warn if credits low but allow send
    if (totalBalance < 100) {
      toast.warning("Low credits! Consider purchasing more.", {
        duration: 4000,
        action: {
          label: "Buy Credits",
          onClick: () => {
            window.location.href = "/credits";
          },
        },
      });
    }

    try {
      await sendMessage({
        threadId: selectedThreadId,
        canvasNodeId: data.canvasNodeId,
        message,
        agentId: agentId || selectedAgentId || undefined,
        modelId: modelId || selectedModelId || undefined,
      });
      // Refetch credits after message to update sidebar
      await refetch();
    } catch (error) {
      console.error("[ChatNode] Error sending message:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";

      // Enhanced error handling for credit errors
      if (errorMessage.includes("No credits remaining") || errorMessage.includes("Insufficient credits")) {
        toast.error("Out of credits! Purchase top-up credits to continue.", {
          duration: 5000,
          action: {
            label: "Buy Credits",
            onClick: () => {
              window.location.href = "/credits";
            },
          },
        });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const isChatReady = selectedThread?.agentThreadId && messages !== undefined;

  return (
    <Node handles={{ target: true, source: false }} width="1300px" height="975px" className="flex flex-col">
      <NodeHeader variant="chat" className="flex items-center justify-between">
        <NodeTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" />
          Chat Node
        </NodeTitle>
        <Link to="/canvas/$canvasId/chat" params={{ canvasId: data.canvasId }}>
          <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-purple-200/50 transition-colors">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </NodeHeader>
      <NodeContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex h-full w-full overflow-hidden">
          {/* Thread Sidebar */}
          <ThreadSidebar
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            onCreateThread={handleCreateThread}
            onDeleteThread={handleDeleteThread}
            contextMessages={contextMessages}
            canvasId={data.canvasId}
            className="w-48 border-r overflow-y-auto"
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
                variant="compact"
                className="h-full"
                selectedAgentId={selectedAgentId}
                onAgentChange={handleAgentChange}
                selectedModelId={selectedModelId}
                onModelChange={handleModelChange}
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
