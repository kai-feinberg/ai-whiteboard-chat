import { createFileRoute } from "@tanstack/react-router";
import { PricingTable } from "autumn-js/react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Transparent Pricing
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Start free, upgrade when you need more canvases. Simple and transparent.
        </p>
      </div>

      <PricingTable
        productDetails={[
          {
            id: "free",
            description: "Perfect for trying out AI Whiteboard Chat",
            features: [
              "3 canvases",
              "All node types (YouTube, TikTok, Facebook Ads, etc.)",
              "AI chat with context",
              "Organization collaboration",
            ],
          },
          {
            id: "pro",
            description: "For teams that need unlimited canvases",
            recommendText: "Most Popular",
            features: [
              "Unlimited canvases",
              "All node types (YouTube, TikTok, Facebook Ads, etc.)",
              "AI chat with context",
              "Organization collaboration",
              "Priority support",
            ],
          },
        ]}
      />

      <div className="mt-16 text-center">
        <h3 className="text-2xl font-semibold mb-4">Questions?</h3>
        <p className="text-muted-foreground mb-6">
          Need help choosing a plan? We're here to help.
        </p>
      </div>
    </div>
  );
}
