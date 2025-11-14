import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { useCustomer } from "autumn-js/react";
import CheckoutDialog from "~/components/autumn/checkout-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const { customer, checkout, cancel, refetch } = useCustomer({ errorOnNotFound: false });

  const currentProduct = customer?.products?.[0];
  const isCancelled = currentProduct?.canceled_at != null;
  const isOnPro = currentProduct?.id === "pro" && !isCancelled;
  const isOnFree = !currentProduct || currentProduct?.id === "free" || isCancelled;

  console.log("Autumn customer data:", customer);
  console.log("Current product:", currentProduct);
  console.log("isCancelled:", isCancelled, "isOnPro:", isOnPro, "isOnFree:", isOnFree);

  const handleUpgradeToPro = async () => {
    await checkout({
      productId: "pro",
      dialog: CheckoutDialog,
    });
  };

  const handleContactSales = () => {
    window.location.href = "mailto:sales@aiwhiteboardchat.com?subject=Enterprise Inquiry";
  };

  const handleDowngradeToFree = async () => {
    try {
      await cancel({ productId: "pro" });
      await refetch();
      setShowDowngradeDialog(false);
    } catch (error) {
      console.error("Failed to downgrade:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            Choose the perfect plan
          </h1>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-0 max-w-5xl mx-auto mb-16">
          {/* Free Tier */}
          <div className="border-r border-border bg-card">
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Free</h3>
                <p className="text-sm text-muted-foreground leading-relaxed min-h-[40px]">
                  Perfect for individuals and small teams getting started.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-light tracking-tight">$0</span>
                </div>
                <div className="text-sm text-muted-foreground">per month</div>
              </div>

              <button
                onClick={isOnPro ? () => setShowDowngradeDialog(true) : undefined}
                disabled={isOnFree}
                className="w-full py-3 px-5 rounded-full text-sm font-medium transition-all mb-10 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOnFree ? "Current Plan" : isOnPro ? "Downgrade to Free" : "Start for free"}
              </button>

              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">3 canvases</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">8,000 AI credits per month</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">Unlimited nodes</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">Any AI model</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pro Tier - Featured */}
          <div className="relative border-r border-border bg-zinc-700 text-white">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-background text-foreground text-xs font-medium rounded-full border border-border">
              Most Popular
            </div>

            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <p className="text-sm text-white/70 leading-relaxed min-h-[40px]">
                  Advanced features for growing teams and businesses.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-light tracking-tight">$30</span>
                  <span className="text-lg text-white/70"> /month</span>
                </div>
                <div className="text-sm text-white/70">per month</div>
              </div>

              <button
                onClick={handleUpgradeToPro}
                disabled={isOnPro}
                className="w-full py-3 px-5 rounded-full text-sm font-medium transition-all mb-10 bg-white text-zinc-700 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOnPro ? "Current Plan" : "Get started"}
              </button>

              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-orange-400 flex-shrink-0" strokeWidth={2.5} />
                  <span className="text-sm">Unlimited canvases</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-orange-400 flex-shrink-0" strokeWidth={2.5} />
                  <span className="text-sm">60,000 AI credits per month</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-orange-400 flex-shrink-0" strokeWidth={2.5} />
                  <span className="text-sm">Custom agents</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-orange-400 flex-shrink-0" strokeWidth={2.5} />
                  <span className="text-sm">Everything in Free tier</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Enterprise Tier */}
          <div className="bg-card">
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                <p className="text-sm text-muted-foreground leading-relaxed min-h-[40px]">
                  Complete solution for large organizations and enterprises.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-serif tracking-tight">Custom pricing</span>
                </div>
                <div className="text-sm text-muted-foreground">Tailored to your needs</div>
              </div>

              <button
                onClick={handleContactSales}
                className="w-full py-3 px-5 rounded-full text-sm font-medium transition-all mb-10 bg-foreground text-background hover:bg-foreground/90"
              >
                Contact sales
              </button>

              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">Everything in Pro</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">White labeling</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">Dedicated support</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">Done-for-you onboarding</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">Advanced security features</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto text-center mt-24">
          <h3 className="text-3xl font-bold mb-4">Questions?</h3>
          <p className="text-muted-foreground mb-8 text-base">
            Need help choosing a plan? We're here to help.
          </p>
          <button
            onClick={() => window.location.href = "mailto:support@aiwhiteboardchat.com"}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-muted hover:bg-muted/80 transition-colors font-medium text-base"
          >
            Get in touch
          </button>
        </div>
      </div>

      {/* Downgrade Confirmation Dialog */}
      <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Downgrade to Free Plan?</DialogTitle>
            <DialogDescription>
              Your Pro subscription will be cancelled and you'll be downgraded to the Free plan at the end of your current billing cycle. You'll continue to have access to all Pro features until then.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDowngradeDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDowngradeToFree}
            >
              Confirm Downgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
