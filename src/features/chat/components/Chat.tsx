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
import { MessageSquare, Loader2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import { AgentSelector } from "@/features/agents/components/AgentSelector";
import { ModelSelector } from "@/features/models/components/ModelSelector";

export interface ChatProps {
  messages: UIMessage[];
  onSendMessage: (message: string, agentId?: string, modelId?: string) => Promise<void>;
  isStreaming?: boolean;
  streams?: any[];
  variant?: "fullscreen" | "compact";
  className?: string;
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string) => void;
  selectedModelId?: string | null;
  onModelChange?: (modelId: string) => void;
}

// Component for rendering a message with smooth text streaming
function StreamingMessage({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.text) return;

    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

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

        {/* Copy button for AI messages only */}
        {message.role === "assistant" && message.text && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded"
            aria-label="Copy message"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
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
  selectedModelId,
  onModelChange,
}: ChatProps) {
  const handleSubmit = async (message: { text?: string; files?: any[] }) => {
    if (!message.text?.trim() || isStreaming) return;

    try {
      await onSendMessage(message.text, selectedAgentId || undefined, selectedModelId || undefined);
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
        <div className="p-4">
          {/* Agent and Model Selectors */}
          {(onAgentChange || onModelChange) && (
            <div className="flex gap-2 mb-2">
              {onAgentChange && (
                <AgentSelector
                  value={selectedAgentId ?? null}
                  onChange={onAgentChange}
                />
              )}
              {onModelChange && (
                <ModelSelector
                  value={selectedModelId ?? null}
                  onChange={onModelChange}
                />
              )}
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
