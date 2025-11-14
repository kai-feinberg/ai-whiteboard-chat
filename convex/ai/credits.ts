// Custom credit deduction logic with priority:
// 1. Deduct from monthly credits first (ai_credits)
// 2. If monthly exhausted, deduct from top-up credits (topup_credits)

import { autumn } from "../autumn";

/**
 * Deduct credits with priority: monthly first, then top-up
 * NOTE: We use 'any' type for ctx to support both ActionCtx and usageHandler context
 * @param ctx - Action context (any type to work with usageHandler)
 * @param amount - Credits to deduct
 */
export async function deductCreditsWithPriority(
  ctx: any,
  amount: number
): Promise<void> {
  // Simplified approach: Try to deduct from monthly first
  // If that fails (insufficient balance), deduct from top-up
  // Autumn will handle the balance validation for us

  try {
    // Try monthly credits first
    const monthlyCheck = await autumn.check(ctx, {
      featureId: "ai_credits",
    });

    const monthlyBalance = monthlyCheck?.data?.balance || 0;

    if (monthlyBalance >= amount) {
      // Deduct all from monthly
      await autumn.track(ctx, {
        featureId: "ai_credits",
        value: amount,
      });
      console.log("[Credit Deduction] Deducted from monthly:", amount);
    } else if (monthlyBalance > 0) {
      // Partial from monthly, rest from top-up
      await autumn.track(ctx, {
        featureId: "ai_credits",
        value: monthlyBalance,
      });

      const remainder = amount - monthlyBalance;
      await autumn.track(ctx, {
        featureId: "topup_credits",
        value: remainder,
      });
      console.log("[Credit Deduction] Split:", {
        monthly: monthlyBalance,
        topUp: remainder,
      });
    } else {
      // All from top-up
      await autumn.track(ctx, {
        featureId: "topup_credits",
        value: amount,
      });
      console.log("[Credit Deduction] Deducted from top-up:", amount);
    }
  } catch (error) {
    console.error("[Credit Deduction Error]", { amount, error });
    throw error;
  }
}

/**
 * Check if user has enough combined credits (monthly + top-up)
 * @param ctx - Action context
 * @param requiredAmount - Credits required
 * @returns Whether user has enough credits and balance details
 */
export async function checkCombinedBalance(
  ctx: any,
  requiredAmount: number
): Promise<{
  hasEnough: boolean;
  monthlyBalance: number;
  topUpBalance: number;
  totalBalance: number;
  shortfall: number;
}> {
  try {
    const monthlyCheck = await autumn.check(ctx, { featureId: "ai_credits" });
    const topUpCheck = await autumn.check(ctx, { featureId: "topup_credits" });

    const monthlyBalance = monthlyCheck?.data?.balance || 0;
    const topUpBalance = topUpCheck?.data?.balance || 0;
    const totalBalance = monthlyBalance + topUpBalance;

    return {
      hasEnough: totalBalance >= requiredAmount,
      monthlyBalance,
      topUpBalance,
      totalBalance,
      shortfall: Math.max(0, requiredAmount - totalBalance),
    };
  } catch (error) {
    console.error("[Balance Check Error]", error);
    // Return safe defaults on error
    return {
      hasEnough: false,
      monthlyBalance: 0,
      topUpBalance: 0,
      totalBalance: 0,
      shortfall: requiredAmount,
    };
  }
}
