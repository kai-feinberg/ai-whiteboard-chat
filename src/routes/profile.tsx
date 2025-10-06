import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const {
    data: { viewer, email },
  } = useSuspenseQuery(convexQuery(api.profile.functions.getCurrentUser, {}));

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
            <SignOutButton />
          </div>
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
