import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/table/data-table";
import { createSubscriptionColumns } from "@/components/subscriptions/subscription-columns";
import { useState } from "react";
import { Trash2, Plus, LayoutGrid, Table } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/subscriptions")({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { data: subscriptions } = useSuspenseQuery(
    convexQuery(api.subscriptions.getByUser, {})
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [company, setCompany] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [frequency, setFrequency] = useState("daily");
  const [viewMode, setViewMode] = useState<"table" | "card">(
    (localStorage.getItem("subscriptionViewMode") as "table" | "card") || "table"
  );

  const createSubscription = useMutation(api.subscriptions.create);
  const removeSubscription = useMutation(api.subscriptions.remove);
  const createExamples = useMutation(api.subscriptions.createExamples);

  const handleCreate = async () => {
    if (!searchTerm && !company) {
      toast.error("Please provide either a search term or company name");
      return;
    }

    try {
      await createSubscription({
        searchTerm: searchTerm || undefined,
        company: company || undefined,
        platform,
        frequency,
      });
      toast.success("Subscription created!");
      setIsDialogOpen(false);
      setSearchTerm("");
      setCompany("");
      setPlatform("facebook");
      setFrequency("daily");
    } catch (error) {
      toast.error("Failed to create subscription");
    }
  };

  const handleDelete = async (id: any) => {
    try {
      await removeSubscription({ id });
      toast.success("Subscription deleted");
    } catch (error) {
      toast.error("Failed to delete subscription");
    }
  };

  const handleCreateExamples = async () => {
    try {
      await createExamples({});
      toast.success("Example subscriptions created!");
    } catch (error) {
      toast.error("Failed to create examples");
    }
  };

  const handleViewModeChange = (mode: "table" | "card") => {
    setViewMode(mode);
    localStorage.setItem("subscriptionViewMode", mode);
  };

  const subscriptionColumns = createSubscriptionColumns(handleDelete);

  return (
    <ProtectedRoute>
      <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Ad Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage what ads you want to track
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreateExamples} variant="outline">
            Add Example Data
          </Button>
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Subscription
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Subscription</DialogTitle>
                <DialogDescription>
                  Track ads by search term or company name
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="searchTerm">Search Term</Label>
                  <Input
                    id="searchTerm"
                    placeholder="e.g., AI tools, SaaS software"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  OR
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    placeholder="e.g., Shopify, HubSpot"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Scrape Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No subscriptions yet. Create your first one to start tracking
                ads!
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        <DataTable
          columns={subscriptionColumns}
          data={subscriptions}
          searchKey="name"
          searchPlaceholder="Search subscriptions..."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub: any) => (
            <Card key={sub._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {sub.searchTerm || sub.company}
                    </CardTitle>
                    <CardDescription>
                      {sub.searchTerm ? "Search Term" : "Company"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(sub._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{sub.platform}</Badge>
                  <Badge variant="outline">{sub.frequency}</Badge>
                  <Badge variant={sub.isActive ? "default" : "destructive"}>
                    {sub.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}
