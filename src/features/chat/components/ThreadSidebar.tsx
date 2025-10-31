// src/features/chat/components/ThreadSidebar.tsx
"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

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
  className?: string;
}

export function ThreadSidebar({
  threads,
  selectedThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  className,
}: ThreadSidebarProps) {
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
                  "group relative flex items-center gap-2 rounded-md p-3 cursor-pointer transition-colors",
                  selectedThreadId === thread._id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
                onClick={() => onSelectThread(thread._id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {thread.title || "Untitled Chat"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(thread.updatedAt).toLocaleDateString()}
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
    </div>
  );
}
