// src/routes/canvas/$canvasId.chat.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Chat } from "@/features/chat/components/Chat";
import { ThreadSidebar } from "@/features/chat/components/ThreadSidebar";
import { useUIMessages } from "@convex-dev/agent/react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ChevronDown, Check } from "lucide-react";
import { useCustomer } from "autumn-js/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const navigate = useNavigate();
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null);

  // Reset thread selection when canvas changes (e.g., via switcher dropdown)
  useEffect(() => {
    setSelectedThreadId(null);
  }, [canvasId]);

  // Agent state management with localStorage persistence
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => {
    // Try to load from localStorage on mount
    if (typeof window !== "undefined" && canvasId) {
      const stored = localStorage.getItem(`canvas-agent-${canvasId}`);
      return stored || null;
    }
    return null;
  });

  // Model state management with localStorage persistence
  const [selectedModelId, setSelectedModelId] = useState<string | null>(() => {
    // Try to load from localStorage on mount
    if (typeof window !== "undefined" && canvasId) {
      const stored = localStorage.getItem(`canvas-model-${canvasId}`);
      return stored || "anthropic/claude-haiku-4.5"; // Default to Claude Haiku
    }
    return "anthropic/claude-haiku-4.5"; // Default to Claude Haiku
  });

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
    if (typeof window !== "undefined" && canvasId) {
      localStorage.setItem(`canvas-agent-${canvasId}`, agentId);
    }
  };

  // Persist model selection to localStorage
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    if (typeof window !== "undefined" && canvasId) {
      localStorage.setItem(`canvas-model-${canvasId}`, modelId);
    }
  };

  // Load canvas data
  const canvasData = useQuery(
    api.canvas.functions.getCanvasWithNodes,
    { canvasId: canvasId as Id<"canvases"> }
  );

  // Load canvases with chats for switcher dropdown
  const canvasesWithChats = useQuery(api.canvas.functions.listCanvasesWithChats);

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
        modelId: selectedModelId || undefined,
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

  // Get customer data for credit balance
  const { customer, refetch } = useCustomer();

  const handleSendMessage = async (message: string, agentId?: string, modelId?: string) => {
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
        canvasNodeId: chatNode._id,
        message,
        agentId: agentId || selectedAgentId || undefined,
        modelId: modelId || selectedModelId || undefined,
      });
      // Refetch credits after message to update sidebar
      await refetch();
    } catch (error) {
      console.error("[FullScreenChat] Error sending message:", error);
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/canvas/$canvasId" params={{ canvasId }}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Canvas
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <span className="text-lg font-semibold">
                  {canvasData?.canvas?.title || "Canvas Chat"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {canvasesWithChats === undefined ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : canvasesWithChats.length <= 1 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No other canvases with chats
                </div>
              ) : (
                canvasesWithChats.map((canvas) => (
                  <DropdownMenuItem
                    key={canvas._id}
                    onClick={() => {
                      if (canvas._id !== canvasId) {
                        navigate({ to: "/canvas/$canvasId/chat", params: { canvasId: canvas._id } });
                      }
                    }}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{canvas.title}</span>
                    {canvas._id === canvasId && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
