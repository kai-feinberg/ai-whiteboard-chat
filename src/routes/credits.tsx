import { createFileRoute } from "@tanstack/react-router";
import { CreditPurchaseSection } from "~/features/credits/components/CreditPurchaseSection";

export const Route = createFileRoute("/credits")({
  component: CreditsPage,
});

function CreditsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-8">
        <CreditPurchaseSection />
      </div>
    </div>
  );
}
