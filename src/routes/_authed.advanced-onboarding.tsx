import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/onboarding" })}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Document Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Review AI-generated feedback and suggestions
              </p>
            </div>
          </div>
          {selectedDoc?.analysis && (
            <CompletenessIndicator completeness={selectedDoc.analysis.completeness} />
          )}
        </div>
      </div>

      {/* Main Content - Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Feedback */}
        <div className="w-1/3 border-r flex flex-col overflow-hidden">
          {/* Document Selector */}
          <div className="border-b p-4 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">SELECT DOCUMENT</h3>
            <div className="space-y-1">
              {completedDocs.map((doc) => (
                <button
                  key={doc._id}
                  onClick={() => setSelectedDocType(doc.documentType as DocumentType)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedDocType === doc.documentType
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{documentTitles[doc.documentType] || doc.documentType}</span>
                    {doc.analysis?.completeness && (
                      <span className={`text-xs ${selectedDocType === doc.documentType ? "opacity-90" : "text-muted-foreground"}`}>
                        {doc.analysis.completeness}%
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {selectedDoc?.analysis ? (
              <>
                {/* Suggestions Section */}
                <div>
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
                    <div className="space-y-3">
                      {selectedDoc.analysis.suggestions.map((suggestion: string, i: number) => (
                        <Card key={i} className="border-l-4 border-l-blue-500">
                          <CardContent className="pt-3 pb-3">
                            <p className="text-sm">{suggestion}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Missing Elements Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold">Missing Elements ({selectedDoc.analysis.missingElements.length})</h3>
                  </div>
                  {selectedDoc.analysis.missingElements.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">All elements present!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDoc.analysis.missingElements.map((element: string, i: number) => (
                        <Card key={i} className="border-l-4 border-l-amber-500">
                          <CardContent className="pt-3 pb-3">
                            <p className="text-sm font-medium">{element}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No analysis available for this document</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Document Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b p-4">
            <h2 className="text-xl font-semibold">
              {selectedDocType ? documentTitles[selectedDocType] : "Select a document"}
            </h2>
          </div>
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
