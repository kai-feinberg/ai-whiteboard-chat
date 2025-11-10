// src/features/chat/components/Chat.tsx
"use client";

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
  PromptInputBody,
} from "@/components/ai-elements/prompt-input";
import { MessageSquare, Loader2 } from "lucide-react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import { AgentSelector } from "@/features/agents/components/AgentSelector";

export interface ChatProps {
  messages: UIMessage[];
  onSendMessage: (message: string, agentId?: string) => Promise<void>;
  isStreaming?: boolean;
  streams?: any[];
  variant?: "fullscreen" | "compact";
  className?: string;
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string) => void;
}

// Component for rendering a message with smooth text streaming
function StreamingMessage({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  return (
    <Message from={message.role} key={message.id}>
      <MessageContent>
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

export function Chat({
  messages,
  onSendMessage,
  isStreaming = false,
  streams = [],
  variant = "fullscreen",
  className,
  selectedAgentId,
  onAgentChange,
}: ChatProps) {
  const handleSubmit = async (message: { text?: string; files?: any[] }) => {
    if (!message.text?.trim() || isStreaming) return;

    try {
      await onSendMessage(message.text, selectedAgentId || undefined);
    } catch (error) {
      console.error("[Chat] Error sending message:", error);
      throw error;
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col nopan nowheel h-full",
        className
      )}
    >
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-12" />}
              title="Start a conversation"
              description="Send a message to begin chatting with the AI"
            />
          ) : (
            messages.map((message) => (
              <StreamingMessage key={message.id} message={message} />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t">
        {/* Activity status indicator */}
        {isStreaming && (
          <div className="px-4 pt-2 pb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>AI is responding...</span>
            </div>
          </div>
        )}

        <div className="p-4">
          {/* Agent Selector */}
          {onAgentChange && (
            <div className="mb-2">
              <AgentSelector
                value={selectedAgentId}
                onChange={onAgentChange}
              />
            </div>
          )}

          <PromptInput onSubmit={handleSubmit} className="w-full relative">
            <PromptInputTextarea
              placeholder="Type a message... (Shift+Enter for new line)"
              className="pr-12"
              disabled={isStreaming}
            />
            <PromptInputSubmit
              status={isStreaming ? "streaming" : "ready"}
              className="absolute bottom-2 right-2"
              disabled={isStreaming}
            />
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
