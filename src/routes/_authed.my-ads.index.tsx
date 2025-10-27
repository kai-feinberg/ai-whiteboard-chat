// src/routes/_authed.my-ads.index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, MessageSquare, Eye } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { AdBreadcrumb } from "@/components/AdBreadcrumb";

export const Route = createFileRoute("/_authed/my-ads/")({
  component: AdsIndex,
});

const PIPELINE_STAGES = [
  { value: "to_do", label: "To Do", color: "var(--stage-to-do)" },
  { value: "in_progress", label: "In Progress", color: "var(--stage-in-progress)" },
  { value: "ready_for_review", label: "Ready for Review", color: "var(--stage-ready-for-review)" },
  { value: "asset_creation", label: "Asset Creation", color: "var(--stage-asset-creation)" },
  { value: "ready_to_publish", label: "Ready to Publish", color: "var(--stage-ready-to-publish)" },
  { value: "published", label: "Published", color: "var(--stage-published)" },
];

function AdsIndex() {
  const ads = useQuery(api.adCreation.functions.getCreatedAds);
  const updateStage = useMutation(api.adCreation.functions.updatePipelineStage);

  const handleStageChange = async (adId: Id<"createdAds">, newStage: string) => {
    try {
      await updateStage({ adId, newStage });
      toast.success("Pipeline stage updated");
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update stage");
    }
  };

  const adsByStage = PIPELINE_STAGES.map(stage => ({
    ...stage,
    ads: (ads || []).filter(ad => ad.pipelineStage === stage.value)
  }));

  return (
    <div className="p-12 space-y-8">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Ads</h1>
          <p className="text-muted-foreground">
            Manage your ad creation pipeline
          </p>
        </div>
        <Link to="/my-ads/new">
          <Button size="lg">
            <Plus className="mr-2 h-4 w-4" />
            New Ad
          </Button>
        </Link>
      </div>

      {/* Loading State */}
      {!ads ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : ads.length === 0 ? (
        <Card className="shadow-xl border-2">
          <CardHeader>
            <CardTitle className="text-2xl">No ads yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6 text-base">
              Create your first ad to get started!
            </p>
            <Link to="/my-ads/new">
              <Button className="shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
                <Plus className="mr-2 h-4 w-4" />
                Create Ad
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* Pipeline Tables */
        <div className="space-y-8">
          {adsByStage.map((stage) => (
            <Card
              key={stage.value}
              className="shadow-lg hover:shadow-xl transition-all duration-300 border-slate-200 dark:border-slate-800"
            >
              <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <CardTitle className="flex items-center justify-between text-xl">
                  <span className="font-semibold">{stage.label}</span>
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {stage.ads.length} {stage.ads.length === 1 ? 'ad' : 'ads'}
                  </span>
                </CardTitle>
              </CardHeader>
              {stage.ads.length > 0 && (
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200 dark:border-slate-800">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Concept</TableHead>
                        <TableHead className="font-semibold">Created</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stage.ads.map((ad) => (
                        <TableRow
                          key={ad._id}
                          className="border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                        >
                          <TableCell className="font-medium text-base">{ad.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {ad.conceptName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(ad.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Select
                                value={ad.pipelineStage}
                                onValueChange={(value) => handleStageChange(ad._id, value)}
                              >
                                <SelectTrigger className="w-[140px] shadow-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PIPELINE_STAGES.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Link to="/my-ads/$adId" params={{ adId: ad._id }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Link to="/my-ads/$adId/chat" params={{ adId: ad._id }}>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
