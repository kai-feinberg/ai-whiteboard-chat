import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { SignOutButton } from "@clerk/tanstack-react-start";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle2, XCircle, Clock, File, AlertTriangle, Lightbulb, Target, Heart, Brain, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const {
    data: { viewer, email },
  } = useSuspenseQuery(convexQuery(api.profile.functions.getCurrentUser, {}));

  const {
    data: { profile, documents, targetDesires, targetBeliefs },
  } = useSuspenseQuery(convexQuery(api.profile.functions.getOnboardingData, {}));

  const initials = viewer
    ? viewer
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your AdScout profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{viewer || "Anonymous"}</h3>
              {email && <p className="text-sm text-muted-foreground">{email}</p>}
              <p className="text-muted-foreground">AdScout User</p>
            </div>
          </div>

          <div className="border-t pt-6">
            <SignOutButton>
              <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>
            {profile
              ? "Your organization's profile and generated documents"
              : "Complete onboarding to generate marketing intelligence"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!profile ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No onboarding profile found. Complete onboarding to get started.
              </p>
              <Link to="/onboarding">
                <Button>
                  <FileText className="mr-2 h-4 w-4" />
                  Start Onboarding
                </Button>
              </Link>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Waiting for documents to start generating...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <DocumentCard key={doc._id} document={doc} />
                ))}
              </div>
              <div className="pt-4 border-t flex gap-2">
                <Link to="/onboarding" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Edit Onboarding Profile
                  </Button>
                </Link>
                <Link to="/advanced-onboarding" className="flex-1">
                  <Button className="w-full">
                    View Advanced Analysis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Desires & Beliefs */}
      {targetDesires && targetBeliefs && (targetDesires.length > 0 || targetBeliefs.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Target Desires */}
          {targetDesires.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-500" />
                  <CardTitle>Target Desires</CardTitle>
                </div>
                <CardDescription>
                  Core emotional outcomes your customer wants to achieve
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {targetDesires.map((desire) => (
                    <div key={desire._id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm">{desire.text}</p>
                      </div>
                      {desire.category && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {desire.category}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Target Beliefs */}
          {targetBeliefs.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-500" />
                  <CardTitle>Target Beliefs</CardTitle>
                </div>
                <CardDescription>
                  Core beliefs your customer holds about themselves and the world
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {targetBeliefs.map((belief) => (
                    <div key={belief._id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm">{belief.text}</p>
                      </div>
                      {belief.category && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {belief.category}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Additional settings will be available in Phase 2
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            AI model configuration, search preferences, and more coming soon.
          </p>
        </CardContent>
      </Card>
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
