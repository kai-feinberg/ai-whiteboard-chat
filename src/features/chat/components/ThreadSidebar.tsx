// src/features/chat/components/ThreadSidebar.tsx
"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus, Trash2, Eye, Copy, Check } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";

export interface Thread {
  _id: Id<"threads">;
  agentThreadId: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ThreadSidebarProps {
  threads: Thread[];
  selectedThreadId: Id<"threads"> | null;
  onSelectThread: (threadId: Id<"threads">) => void;
  onCreateThread: () => void;
  onDeleteThread?: (threadId: Id<"threads">) => void;
  contextMessages?: Array<{ role: "system"; content: string }>;
  className?: string;
}

export function ThreadSidebar({
  threads,
  selectedThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  contextMessages,
  className,
}: ThreadSidebarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!contextMessages) return;

    try {
      const fullContext = contextMessages.map((msg) => msg.content).join("\n\n---\n\n");

      if (!fullContext || fullContext.length === 0) {
        toast.error("No content to copy");
        return;
      }

      await navigator.clipboard.writeText(fullContext);

      setCopied(true);
      toast.success(`Copied ${fullContext.length.toLocaleString()} characters to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full border-r bg-muted/10",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b">
        <Button onClick={onCreateThread} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No chats yet</p>
              <p className="text-xs mt-1">Create a new chat to get started</p>
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread._id}
                className={cn(
                  "group relative flex items-center gap-2 rounded-md p-2 cursor-pointer transition-colors",
                  selectedThreadId === thread._id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
                onClick={() => onSelectThread(thread._id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {thread.title && thread.title.length > 15
                      ? `${thread.title.slice(0, 15)}...`
                      : thread.title || "Untitled Chat"}
                  </p>
                </div>
                {onDeleteThread && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread._id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Context Indicator */}
      {contextMessages && contextMessages.length > 0 && (
        <div className="p-3 border-t bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Context from {contextMessages.length} connected node
              {contextMessages.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Eye className="h-3 w-3 mr-2" />
                View Context
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl w-[95vw] h-[80vh] flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Connected Node Context</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </DialogTitle>
                <DialogDescription>
                  Context from {contextMessages.length} connected node
                  {contextMessages.length !== 1 ? "s" : ""} that will be passed to the AI
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 h-[50vh]">
                <div className="space-y-4 max-w-full pr-4">
                  {contextMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg bg-muted/50 border max-w-full"
                    >
                      <pre className="text-xs whitespace-pre-wrap font-mono" style={{ overflowWrap: 'anywhere' }}>
                        {msg.content}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                {(() => {
                  const totalChars = contextMessages.reduce((sum, msg) => sum + msg.content.length, 0);
                  const wordCount = contextMessages.reduce((sum, msg) => {
                    return sum + msg.content.split(/\s+/).filter(Boolean).length;
                  }, 0);
                  const estimatedTokens = Math.ceil(totalChars / 4);
                  return `${wordCount.toLocaleString()} words • ~${estimatedTokens.toLocaleString()} tokens`;
                })()}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
