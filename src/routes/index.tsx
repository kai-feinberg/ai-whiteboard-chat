import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Plus, Layout, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const canvases = useQuery(api.canvas.functions.listCanvases) ?? [];
  const createCanvas = useMutation(api.canvas.functions.createCanvas);
  const deleteCanvas = useMutation(api.canvas.functions.deleteCanvas);

  const handleCreateCanvas = async () => {
    try {
      const result = await createCanvas({});
      toast.success("Canvas created");
      navigate({ to: `/canvas/${result.canvasId}` });
    } catch (error) {
      console.error("[Dashboard] Error creating canvas:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create canvas"
      );
    }
  };

  const handleDeleteCanvas = async (canvasId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Delete this canvas? This will remove all nodes and cannot be undone.")) {
      return;
    }

    try {
      await deleteCanvas({ canvasId: canvasId as any });
      toast.success("Canvas deleted");
    } catch (error) {
      console.error("[Dashboard] Error deleting canvas:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete canvas"
      );
    }
  };

  const handleSelectCanvas = (canvasId: string) => {
    navigate({ to: `/canvas/${canvasId}` });
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization to view canvases.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Canvases</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your infinite canvas workspaces
          </p>
        </div>
        <Button onClick={handleCreateCanvas} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Canvas
        </Button>
      </div>

      {canvases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Layout className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No canvases yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create your first canvas to start organizing content and chatting with AI
            </p>
            <Button onClick={handleCreateCanvas} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Canvas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {canvases.map((canvas) => (
            <Card
              key={canvas._id}
              className="cursor-pointer hover:shadow-lg transition-shadow relative group"
              onClick={() => handleSelectCanvas(canvas._id)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground z-10"
                onClick={(e) => handleDeleteCanvas(canvas._id, e)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5 text-muted-foreground" />
                  {canvas.title}
                </CardTitle>
                {canvas.description && (
                  <CardDescription>{canvas.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Updated {new Date(canvas.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
