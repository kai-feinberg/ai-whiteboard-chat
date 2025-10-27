import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Lightbulb, Target, ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/advanced-onboarding")({
  component: AnalysisPage,
});

type DocumentType = "offer_brief" | "copy_blocks" | "ump_ums" | "beat_map" | "build_a_buyer" | "pain_core_wound" | "competitors";

function AnalysisPage() {
  const navigate = useNavigate();
  const profile = useQuery(api.onboarding.queries.getOnboardingProfile);
  const documents = useQuery(
    api.onboarding.queries.getGeneratedDocuments,
    profile ? { profileId: profile._id } : "skip"
  );

  const completedDocs = documents?.filter((doc) => doc.status === "completed" && doc.analysis?.status === "completed") || [];
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(
    completedDocs.length > 0 ? (completedDocs[0].documentType as DocumentType) : null
  );

  const selectedDoc = completedDocs.find((doc) => doc.documentType === selectedDocType);

  const documentTitles: Record<string, string> = {
    offer_brief: "Offer Brief",
    copy_blocks: "Copy Blocks",
    ump_ums: "UMP/UMS Analysis",
    beat_map: "Beat Map",
    build_a_buyer: "Build-A-Buyer Persona",
    pain_core_wound: "Pain & Core Wound",
    competitors: "Competitor Analysis",
  };

  if (!profile || !documents || completedDocs.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Button variant="outline" onClick={() => navigate({ to: "/onboarding" })} className="mb-6">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Onboarding
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>No Analysis Available</CardTitle>
            <CardDescription>
              No completed documents with analysis found. Please complete the onboarding process first.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Single Combined Header */}
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/onboarding" })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Document Analysis</h1>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedDocType || undefined} onValueChange={(value) => setSelectedDocType(value as DocumentType)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select document" />
            </SelectTrigger>
            <SelectContent>
              {completedDocs.map((doc) => (
                <SelectItem key={doc._id} value={doc.documentType}>
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span>{documentTitles[doc.documentType] || doc.documentType}</span>
                    {doc.analysis?.completeness && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {doc.analysis.completeness}%
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDoc?.analysis && (
            <CompletenessIndicator completeness={selectedDoc.analysis.completeness} />
          )}
        </div>
      </div>

      {/* Main Content - Split Screen */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side - Feedback */}
        <div className="w-1/3 border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedDoc?.analysis ? (
              <>
                {/* Missing Elements Section - Above with urgency */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <h3 className="font-semibold">Missing Elements ({selectedDoc.analysis.missingElements.length})</h3>
                    </div>
                    {selectedDoc.analysis.missingElements.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">All elements present!</p>
                      </div>
                    ) : (
                      <ul className="space-y-2 list-disc list-inside">
                        {selectedDoc.analysis.missingElements.map((element: string, i: number) => (
                          <li key={i} className="text-sm font-medium text-foreground leading-relaxed">
                            {element}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                {/* Suggestions Section */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-blue-500" />
                      <h3 className="font-semibold">Suggestions ({selectedDoc.analysis.suggestions.length})</h3>
                    </div>
                    {selectedDoc.analysis.suggestions.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">No suggestions - looks great!</p>
                      </div>
                    ) : (
                      <ul className="space-y-2 list-disc list-inside">
                        {selectedDoc.analysis.suggestions.map((suggestion: string, i: number) => (
                          <li key={i} className="text-sm text-foreground leading-relaxed">
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No analysis available</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Document Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8">
            {selectedDoc ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{selectedDoc.content || "No content available"}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Select a document to view its content</p>
              </div>
            )}
          </div>
        </div>
      </div>
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
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card">
      <Target className={`h-6 w-6 ${getColor(completeness)}`} />
      <div>
        <div className={`text-2xl font-bold ${getColor(completeness)}`}>{completeness}%</div>
        <div className="text-xs text-muted-foreground">{getLabel(completeness)}</div>
      </div>
    </div>
  );
}
