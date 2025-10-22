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
import { MessageSquare } from "lucide-react";
import { useState } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isStreaming?: boolean;
}

export function ChatPanel({ messages, onSendMessage, isStreaming }: ChatPanelProps) {
  const [input, setInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const messageToSend = input;
    setInput(""); // Clear input immediately for better UX

    try {
      await onSendMessage(messageToSend);
    } catch (error) {
      // If there's an error, restore the message
      setInput(messageToSend);
      console.error("[ChatPanel] Error sending message:", error);
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
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <Response>{message.content}</Response>
                </MessageContent>
              </Message>
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
          value={input}
          placeholder="Ask the AI to write something... (Shift+Enter for new line)"
          onChange={(e) => setInput(e.currentTarget.value)}
          className="pr-12"
        />
        <PromptInputSubmit
          status={isStreaming ? "streaming" : "ready"}
          disabled={!input.trim()}
          className="absolute bottom-5 right-5"
        />
      </PromptInput>
    </div>
  );
}
