import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { useMutation, useAction } from "convex/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/table/data-table";
import { adColumns } from "@/features/ad-feed/components/ad-columns";
import { AdCardView } from "@/features/ad-feed/components/ad-card-view";
import { LayoutGrid, Table, Plus, Download } from "lucide-react";
import { useState, useEffect } from "react";
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
    convexQuery(api.ads.functions.getByUser, {})
  );
  const { data: subscriptions } = useSuspenseQuery(
    convexQuery(api.subscriptions.functions.getByUser, {})
  );

  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [selectedSubscription, setSelectedSubscription] = useState<string>("all");
  const [isScraping, setIsScraping] = useState(false);

  // Initialize viewMode from localStorage after mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem("adViewMode") as "table" | "card";
    if (stored) {
      setViewMode(stored);
    }
  }, []);

  const createExampleAds = useMutation(api.ads.functions.createExamples);
  const scrapeFacebookAds = useAction(api.ads.functions.scrapeFromFacebookAdLibrary);

  const handleViewModeChange = (mode: "table" | "card") => {
    setViewMode(mode);
    localStorage.setItem("adViewMode", mode);
  };

  const handleCreateExampleAds = async () => {
    try {
      // Pass the first subscription if available, otherwise let the backend create subscriptions
      await createExampleAds({
        subscriptionId: subscriptions.length > 0 ? subscriptions[0]._id : undefined
      });
      toast.success("Example ads and subscriptions created!");
    } catch (error) {
      toast.error("Failed to create example ads");
    }
  };

  const handleScrapeFacebookAds = async () => {
    if (subscriptions.length === 0) {
      toast.error("Please create a subscription first");
      return;
    }

    setIsScraping(true);
    try {
      const result = await scrapeFacebookAds({ subscriptionId: subscriptions[0]._id });
      if (result.success) {
        toast.success(result.message || `Scraped ${result.count} ads from Facebook`);
      } else {
        toast.error(result.error || "Failed to scrape ads");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to scrape Facebook ads");
    } finally {
      setIsScraping(false);
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
          <Button onClick={handleCreateExampleAds} variant="outline">
            Add Example Ads
          </Button>
          {subscriptions.length > 0 && (
            <Button
              onClick={handleScrapeFacebookAds}
              variant="default"
              disabled={isScraping}
            >
              {isScraping ? (
                <>Scraping...</>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Scrape Facebook Ads
                </>
              )}
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
