import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/table/data-table";
import { adColumns } from "@/components/ads/ad-columns";
import { AdCardView } from "@/components/ads/ad-card-view";
import { LayoutGrid, Table, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { data: ads } = useSuspenseQuery(
    convexQuery(api.ads.getByUser, {})
  );
  const { data: subscriptions } = useSuspenseQuery(
    convexQuery(api.subscriptions.getByUser, {})
  );

  const [viewMode, setViewMode] = useState<"table" | "card">(
    (localStorage.getItem("adViewMode") as "table" | "card") || "table"
  );
  const [selectedSubscription, setSelectedSubscription] = useState<string>("all");

  const createExampleAds = useMutation(api.ads.createExamples);

  const handleViewModeChange = (mode: "table" | "card") => {
    setViewMode(mode);
    localStorage.setItem("adViewMode", mode);
  };

  const handleCreateExampleAds = async () => {
    if (subscriptions.length === 0) {
      toast.error("Please create a subscription first");
      return;
    }

    try {
      await createExampleAds({ subscriptionId: subscriptions[0]._id });
      toast.success("Example ads created!");
    } catch (error) {
      toast.error("Failed to create example ads");
    }
  };

  const filteredAds = selectedSubscription === "all"
    ? ads
    : ads.filter((ad: any) => ad.subscriptionId === selectedSubscription);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Ad Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {ads.length} ads tracked across {subscriptions.length} subscriptions
          </p>
        </div>
        <div className="flex gap-2">
          {subscriptions.length > 0 && (
            <Button onClick={handleCreateExampleAds} variant="outline">
              Add Example Ads
            </Button>
          )}
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("table")}
            >
              <Table className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("card")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {subscriptions.length > 0 && (
        <div className="mb-4">
          <Select value={selectedSubscription} onValueChange={setSelectedSubscription}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subscriptions</SelectItem>
              {subscriptions.map((sub: any) => (
                <SelectItem key={sub._id} value={sub._id}>
                  {sub.searchTerm || sub.company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {ads.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {subscriptions.length === 0
                  ? "No subscriptions yet. Create your first subscription to start tracking ads!"
                  : "No ads found. Ads will appear here once scraping starts (Phase 2)."}
              </p>
              <Link to="/subscriptions">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {subscriptions.length === 0
                    ? "Create Subscription"
                    : "View Subscriptions"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        <DataTable
          columns={adColumns}
          data={filteredAds}
          searchKey="title"
          searchPlaceholder="Search ads by title..."
        />
      ) : (
        <AdCardView ads={filteredAds} />
      )}
    </div>
  );
}
