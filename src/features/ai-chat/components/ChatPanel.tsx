// src/features/ai-chat/components/ChatPanel.tsx
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputSpeechButton,
  PromptInputFooter,
  PromptInputBody,
} from "@/components/ai-elements/prompt-input";
import { MessageSquare, Wrench, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: UIMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isStreaming?: boolean;
  streams?: any[]; // Stream deltas for real-time tool execution tracking
}

// Component for rendering a message with smooth text streaming
function StreamingMessage({
  message,
  messageStream
}: {
  message: UIMessage;
  messageStream?: any; // Stream deltas for this specific message
}) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  // Debug logging for message rendering
  useEffect(() => {
    console.log("[StreamingMessage] Rendering message:", {
      id: message.id,
      role: message.role,
      status: message.status,
      textLength: message.text?.length ?? 0,
      visibleTextLength: visibleText?.length ?? 0,
      hasParts: !!message.parts,
      partsCount: message.parts?.length ?? 0,
      hasStream: !!messageStream,
      streamDeltasCount: messageStream?.deltas?.length ?? 0,
      parts: message.parts?.map((p: any) => ({
        type: p.type,
        toolName: p.toolName,
        hasResult: !!p.result
      })),
      streamDeltas: messageStream?.deltas?.map((d: any) => ({
        type: d.type,
        toolName: d.toolName,
        toolCallId: d.toolCallId
      }))
    });
  }, [message, visibleText, messageStream]);

  // Extract tool calls from the message.parts (finalized after streaming)
  const toolInvocations = message.parts?.filter(
    (part: any) => part.type === "tool-call" || part.type === "tool-result"
  );

  // Detect in-progress tools from stream deltas
  const getToolsInProgress = () => {
    if (!messageStream?.deltas) return [];

    const deltas = messageStream.deltas;
    const toolsInProgress: any[] = [];
    const toolsFinished = new Set<string>();

    // Find all tools that have started and finished
    for (const delta of deltas) {
      if (delta.type === "finish-step" && delta.toolCallId) {
        toolsFinished.add(delta.toolCallId);
      }
    }

    // Find tools that have started but not finished
    for (const delta of deltas) {
      if (delta.type === "start-step" && delta.toolCallId) {
        if (!toolsFinished.has(delta.toolCallId)) {
          // This tool is in progress
          toolsInProgress.push({
            toolCallId: delta.toolCallId,
            toolName: delta.toolName || "unknown"
          });
        }
      }
    }

    return toolsInProgress;
  };

  const toolCallsInProgress = getToolsInProgress();

  useEffect(() => {
    if (toolCallsInProgress.length > 0) {
      console.log("[StreamingMessage] Tools in progress from stream deltas:",
        toolCallsInProgress.map(t => t.toolName)
      );
    }
  }, [toolCallsInProgress.length]);

  return (
    <Message from={message.role} key={message.id}>
      <MessageContent>
        {/* Show in-progress tools from stream deltas */}
        {toolCallsInProgress.length > 0 && (
          <div className="space-y-2 mb-3">
            {toolCallsInProgress.map((tool: any, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm"
              >
                <Loader2 className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0 animate-spin" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    Calling tool: {tool.toolName}...
                  </div>
                  <div className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    Executing...
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show completed tool calls from message.parts */}
        {toolInvocations && toolInvocations.length > 0 && (
          <div className="space-y-2 mb-3">
            {toolInvocations.map((tool: any, idx: number) => {
              if (tool.type === "tool-call") {
                console.log(`[StreamingMessage] Tool call ${tool.toolName}:`, {
                  toolCallId: tool.toolCallId,
                  args: tool.args
                });

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm"
                  >
                    <Wrench className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-blue-900 dark:text-blue-100">
                        Called tool: {tool.toolName}
                      </div>
                      <div className="text-blue-700 dark:text-blue-300 text-xs mt-1 font-mono break-all">
                        {JSON.stringify(tool.args)}
                      </div>
                    </div>
                  </div>
                );
              } else if (tool.type === "tool-result") {
                const isError = tool.isError || false;
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 p-2 rounded-md text-sm ${
                      isError
                        ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                        : "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                    }`}
                  >
                    {isError ? (
                      <XCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-medium ${
                          isError
                            ? "text-red-900 dark:text-red-100"
                            : "text-green-900 dark:text-green-100"
                        }`}
                      >
                        Tool result: {tool.toolName}
                      </div>
                      {tool.result && (
                        <div
                          className={`text-xs mt-1 font-mono break-all ${
                            isError
                              ? "text-red-700 dark:text-red-300"
                              : "text-green-700 dark:text-green-300"
                          }`}
                        >
                          {typeof tool.result === "string"
                            ? tool.result
                            : JSON.stringify(tool.result)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Show loading indicator if streaming and no text yet */}
        {message.status === "streaming" && !visibleText && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        )}

        {/* Show the text response */}
        {visibleText && <Response>{visibleText}</Response>}
      </MessageContent>
    </Message>
  );
}

export function ChatPanel({ messages, onSendMessage, isStreaming, streams = [] }: ChatPanelProps) {
  // const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Log streams updates
  useEffect(() => {
    if (streams.length > 0) {
      console.log("[ChatPanel] Streams prop updated:", {
        count: streams.length,
        streams: streams.map((s: any) => ({
          messageId: s.messageId,
          deltasCount: s.deltas?.length ?? 0
        }))
      });
    }
  }, [streams]);

  // Get current activity status
  const getActivityStatus = () => {
    if (!isStreaming) return null;

    // Find the streaming message
    const streamingMessage = messages?.find(m => m.status === "streaming");
    if (!streamingMessage) return "AI is responding...";

    // Check stream deltas for in-progress tools
    const messageStream = streams.find((s: any) => s.messageId === streamingMessage.id);
    if (messageStream?.deltas) {
      const toolsFinished = new Set<string>();
      const toolsInProgress: string[] = [];

      for (const delta of messageStream.deltas) {
        if (delta.type === "finish-step" && delta.toolCallId) {
          toolsFinished.add(delta.toolCallId);
        }
      }

      for (const delta of messageStream.deltas) {
        if (delta.type === "start-step" && delta.toolCallId && delta.toolName) {
          if (!toolsFinished.has(delta.toolCallId)) {
            toolsInProgress.push(delta.toolName);
          }
        }
      }

      if (toolsInProgress.length > 0) {
        return `Calling tools: ${toolsInProgress.join(", ")}`;
      }
    }

    if (streamingMessage.text) {
      return "AI is writing...";
    }

    return "AI is thinking...";
  };

  const activityStatus = getActivityStatus();

  useEffect(() => {
    console.log("[ChatPanel] Activity status:", activityStatus);
  }, [activityStatus]);

  const handleSubmit = async (message: { text?: string; files?: any[] }) => {
    if (!message.text?.trim() || isStreaming) return;

    console.log("[ChatPanel] Submitting message:", message.text);

    try {
      await onSendMessage(message.text);
    } catch (error) {
      console.error("[ChatPanel] Error sending message:", error);
      throw error; // Re-throw so PromptInput can handle it
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-12" />}
              title="Start a conversation"
              description="Ask the AI to write something in the document!"
            />
          ) : (
            messages.map((message) => {
              // Find the stream for this message
              const messageStream = streams.find((s: any) => s.messageId === message.id);
              return (
                <StreamingMessage
                  key={message.id}
                  message={message}
                  messageStream={messageStream}
                />
              );
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t">
        {/* Activity status indicator */}
        {activityStatus && (
          <div className="px-4 pt-2 pb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{activityStatus}</span>
            </div>
          </div>
        )}

        <div className="p-4">
          <PromptInput onSubmit={handleSubmit} className="w-full relative">
            <PromptInputTextarea
              placeholder="Ask the AI to write something... (Shift+Enter for new line)"
              className="pr-12"
            />
            <PromptInputSubmit
              status={isStreaming ? "streaming" : "ready"}
              className="absolute bottom-2 right-2"
            />
          </PromptInput>
        </div>
      </div>

      {/* Voice input implementation - commented out for now
      <PromptInput
        onSubmit={handleSubmit}
        className="mt-4 w-full border-t pt-4 px-4"
      >
        <PromptInputBody>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Ask the AI to write something... (Shift+Enter for new line)"
          />
          <PromptInputFooter>
            <PromptInputSpeechButton textareaRef={textareaRef} />
            <PromptInputSubmit status={isStreaming ? "streaming" : "ready"} />
          </PromptInputFooter>
        </PromptInputBody>
      </PromptInput>
      */}
    </div>
  );
}
