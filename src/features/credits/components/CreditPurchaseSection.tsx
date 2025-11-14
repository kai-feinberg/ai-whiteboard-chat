import { useState, useEffect } from "react";
import { useCustomer } from "autumn-js/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Zap } from "lucide-react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import CheckoutDialog from "~/components/autumn/checkout-dialog";
import { useNavigate } from "@tanstack/react-router";

export function CreditPurchaseSection() {
  const { customer, checkout, refetch } = useCustomer({ errorOnNotFound: false });
  const validatePurchase = useAction(api.credits.functions.validateTopUpPurchase);
  const navigate = useNavigate();

  // Log customer data when fetched
  useEffect(() => {
    console.log("Autumn customer data:", customer);
  }, [customer]);

  const [customAmount, setCustomAmount] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get current product
  const currentProduct = customer?.products?.[0];
  const isPro = currentProduct?.name === "Pro";

  // Preset amounts
  const presets = [
    { amount: 10, credits: 32000 },
    { amount: 50, credits: 160000 },
    { amount: 100, credits: 320000 },
  ];

  // Calculate credits for custom amount
  const customAmountNum = parseFloat(customAmount) || 0;
  const customCredits = customAmountNum * 3200;

  // Get active amount (preset or custom)
  const activeAmount = selectedPreset || customAmountNum;
  const activeCredits = selectedPreset ? presets.find(p => p.amount === selectedPreset)?.credits || 0 : customCredits;

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedPreset(null);
  };

  const handlePurchase = async () => {
    if (!activeAmount || activeAmount < 5) {
      toast.error("Minimum purchase amount is $5");
      return;
    }

    setIsLoading(true);

    try {
      // Validate on backend (checks Pro tier)
      const validation = await validatePurchase({ amount: activeAmount });

      if (!validation.allowed || !validation.credits || !validation.amount) {
        toast.error(validation.error || "Purchase not allowed");
        setIsLoading(false);
        return;
      }

      // Trigger Autumn checkout with dialog
      const result = await checkout({
        productId: "topup_credits",
        options: [
          {
            featureId: "topup_credits",
            quantity: validation.credits,
          },
        ],
        dialog: CheckoutDialog,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to purchase credits");
        return;
      }

      // Refetch customer data to update credits
      await refetch();

      toast.success(`Successfully purchased ${validation.credits.toLocaleString()} credits for $${validation.amount}`);
    } catch (error) {
      console.error("Purchase error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to purchase credits");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPro) {
    return (
      <div id="credits" className="max-w-2xl mx-auto text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Purchase Additional Credits</h3>
        <p className="text-muted-foreground mb-6">
          Top-up credits are available exclusively for Pro users.
        </p>
        <Button size="lg" onClick={() => navigate({ to: "/pricing" })}>
          <Sparkles className="h-4 w-4 mr-2" />
          Upgrade to Pro
        </Button>
      </div>
    );
  }

  return (
    <div id="credits" className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Purchase Additional Credits</h3>
        <p className="text-muted-foreground">
          Top-up credits never expire and are available for all Pro users
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6">
        {/* Preset Buttons */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-3 block">Select Amount</label>
          <div className="grid grid-cols-3 gap-3">
            {presets.map((preset) => (
              <button
                key={preset.amount}
                onClick={() => handlePresetClick(preset.amount)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedPreset === preset.amount
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-xl font-bold">${preset.amount}</div>
                <div className="text-xs text-muted-foreground">
                  {preset.credits.toLocaleString()} credits
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">Or Enter Custom Amount</label>
          <div className="flex gap-2 items-center">
            <span className="text-2xl font-semibold">$</span>
            <Input
              type="number"
              min="5"
              max="500"
              step="1"
              placeholder="Amount (min $5, max $500)"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              className="text-lg"
            />
          </div>
          {customAmountNum > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              = {customCredits.toLocaleString()} credits
            </p>
          )}
        </div>

        {/* Summary */}
        {activeAmount > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Credits</span>
              <span className="text-sm font-semibold">{activeCredits.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Rate</span>
              <span className="text-sm">3,200 credits per $1</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">${activeAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Purchase Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handlePurchase}
          disabled={!activeAmount || activeAmount < 5 || activeAmount > 500 || isLoading}
        >
          {isLoading ? "Processing..." : `Purchase ${activeCredits.toLocaleString()} Credits`}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Credits never expire and are shared across your organization
        </p>
      </div>
    </div>
  );
}
