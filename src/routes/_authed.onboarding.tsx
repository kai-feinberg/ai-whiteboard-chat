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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, CheckCircle2, XCircle, Clock, File, AlertTriangle, Lightbulb, Target, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/onboarding")({
  component: OnboardingPage,
});

type OnboardingFormData = {
  websiteUrl?: string;
  vslTranscript: string;
  productDescription: string;
  marketDescription: string;
  targetBuyerDescription: string;
  additionalIdeas?: string;
};

function OnboardingPage() {
  const navigate = useNavigate();
  const profile = useQuery(api.onboarding.queries.getOnboardingProfile);
  const documents = useQuery(
    api.onboarding.queries.getGeneratedDocuments,
    profile ? { profileId: profile._id } : "skip"
  );

  const submitForm = useMutation(api.onboarding.functions.submitOnboardingForm);
  const triggerAnalysis = useMutation(api.onboarding.functions.triggerAnalysis);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<OnboardingFormData>({
    defaultValues: profile
      ? {
          websiteUrl: profile.websiteUrl || "",
          vslTranscript: profile.vslTranscript,
          productDescription: profile.productDescription,
          marketDescription: profile.marketDescription,
          targetBuyerDescription: profile.targetBuyerDescription,
          additionalIdeas: profile.additionalIdeas || "",
        }
      : undefined,
  });

  const fillExampleData = () => {
    setValue("websiteUrl", "https://usemotion.com");
    setValue(
      "vslTranscript",
      "Are you drowning in a sea of tasks, switching between 12 different apps just to figure out what to work on next? You're not alone. The average knowledge worker wastes 2 hours every day just organizing their work. That's 500 hours a year – over 12 work weeks – lost to chaos.\n\nMotion changes everything. It's an AI-powered project manager that automatically plans your perfect day. Just tell Motion what needs to get done, and it instantly creates an optimized schedule across your calendar, tasks, and projects.\n\nNo more manual planning. No more context switching. No more wondering if you're working on the right thing. Motion does the thinking for you, so you can focus on doing.\n\nJoin 50,000+ professionals who've reclaimed their time with Motion."
    );
    setValue(
      "productDescription",
      "Motion is an AI-powered productivity platform that combines your calendar, tasks, and project management into one intelligent system. It automatically schedules your to-dos around your meetings, dynamically adjusts when plans change, and ensures you're always working on the highest-priority items. Instead of spending hours manually planning your week, Motion's AI creates an optimized schedule in seconds, accounting for deadlines, dependencies, and your work patterns."
    );
    setValue(
      "marketDescription",
      "Productivity software market serving knowledge workers, entrepreneurs, and small-to-medium teams. Competitive landscape includes Todoist, Asana, ClickUp, and Notion for task/project management, plus Calendly and Reclaim.ai for calendar optimization. Market trend shows growing frustration with app fatigue – users juggle 5-10 tools daily. Rising demand for AI-powered automation to reduce manual planning overhead. Primary challenge: most tools are passive organizers, not active planners."
    );
    setValue(
      "targetBuyerDescription",
      "Busy professionals and entrepreneurs managing 20+ tasks daily across multiple projects. Often founders, executives, consultants, or senior ICs juggling client work, internal projects, and meetings. Core pain: spending 1-2 hours daily on task triage and schedule Tetris instead of deep work. Frustrated by rigid tools that become outdated the moment plans change. Motivated by desire to feel in control, reduce decision fatigue, and prove they're working on what matters most. Values automation over customization – wants results, not another tool to maintain."
    );
    setValue(
      "additionalIdeas",
      "Focus on time savings ROI. Emphasize the cost of NOT using Motion (500 wasted hours/year). Target high-agency professionals who value their time at $100+/hour."
    );
    toast.success("Form filled with example data!");
  };

  const handleTriggerAnalysis = async () => {
    setIsTriggeringAnalysis(true);
    try {
      const result = await triggerAnalysis();
      toast.success(`Analysis started for ${result.triggered} documents!`);
    } catch (error) {
      console.error("Failed to trigger analysis:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start analysis");
    } finally {
      setIsTriggeringAnalysis(false);
    }
  };

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
  const hasCompletedDocs = documents?.some((doc) => doc.status === "completed");
  const anyAnalysisMissing = documents?.some((doc) => doc.status === "completed" && !doc.analysis);
  const hasAnalysisReady = documents?.some((doc) => doc.status === "completed" && doc.analysis?.status === "completed");

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
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{profile ? "Update Your Information" : "Get Started"}</CardTitle>
              <CardDescription>
                Fill out the form below to generate your marketing documents
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillExampleData}
              disabled={isSubmitting || isGenerating}
            >
              Fill Example Data
            </Button>
          </div>
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

            <div className="space-y-2">
              <Label htmlFor="additionalIdeas">Additional Ideas/Notes (Optional)</Label>
              <Textarea
                id="additionalIdeas"
                rows={3}
                placeholder="Any other context, ideas, or insights you'd like to include..."
                {...register("additionalIdeas")}
              />
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
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Generated Documents</CardTitle>
                <CardDescription>
                  {isGenerating
                    ? "Your documents are being generated..."
                    : allCompleted
                    ? "All documents have been processed"
                    : "Document generation status"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {hasAnalysisReady && (
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/advanced-onboarding" })}
                  >
                    View Analysis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {hasCompletedDocs && anyAnalysisMissing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTriggerAnalysis}
                    disabled={isTriggeringAnalysis || isGenerating}
                  >
                    {isTriggeringAnalysis ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      "Analyze Documents"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

function CompletenessIndicator({ completeness }: { completeness: number }) {
  const getColor = (score: number) => {
    if (score >= 85) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getLabel = (score: number) => {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    return "Needs Work";
  };

  return (
    <div className="flex items-center gap-2">
      <Target className={`h-5 w-5 ${getColor(completeness)}`} />
      <div className="text-right">
        <div className={`text-lg font-bold ${getColor(completeness)}`}>{completeness}%</div>
        <div className="text-xs text-muted-foreground">{getLabel(completeness)}</div>
      </div>
    </div>
  );
}

function DocumentCard({ document }: { document: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const documentTitles: Record<string, string> = {
    offer_brief: "Offer Brief",
    copy_blocks: "Copy Blocks",
    ump_ums: "UMP/UMS Analysis",
    beat_map: "Beat Map",
    build_a_buyer: "Build-A-Buyer Persona",
    pain_core_wound: "Pain & Core Wound Analysis",
    competitors: "Competitor Analysis",
  };

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
      label: "Pending",
    },
    generating: {
      icon: Loader2,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      label: "Generating...",
      animate: true,
    },
    completed: {
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      label: "Completed",
    },
    failed: {
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      label: "Failed",
    },
  };

  const status = statusConfig[document.status as keyof typeof statusConfig];
  const StatusIcon = status.icon;
  const isAnimated = "animate" in status && status.animate;
  const title = documentTitles[document.documentType] || document.documentType;

  // Get a short preview of the content (first 120 characters)
  const getPreview = () => {
    if (!document.content) return "No content available yet...";
    const plainText = document.content.replace(/[#*_~`]/g, "").trim();
    return plainText.length > 120 ? plainText.slice(0, 120) + "..." : plainText;
  };

  return (
    <>
      <div
        className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
          document.status === "completed" ? "hover:border-primary" : ""
        } ${status.bgColor}`}
        onClick={() => document.status === "completed" && setIsModalOpen(true)}
      >
        <div className="flex items-start gap-3">
          {/* File icon with status indicator */}
          <div className="relative flex-shrink-0">
            <File className="h-10 w-10 text-muted-foreground" />
            <StatusIcon
              className={`absolute -bottom-1 -right-1 h-4 w-4 ${status.color} ${
                isAnimated ? "animate-spin" : ""
              } bg-background rounded-full`}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm truncate">{title}</h3>
              <span className={`text-xs ${status.color} flex-shrink-0`}>{status.label}</span>
            </div>

            {/* Analysis preview for completed documents */}
            {document.status === "completed" && document.analysis?.status === "completed" && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium text-green-600 dark:text-green-400">
                    {document.analysis.completeness}% Complete
                  </div>
                </div>
                {document.analysis.suggestions.slice(0, 2).map((suggestion: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground line-clamp-1">
                    • {suggestion}
                  </p>
                ))}
              </div>
            )}

            {/* Analyzing state */}
            {document.status === "completed" && document.analysis?.status === "analyzing" && (
              <p className="text-xs text-blue-500 mt-2">Analyzing quality...</p>
            )}

            {/* Preview text for completed documents without analysis yet */}
            {document.status === "completed" && !document.analysis && document.content && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{getPreview()}</p>
            )}

            {/* Error message for failed documents */}
            {document.status === "failed" && document.errorMessage && (
              <p className="text-xs text-destructive mt-2">Error: {document.errorMessage}</p>
            )}

            {/* Generating indicator */}
            {document.status === "generating" && (
              <p className="text-xs text-muted-foreground mt-2">Generating document...</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal for full content with analysis */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{title}</span>
              {document.analysis?.status === "completed" && (
                <CompletenessIndicator completeness={document.analysis.completeness} />
              )}
            </DialogTitle>
          </DialogHeader>

          {document.analysis?.status === "completed" ? (
            <Tabs defaultValue="content" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Document</TabsTrigger>
                <TabsTrigger value="suggestions">
                  Suggestions {document.analysis.suggestions.length > 0 && `(${document.analysis.suggestions.length})`}
                </TabsTrigger>
                <TabsTrigger value="missing">
                  Missing Elements {document.analysis.missingElements.length > 0 && `(${document.analysis.missingElements.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="flex-1 overflow-y-auto mt-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{document.content || "No content available"}</ReactMarkdown>
                </div>
              </TabsContent>

              <TabsContent value="suggestions" className="flex-1 overflow-y-auto mt-4 space-y-3">
                {document.analysis.suggestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No suggestions - document looks great!</p>
                  </div>
                ) : (
                  document.analysis.suggestions.map((suggestion: string, i: number) => (
                    <Card key={i} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm">{suggestion}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="missing" className="flex-1 overflow-y-auto mt-4 space-y-3">
                {document.analysis.missingElements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>All critical elements are present!</p>
                  </div>
                ) : (
                  document.analysis.missingElements.map((element: string, i: number) => (
                    <Card key={i} className="border-l-4 border-l-amber-500">
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{element}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{document.content || "No content available"}</ReactMarkdown>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
