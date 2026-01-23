import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MessageSquare, Calendar } from "lucide-react";
import { useAuth } from "@clerk/tanstack-react-start";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/chats/")({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error("Not authenticated");
    }
    if (!context.orgId) {
      throw new Error("No organization selected");
    }
  },
  component: ChatsPage,
});

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString();
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return "Just now";
  }
}

function ChatsPage() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const canvasesWithChats = useQuery(api.canvas.functions.listCanvasesWithChats);

  const handleSelectCanvas = (canvasId: Id<"canvases">) => {
    navigate({ to: `/canvas/${canvasId}/chat` });
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization to view chats.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (canvasesWithChats === undefined) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Chats</h1>
              <p className="text-muted-foreground mt-1">
                Jump into your canvas conversations
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Chats</h1>
            <p className="text-muted-foreground mt-1">
              Jump into your canvas conversations
            </p>
          </div>
        </div>
      </div>

      {canvasesWithChats.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No chats yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Add a chat node to any canvas to start a conversation with AI
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {canvasesWithChats.map((item) => (
            <Card
              key={item.canvasId}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleSelectCanvas(item.canvasId)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  {item.canvasName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{item.chatNodeCount} chat{item.chatNodeCount !== 1 ? "s" : ""}</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatRelativeTime(item.lastMessageTimestamp)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
