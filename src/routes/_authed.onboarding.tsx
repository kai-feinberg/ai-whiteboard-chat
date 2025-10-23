import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authed/onboarding")({
  component: OnboardingPage,
});

type OnboardingFormData = {
  websiteUrl?: string;
  vslTranscript: string;
  productDescription: string;
  marketDescription: string;
  targetBuyerDescription: string;
};

function OnboardingPage() {
  const profile = useQuery(api.onboarding.queries.getOnboardingProfile);
  const documents = useQuery(
    api.onboarding.queries.getGeneratedDocuments,
    profile ? { profileId: profile._id } : "skip"
  );

  const submitForm = useMutation(api.onboarding.functions.submitOnboardingForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    defaultValues: profile
      ? {
          websiteUrl: profile.websiteUrl || "",
          vslTranscript: profile.vslTranscript,
          productDescription: profile.productDescription,
          marketDescription: profile.marketDescription,
          targetBuyerDescription: profile.targetBuyerDescription,
        }
      : undefined,
  });

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      await submitForm(data);
      toast.success("Document generation started! Watch the progress below.");
    } catch (error) {
      console.error("Failed to submit form:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start generation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if workflow is in progress
  const isGenerating = documents?.some((doc) => doc.status === "generating" || doc.status === "pending");
  const allCompleted = documents?.every((doc) => doc.status === "completed" || doc.status === "failed");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Onboarding</h1>
        <p className="text-muted-foreground">
          Tell us about your product and we'll generate marketing intelligence documents for you.
        </p>
      </div>

      {/* Onboarding Form */}
      <Card>
        <CardHeader>
          <CardTitle>{profile ? "Update Your Information" : "Get Started"}</CardTitle>
          <CardDescription>
            Fill out the form below to generate your marketing documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL (Optional)</Label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://yourproduct.com"
                {...register("websiteUrl")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vslTranscript">
                VSL/Sales Letter Transcript <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="vslTranscript"
                rows={6}
                placeholder="Paste your video sales letter or sales page transcript here..."
                {...register("vslTranscript", { required: "VSL transcript is required" })}
                className={errors.vslTranscript ? "border-destructive" : ""}
              />
              {errors.vslTranscript && (
                <p className="text-sm text-destructive">{errors.vslTranscript.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="productDescription">
                Product Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="productDescription"
                rows={4}
                placeholder="Describe your product, what it does, and what problems it solves..."
                {...register("productDescription", { required: "Product description is required" })}
                className={errors.productDescription ? "border-destructive" : ""}
              />
              {errors.productDescription && (
                <p className="text-sm text-destructive">{errors.productDescription.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketDescription">
                Market Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="marketDescription"
                rows={4}
                placeholder="Describe your market, industry, and competitive landscape..."
                {...register("marketDescription", { required: "Market description is required" })}
                className={errors.marketDescription ? "border-destructive" : ""}
              />
              {errors.marketDescription && (
                <p className="text-sm text-destructive">{errors.marketDescription.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetBuyerDescription">
                Target Buyer Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="targetBuyerDescription"
                rows={4}
                placeholder="Describe your ideal customer, their pain points, and motivations..."
                {...register("targetBuyerDescription", {
                  required: "Target buyer description is required",
                })}
                className={errors.targetBuyerDescription ? "border-destructive" : ""}
              />
              {errors.targetBuyerDescription && (
                <p className="text-sm text-destructive">{errors.targetBuyerDescription.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting || isGenerating} className="w-full">
              {isSubmitting || isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSubmitting ? "Starting..." : "Generating..."}
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  {profile ? "Update & Regenerate Documents" : "Generate Documents"}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Document Generation Progress */}
      {documents && documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Documents</CardTitle>
            <CardDescription>
              {isGenerating
                ? "Your documents are being generated..."
                : allCompleted
                ? "All documents have been processed"
                : "Document generation status"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {documents.map((doc) => (
                <DocumentCard key={doc._id} document={doc} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocumentCard({ document }: { document: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const documentTitles: Record<string, string> = {
    offer_brief: "Offer Brief",
    copy_blocks: "Copy Blocks",
    ump_ums: "UMP/UMS Analysis",
    beat_map: "Beat Map",
  };

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-muted-foreground",
      label: "Pending",
    },
    generating: {
      icon: Loader2,
      color: "text-blue-500",
      label: "Generating...",
      animate: true,
    },
    completed: {
      icon: CheckCircle2,
      color: "text-green-500",
      label: "Completed",
    },
    failed: {
      icon: XCircle,
      color: "text-destructive",
      label: "Failed",
    },
  };

  const status = statusConfig[document.status as keyof typeof statusConfig];
  const StatusIcon = status.icon;
  const isAnimated = "animate" in status && status.animate;

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => document.status === "completed" && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon
            className={`h-5 w-5 ${status.color} ${isAnimated ? "animate-spin" : ""}`}
          />
          <div>
            <h3 className="font-semibold">{documentTitles[document.documentType]}</h3>
            <p className="text-sm text-muted-foreground">{status.label}</p>
          </div>
        </div>
        {document.status === "completed" && (
          <Button variant="ghost" size="sm">
            {isExpanded ? "Hide" : "View"}
          </Button>
        )}
      </div>

      {document.status === "failed" && document.errorMessage && (
        <div className="px-4 pb-4">
          <p className="text-sm text-destructive">Error: {document.errorMessage}</p>
        </div>
      )}

      {isExpanded && document.content && (
        <div className="border-t p-4 bg-muted/20">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{document.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
