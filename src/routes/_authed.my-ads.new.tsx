// src/routes/_authed.my-ads.new.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { Search, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/my-ads/new")({
  component: NewAdWizard,
});

type Step = 1 | 2 | 3 | 4 | 5 | 6;

function NewAdWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected values
  const [selectedConceptId, setSelectedConceptId] = useState<Id<"adConcepts"> | null>(null);
  const [selectedAngleId, setSelectedAngleId] = useState<Id<"adAngles"> | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<Id<"adStyles"> | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<Id<"adHooks"> | null>(null);
  const [selectedDesireIds, setSelectedDesireIds] = useState<Id<"targetDesires">[]>([]);
  const [selectedBeliefIds, setSelectedBeliefIds] = useState<Id<"targetBeliefs">[]>([]);

  // Fetch onboarding profile for desires/beliefs
  const profile = useQuery(api.onboarding.queries.getOnboardingProfile);
  const desires = useQuery(
    api.onboarding.queries.getTargetDesires,
    profile ? { profileId: profile._id } : "skip"
  );
  const beliefs = useQuery(
    api.onboarding.queries.getTargetBeliefs,
    profile ? { profileId: profile._id } : "skip"
  );

  // Fetch filter options
  const concepts = useQuery(api.adCreation.functions.getAdConcepts);
  const angles = useQuery(api.adCreation.functions.getAdAngles);
  const styles = useQuery(api.adCreation.functions.getAdStyles);
  const hooks = useQuery(api.adCreation.functions.getAdHooks);

  const createAdMutation = useMutation(api.adCreation.functions.createAd);

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep((currentStep + 1) as Step);
      setSearchQuery(""); // Reset search on step change
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
      setSearchQuery(""); // Reset search on step change
    }
  };

  const handleCreateAd = async () => {
    if (
      !selectedConceptId ||
      !selectedAngleId ||
      !selectedStyleId ||
      !selectedHookId ||
      selectedDesireIds.length === 0 ||
      selectedBeliefIds.length === 0
    ) {
      toast.error("Please complete all steps");
      return;
    }

    try {
      const adId = await createAdMutation({
        conceptId: selectedConceptId,
        angleId: selectedAngleId,
        styleId: selectedStyleId,
        hookId: selectedHookId,
        selectedDesireIds,
        selectedBeliefIds,
      });

      toast.success("Ad created! Initializing documents...");
      navigate({ to: `/my-ads/$adId/chat`, params: { adId } });
    } catch (error) {
      console.error("Error creating ad:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create ad");
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedConceptId !== null;
      case 2:
        return selectedAngleId !== null;
      case 3:
        return selectedStyleId !== null;
      case 4:
        return selectedHookId !== null;
      case 5:
        return selectedDesireIds.length > 0;
      case 6:
        return selectedBeliefIds.length > 0;
      default:
        return false;
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Complete Onboarding First</CardTitle>
            <CardDescription>
              You need to complete the onboarding process before creating ads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/onboarding" })}>
              Go to Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Ad</h1>
        <p className="text-muted-foreground">
          Step {currentStep} of 6: {getStepTitle(currentStep)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div
              key={step}
              className={`text-sm ${
                step <= currentStep ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              {getStepTitle(step as Step)}
            </div>
          ))}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* Search bar */}
      {currentStep <= 4 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="mb-8">
        {currentStep === 1 && (
          <CardGrid
            items={concepts || []}
            selectedId={selectedConceptId}
            onSelect={setSelectedConceptId}
            searchQuery={searchQuery}
          />
        )}
        {currentStep === 2 && (
          <CardGrid
            items={angles || []}
            selectedId={selectedAngleId}
            onSelect={setSelectedAngleId}
            searchQuery={searchQuery}
          />
        )}
        {currentStep === 3 && (
          <CardGrid
            items={styles || []}
            selectedId={selectedStyleId}
            onSelect={setSelectedStyleId}
            searchQuery={searchQuery}
          />
        )}
        {currentStep === 4 && (
          <CardGrid
            items={hooks || []}
            selectedId={selectedHookId}
            onSelect={setSelectedHookId}
            searchQuery={searchQuery}
          />
        )}
        {currentStep === 5 && (
          <CheckboxList
            items={desires || []}
            selectedIds={selectedDesireIds}
            onToggle={(id) => {
              setSelectedDesireIds((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              );
            }}
            searchQuery={searchQuery}
          />
        )}
        {currentStep === 6 && (
          <CheckboxList
            items={beliefs || []}
            selectedIds={selectedBeliefIds}
            onToggle={(id) => {
              setSelectedBeliefIds((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              );
            }}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {currentStep < 6 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreateAd} disabled={!canProceed()}>
            Create Ad
          </Button>
        )}
      </div>
    </div>
  );
}

function getStepTitle(step: Step): string {
  switch (step) {
    case 1:
      return "Concept";
    case 2:
      return "Angle";
    case 3:
      return "Style";
    case 4:
      return "Hook";
    case 5:
      return "Desires";
    case 6:
      return "Beliefs";
    default:
      return "";
  }
}

// Card grid for single-select
function CardGrid<T extends { _id: any; name: string; description: string }>({
  items,
  selectedId,
  onSelect,
  searchQuery,
}: {
  items: T[];
  selectedId: any;
  onSelect: (id: any) => void;
  searchQuery: string;
}) {
  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((item) => (
        <Card
          key={item._id}
          className={`cursor-pointer transition-all hover:shadow-lg ${
            selectedId === item._id
              ? "border-primary border-2 bg-primary/5"
              : "border-border"
          }`}
          onClick={() => onSelect(item._id)}
        >
          <CardHeader>
            <CardTitle className="text-lg">{item.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>{item.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Checkbox list for multi-select
function CheckboxList<T extends { _id: any; text: string; category?: string }>({
  items,
  selectedIds,
  onToggle,
  searchQuery,
}: {
  items: T[];
  selectedIds: any[];
  onToggle: (id: any) => void;
  searchQuery: string;
}) {
  const filtered = items.filter((item) =>
    item.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {filtered.map((item) => (
        <div
          key={item._id}
          className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
          onClick={() => onToggle(item._id)}
        >
          <Checkbox
            id={item._id}
            checked={selectedIds.includes(item._id)}
            onCheckedChange={() => onToggle(item._id)}
          />
          <div className="flex-1">
            <Label htmlFor={item._id} className="cursor-pointer font-normal">
              {item.text}
              {item.category && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({item.category})
                </span>
              )}
            </Label>
          </div>
        </div>
      ))}
      <div className="text-sm text-muted-foreground">
        {selectedIds.length} selected
      </div>
    </div>
  );
}
