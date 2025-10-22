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
} from "@/components/ai-elements/prompt-input";
import { MessageSquare, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";

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
}

// Component for rendering a message with smooth text streaming
function StreamingMessage({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  // Extract tool calls from the message
  const toolInvocations = message.parts?.filter(
    (part: any) => part.type === "tool-call" || part.type === "tool-result"
  );

  return (
    <Message from={message.role} key={message.id}>
      <MessageContent>
        {/* Show tool calls if present */}
        {toolInvocations && toolInvocations.length > 0 && (
          <div className="space-y-2 mb-3">
            {toolInvocations.map((tool: any, idx: number) => {
              if (tool.type === "tool-call") {
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm"
                  >
                    <Wrench className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-blue-900 dark:text-blue-100">
                        Calling tool: {tool.toolName}
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

        {/* Show the text response */}
        <Response>{visibleText}</Response>
      </MessageContent>
    </Message>
  );
}

export function ChatPanel({ messages, onSendMessage, isStreaming }: ChatPanelProps) {
  const handleSubmit = async (message: { text?: string; files?: any[] }) => {
    if (!message.text?.trim() || isStreaming) return;

    try {
      await onSendMessage(message.text);
    } catch (error) {
      console.error("[ChatPanel] Error sending message:", error);
      throw error; // Re-throw so PromptInput can handle it
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-12" />}
              title="Start a conversation"
              description="Ask the AI to write something in the document!"
            />
          ) : (
            messages.map((message) => (
              <StreamingMessage key={message.id} message={message} />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        onSubmit={handleSubmit}
        className="mt-4 w-full relative border-t pt-4 px-4"
      >
        <PromptInputTextarea
          placeholder="Ask the AI to write something... (Shift+Enter for new line)"
          className="pr-12"
        />
        <PromptInputSubmit
          status={isStreaming ? "streaming" : "ready"}
          className="absolute bottom-5 right-5"
        />
      </PromptInput>
    </div>
  );
}
