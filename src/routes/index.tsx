import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Plus, Layout, Calendar, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";
import { useCustomer, CheckoutDialog } from "autumn-js/react";
import { Progress } from "@/components/ui/progress";
import * as React from "react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const canvases = useQuery(api.canvas.functions.listCanvases) ?? [];
  const createCanvas = useAction(api.canvas.functions.createCanvas);
  const deleteCanvas = useAction(api.canvas.functions.deleteCanvas);
  const { customer, check, checkout } = useCustomer();

  // Get current product - check products array
  const currentProduct = customer?.products?.[0];
  const productName = currentProduct?.name || "Free";
  const isPro = productName === "Pro";

  // Get canvas feature - features is an object keyed by feature ID
  const canvasFeature = customer?.features?.canvases;
  const usedCanvases = canvasFeature?.usage || 0;
  const limitCanvases = canvasFeature?.included_usage || 3;
  const isUnlimited = canvasFeature?.unlimited || limitCanvases >= 999999;

  const handleCreateCanvas = async () => {
    try {
      // Optional: Proactive UX - warn user before hitting backend limit
      if (usedCanvases >= limitCanvases && !isUnlimited) {
        const upgradeResult = await checkout({
          productId: "pro",
          dialog: CheckoutDialog,
        });

        // If user didn't upgrade, don't proceed
        if (!upgradeResult) {
          return;
        }
      }

      // Backend enforces limit securely - this will throw if limit reached
      const result = await createCanvas({});
      toast.success("Canvas created");
      navigate({ to: `/canvas/${result.canvasId}` });
    } catch (error) {
      console.error("[Dashboard] Error creating canvas:", error);

      // Show specific error message from backend
      const errorMessage = error instanceof Error ? error.message : "Failed to create canvas";

      // If it's a limit error, offer upgrade
      if (errorMessage.includes("limit reached") || errorMessage.includes("Upgrade to Pro")) {
        toast.error(errorMessage, {
          action: {
            label: "Upgrade",
            onClick: () => checkout({ productId: "pro", dialog: CheckoutDialog }),
          },
        });
      } else {
        toast.error(errorMessage);
      }
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
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

        {/* Usage Display */}
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layout className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Canvas Usage</span>
              </div>
              {isPro && (
                <div className="flex items-center gap-1 text-xs text-yellow-600">
                  <Sparkles className="h-3 w-3" />
                  <span>Pro</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {usedCanvases} / {isUnlimited ? "Unlimited" : limitCanvases} canvases
                </span>
                {!isUnlimited && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round((usedCanvases / limitCanvases) * 100)}%
                  </span>
                )}
              </div>
              {!isUnlimited && (
                <Progress value={(usedCanvases / limitCanvases) * 100} className="h-2" />
              )}
              {!isPro && usedCanvases >= limitCanvases - 1 && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate({ to: "/pricing" })}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upgrade to Pro for Unlimited
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
