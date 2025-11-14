import * as React from "react"
import { useAction } from "convex/react"
import { useCustomer } from "autumn-js/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus } from "lucide-react"

export function DevCreditsAdjuster() {
  const [amount, setAmount] = React.useState<string>("1000")
  const [isLoading, setIsLoading] = React.useState(false)
  const adjustCredits = useAction(api.credits.functions.adjustCreditsForDev)
  const { refetch } = useCustomer()

  // Only render on localhost
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return null
  }

  const handleAdjust = async (featureId: "ai_credits" | "topup_credits", add: boolean) => {
    const numAmount = parseInt(amount, 10)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid positive number")
      return
    }

    setIsLoading(true)
    try {
      const result = await adjustCredits({
        amount: add ? numAmount : -numAmount,
        featureId,
      })
      console.log("Credits adjusted:", result)

      // Trigger refetch of customer data
      refetch()
    } catch (error) {
      console.error("Failed to adjust credits:", error)
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="px-1 pt-3 border-t border-sidebar-border space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/100 font-medium">
        Dev Credits
      </div>

      <Input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="h-7 text-xs"
        disabled={isLoading}
      />

      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <div className="text-[9px] text-muted-foreground/80 text-center">Monthly</div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-6 text-xs"
            onClick={() => handleAdjust("ai_credits", true)}
            disabled={isLoading}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-6 text-xs"
            onClick={() => handleAdjust("ai_credits", false)}
            disabled={isLoading}
          >
            <Minus className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-1">
          <div className="text-[9px] text-muted-foreground/80 text-center">Top-Up</div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-6 text-xs"
            onClick={() => handleAdjust("topup_credits", true)}
            disabled={isLoading}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-6 text-xs"
            onClick={() => handleAdjust("topup_credits", false)}
            disabled={isLoading}
          >
            <Minus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
