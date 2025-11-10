import { useCustomer } from "autumn-js/react";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export function CreditBalance() {
  const navigate = useNavigate();
  const { customer } = useCustomer();

  // Access credits feature (features is OBJECT!)
  const creditsFeature = customer?.features?.ai_credits;
  const balance = creditsFeature?.balance || 0;
  const included = creditsFeature?.included_usage || 0;
  const percentRemaining = included > 0 ? (balance / included) * 100 : 0;
  const isLow = percentRemaining < 20;

  // Get current product
  const currentProduct = customer?.products?.[0];
  const isPro = currentProduct?.name === "Pro";

  return (
    <div className="p-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Credits</span>
        </div>
        {isPro && (
          <div className="flex items-center gap-1 text-xs text-yellow-600">
            <Sparkles className="h-3 w-3" />
            <span>Pro</span>
          </div>
        )}
      </div>

      <div className="space-y-1 mb-2">
        <div className="text-xs text-muted-foreground">
          {balance.toLocaleString()} credits
        </div>
        <div className="text-xs text-muted-foreground opacity-70">
          of {included.toLocaleString()} total
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all ${isLow ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${Math.max(0, Math.min(100, percentRemaining))}%` }}
        />
      </div>

      {isLow && (
        <div className="text-xs text-destructive mb-2">
          Low credits! Upgrade for more.
        </div>
      )}

      {!isPro && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate({ to: "/pricing" })}
        >
          <Sparkles className="h-3 w-3 mr-2" />
          Upgrade to Pro
        </Button>
      )}
    </div>
  );
}
