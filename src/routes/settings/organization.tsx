// src/routes/settings/organization.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/settings/organization")({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error("Not authenticated");
    }
    if (!context.orgId) {
      throw new Error("No organization selected");
    }
  },
  component: OrganizationSettingsPage,
});

function OrganizationSettingsPage() {
  const [businessContext, setBusinessContext] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load organization settings
  const orgSettings = useQuery(api.organization.functions.getOrganizationSettings);
  const updateSettings = useMutation(api.organization.functions.updateOrganizationSettings);

  // Populate form when settings load
  useEffect(() => {
    if (orgSettings) {
      setBusinessContext(orgSettings.businessContext || "");
    }
  }, [orgSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        businessContext: businessContext.trim() || undefined,
      });
      toast.success("Organization settings saved successfully");
    } catch (error) {
      console.error("[OrganizationSettings] Error saving:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">Organization Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure organization-wide settings for all members
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-6xl mx-auto">
        <div className="space-y-6">
          {/* Business Context Section */}
          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Business Context</h2>
              <p className="text-sm text-muted-foreground">
                Set your organization's business context that will be automatically included in ALL chat conversations.
                This is perfect for brand voice, business information, writing style guidelines, or any context that should always be present.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessContext">Business Context</Label>
              <ScrollArea className="h-[400px] rounded-md border">
                <Textarea
                  id="businessContext"
                  placeholder="Example: Our company is a B2B SaaS platform focused on developer tools. We maintain a technical but friendly tone, emphasize speed and simplicity, and target engineering teams at mid-size companies. Our writing style is direct, avoids marketing jargon, and includes concrete examples..."
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  className="font-mono text-sm min-h-[400px] border-0 focus-visible:ring-0"
                />
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                This context will be prepended to every chat conversation before the agent's system prompt and any connected node context.
              </p>
            </div>

            {/* Example Section */}
            <div className="bg-muted/50 rounded-md p-4 space-y-2">
              <p className="text-sm font-medium">What to include:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Brand voice and tone guidelines</li>
                <li>Business description and target audience</li>
                <li>Writing style preferences</li>
                <li>Key messaging and value propositions</li>
                <li>Common terminology or jargon to use/avoid</li>
                <li>Any other context that should be present in all AI conversations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
