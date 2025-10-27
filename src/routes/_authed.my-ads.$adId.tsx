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
  { value: "to_do", label: "To Do", color: "var(--stage-to-do)" },
  { value: "in_progress", label: "In Progress", color: "var(--stage-in-progress)" },
  { value: "ready_for_review", label: "Ready for Review", color: "var(--stage-ready-for-review)" },
  { value: "asset_creation", label: "Asset Creation", color: "var(--stage-asset-creation)" },
  { value: "ready_to_publish", label: "Ready to Publish", color: "var(--stage-ready-to-publish)" },
  { value: "published", label: "Published", color: "var(--stage-published)" },
];

const FRAMEWORK_COLORS = {
  concept: "var(--chart-1)",
  angle: "var(--chart-2)",
  style: "var(--chart-3)",
  hook: "var(--chart-4)",
};

const CATEGORY_COLORS: Record<string, string> = {
  financial: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  personal: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
  social: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  professional: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30",
  other: "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
};

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
          <h1 className="text-4xl font-bold mb-2 mt-2 tracking-tight">{ad.name}</h1>
          <p className="text-muted-foreground text-base">
            Created {new Date(ad.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Link to="/my-ads/$adId/chat" params={{ adId }}>
          <Button size="lg" className="shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 mt-2">
            <MessageSquare className="mr-2 h-5 w-5" />
            Edit in Chat
          </Button>
        </Link>
      </div>

      {/* Pipeline Stage */}
      <Card className="mb-8 shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
          <CardTitle className="text-lg">Pipeline Stage</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Select value={ad.pipelineStage} onValueChange={handleStageChange}>
            <SelectTrigger className="w-[250px] shadow-sm">
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
      <Card className="mb-8 shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
          <CardTitle className="text-lg">Ad Framework</CardTitle>
          <CardDescription>The strategic elements selected for this ad</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 pt-6">
          <div className="p-5 rounded-lg border-2 border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-slate-50/30 dark:bg-slate-900/30">
            <h3 className="font-bold mb-3 text-base uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Concept
            </h3>
            <div>
              <p className="font-semibold text-lg mb-1">{ad.concept?.name}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{ad.concept?.description}</p>
            </div>
          </div>
          <div className="p-5 rounded-lg border-2 border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-slate-50/30 dark:bg-slate-900/30">
            <h3 className="font-bold mb-3 text-base uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Angle
            </h3>
            <div>
              <p className="font-semibold text-lg mb-1">{ad.angle?.name}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{ad.angle?.description}</p>
            </div>
          </div>
          <div className="p-5 rounded-lg border-2 border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-slate-50/30 dark:bg-slate-900/30">
            <h3 className="font-bold mb-3 text-base uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Style
            </h3>
            <div>
              <p className="font-semibold text-lg mb-1">{ad.style?.name}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{ad.style?.description}</p>
            </div>
          </div>
          <div className="p-5 rounded-lg border-2 border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-slate-50/30 dark:bg-slate-900/30">
            <h3 className="font-bold mb-3 text-base uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Hook
            </h3>
            <div>
              <p className="font-semibold text-lg mb-1">{ad.hook?.name}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{ad.hook?.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Audience */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
            <CardTitle className="text-lg">Target Desires</CardTitle>
            <CardDescription className="text-base">{ad.desires?.length || 0} selected</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {ad.desires?.map((desire) => (
                <div key={desire._id} className="flex items-start gap-3 p-3 rounded-md bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <Badge
                    variant="secondary"
                    className="shrink-0 shadow-sm border border-slate-300 dark:border-slate-700 font-medium"
                  >
                    {desire.category || "other"}
                  </Badge>
                  <p className="text-sm leading-relaxed">{desire.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
            <CardTitle className="text-lg">Target Beliefs</CardTitle>
            <CardDescription className="text-base">{ad.beliefs?.length || 0} selected</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {ad.beliefs?.map((belief) => (
                <div key={belief._id} className="flex items-start gap-3 p-3 rounded-md bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <Badge
                    variant="secondary"
                    className="shrink-0 shadow-sm border border-slate-300 dark:border-slate-700 font-medium"
                  >
                    {belief.category || "other"}
                  </Badge>
                  <p className="text-sm leading-relaxed">{belief.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card className="shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
          <CardTitle className="text-lg">Documents</CardTitle>
          <CardDescription className="text-base">4 collaborative documents created for this ad</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            {documents?.map((doc, idx) => (
              <div
                key={doc._id}
                className="p-5 border-2 border-slate-200 dark:border-slate-800 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-slate-50/30 dark:bg-slate-900/30"
              >
                <h4 className="font-bold mb-1 capitalize text-base">
                  {doc.documentType.replace("_", " ")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  Version {doc.documentVersion}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link to="/my-ads/$adId/chat" params={{ adId }}>
              <Button variant="outline" className="w-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
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
