// src/routes/_authed.admin.seed.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authed/admin/seed")({
  component: AdminSeed,
});

function AdminSeed() {
  const [loading, setLoading] = useState<string | null>(null);

  const seedConcepts = useMutation(api.adCreation.mutations.seedAdConcepts);
  const seedAngles = useMutation(api.adCreation.mutations.seedAdAngles);
  const seedStyles = useMutation(api.adCreation.mutations.seedAdStyles);
  const seedHooks = useMutation(api.adCreation.mutations.seedAdHooks);
  const seedTemplates = useMutation(api.adCreation.mutations.seedDocumentTemplates);

  const handleSeed = async (
    name: string,
    fn: () => Promise<{ count: number }>
  ) => {
    setLoading(name);
    try {
      const result = await fn();
      toast.success(`✅ Seeded ${result.count} ${name}`);
    } catch (error) {
      console.error(`Error seeding ${name}:`, error);
      toast.error(
        error instanceof Error ? error.message : `Failed to seed ${name}`
      );
    } finally {
      setLoading(null);
    }
  };

  const handleSeedAll = async () => {
    setLoading("all");
    try {
      const results = await Promise.all([
        seedConcepts({}),
        seedAngles({}),
        seedStyles({}),
        seedHooks({}),
        seedTemplates({}),
      ]);

      const total = results.reduce((sum, r) => sum + r.count, 0);
      toast.success(`✅ Seeded all data (${total} total items)`);
    } catch (error) {
      console.error("Error seeding all:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to seed all data"
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin: Seed Data</h1>
        <p className="text-muted-foreground">
          Populate the database with default ad creation options and templates.
          This operation is idempotent (safe to run multiple times).
        </p>
      </div>

      <div className="grid gap-6">
        {/* Seed All */}
        <Card>
          <CardHeader>
            <CardTitle>Seed All Data</CardTitle>
            <CardDescription>
              Populate all concepts, angles, styles, hooks, and templates at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSeedAll}
              disabled={loading !== null}
              size="lg"
              className="w-full"
            >
              {loading === "all" ? "Seeding..." : "Seed All"}
            </Button>
          </CardContent>
        </Card>

        {/* Individual Seeds */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Ad Concepts</CardTitle>
              <CardDescription>
                10 core ad concepts (Social Proof, Transformation, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleSeed("concepts", () => seedConcepts({}))}
                disabled={loading !== null}
                variant="outline"
                className="w-full"
              >
                {loading === "concepts" ? "Seeding..." : "Seed Concepts"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ad Angles</CardTitle>
              <CardDescription>
                10 ad angles (Direct Benefit, Pain Point, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleSeed("angles", () => seedAngles({}))}
                disabled={loading !== null}
                variant="outline"
                className="w-full"
              >
                {loading === "angles" ? "Seeding..." : "Seed Angles"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ad Styles</CardTitle>
              <CardDescription>
                10 writing styles (Bold & Direct, Conversational, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleSeed("styles", () => seedStyles({}))}
                disabled={loading !== null}
                variant="outline"
                className="w-full"
              >
                {loading === "styles" ? "Seeding..." : "Seed Styles"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ad Hooks</CardTitle>
              <CardDescription>
                10 hook types (Shocking Stat, Bold Promise, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleSeed("hooks", () => seedHooks({}))}
                disabled={loading !== null}
                variant="outline"
                className="w-full"
              >
                {loading === "hooks" ? "Seeding..." : "Seed Hooks"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document Templates</CardTitle>
            <CardDescription>
              4 markdown templates (Details, Copy, Asset Brief, Notes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleSeed("templates", () => seedTemplates({}))}
              disabled={loading !== null}
              variant="outline"
              className="w-full"
            >
              {loading === "templates" ? "Seeding..." : "Seed Templates"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
