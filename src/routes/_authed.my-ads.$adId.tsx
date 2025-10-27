// src/routes/_authed.my-ads.$adId.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, ArrowLeft } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { AdBreadcrumb } from "@/components/AdBreadcrumb";

export const Route = createFileRoute("/_authed/my-ads/$adId")({
  component: AdDetail,
});

const PIPELINE_STAGES = [
  { value: "to_do", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready_for_review", label: "Ready for Review" },
  { value: "asset_creation", label: "Asset Creation" },
  { value: "ready_to_publish", label: "Ready to Publish" },
  { value: "published", label: "Published" },
];

function AdDetail() {
  const { adId } = Route.useParams();
  const ad = useQuery(api.adCreation.functions.getCreatedAdById, {
    adId: adId as Id<"createdAds">,
  });
  const documents = useQuery(api.adCreation.functions.getAdDocuments, {
    adId: adId as Id<"createdAds">,
  });

  const updateStage = useMutation(api.adCreation.functions.updatePipelineStage);

  const handleStageChange = async (newStage: string) => {
    try {
      await updateStage({ adId: adId as Id<"createdAds">, newStage });
      toast.success("Pipeline stage updated");
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update stage");
    }
  };

  if (!ad) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <AdBreadcrumb
        segments={[
          { label: "My Ads", href: "/my-ads" },
          { label: ad.name },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{ad.name}</h1>
          <p className="text-muted-foreground">
            Created {new Date(ad.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Link to="/my-ads/$adId/chat" params={{ adId }}>
          <Button size="lg">
            <MessageSquare className="mr-2 h-4 w-4" />
            Edit in Chat
          </Button>
        </Link>
      </div>

      {/* Pipeline Stage */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pipeline Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={ad.pipelineStage} onValueChange={handleStageChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Ad Framework */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Ad Framework</CardTitle>
          <CardDescription>The strategic elements selected for this ad</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Concept</h3>
            <div>
              <p className="font-medium">{ad.concept?.name}</p>
              <p className="text-sm text-muted-foreground">{ad.concept?.description}</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Angle</h3>
            <div>
              <p className="font-medium">{ad.angle?.name}</p>
              <p className="text-sm text-muted-foreground">{ad.angle?.description}</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Style</h3>
            <div>
              <p className="font-medium">{ad.style?.name}</p>
              <p className="text-sm text-muted-foreground">{ad.style?.description}</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Hook</h3>
            <div>
              <p className="font-medium">{ad.hook?.name}</p>
              <p className="text-sm text-muted-foreground">{ad.hook?.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Audience */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Target Desires</CardTitle>
            <CardDescription>{ad.desires?.length || 0} selected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ad.desires?.map((desire) => (
                <div key={desire._id} className="flex items-start">
                  <Badge variant="secondary" className="mr-2 shrink-0">
                    {desire.category || "other"}
                  </Badge>
                  <p className="text-sm">{desire.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target Beliefs</CardTitle>
            <CardDescription>{ad.beliefs?.length || 0} selected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ad.beliefs?.map((belief) => (
                <div key={belief._id} className="flex items-start">
                  <Badge variant="secondary" className="mr-2 shrink-0">
                    {belief.category || "other"}
                  </Badge>
                  <p className="text-sm">{belief.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>4 collaborative documents created for this ad</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {documents?.map((doc) => (
              <div
                key={doc._id}
                className="p-4 border rounded-lg"
              >
                <h4 className="font-semibold mb-1 capitalize">
                  {doc.documentType.replace("_", " ")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  Version {doc.documentVersion}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link to="/my-ads/$adId/chat" params={{ adId }}>
              <Button variant="outline" className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Edit Documents in Chat
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
