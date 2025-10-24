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
import { Loader2, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
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
    data: { profile, documents },
  } = useSuspenseQuery(convexQuery(api.profile.functions.getOnboardingData, {}));

  const initials = viewer
    ? viewer
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
              {documents.map((doc) => (
                <DocumentCard key={doc._id} document={doc} />
              ))}
              <div className="pt-4 border-t">
                <Link to="/onboarding">
                  <Button variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Edit Onboarding Profile
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
