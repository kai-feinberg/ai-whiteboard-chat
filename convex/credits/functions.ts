// convex/credits/functions.ts
import { v } from "convex/values";
import { action, query } from "../_generated/server";
import { autumn } from "../autumn";

/**
 * Validate top-up credit purchase (Pro tier check)
 */
export const validateTopUpPurchase = action({
  args: {
    amount: v.number(), // USD amount
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Check Pro tier (using custom_agents as proxy for Pro tier)
    const { data, error } = await autumn.check(ctx, {
      featureId: "custom_agents",
    });

    if (error || !data?.allowed) {
      return {
        allowed: false,
        error: "Top-up credits are only available for Pro users. Please upgrade to Pro first.",
      };
    }

    // Validate amount
    if (args.amount < 5) {
      return {
        allowed: false,
        error: "Minimum purchase amount is $5.",
      };
    }

    if (args.amount > 500) {
      return {
        allowed: false,
        error: "Maximum purchase amount is $500. Please contact support for larger purchases.",
      };
    }

    // Calculate credits (3200 credits per $1)
    const credits = args.amount * 3200;

    return {
      allowed: true,
      credits,
      amount: args.amount,
    };
  },
});

/**
 * Get current credit balances (monthly + top-up)
 */
export const getCreditBalances = query({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Note: This is a query, so we can't call autumn.usage() here (it's an action-only API)
    // Frontend should use useCustomer() hook from autumn-js/react instead
    // This query is just for reference or if we store balances in our DB

    return {
      message: "Use useCustomer() hook from autumn-js/react to get real-time balances",
    };
  },
});

/**
 * DEV ONLY: Adjust credits for testing purposes
 * Adds or deducts credits from ai_credits or topup_credits
 */
export const adjustCreditsForDev = action({
  args: {
    amount: v.number(), // Positive to add, negative to deduct
    featureId: v.union(v.literal("ai_credits"), v.literal("topup_credits")),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Track the adjustment (negative values deduct, positive values add)
    await autumn.track(ctx, {
      featureId: args.featureId,
      value: -args.amount, // Negate because autumn.track deducts positive values
    });

    // Get updated balances
    const monthlyCheck = await autumn.check(ctx, { featureId: "ai_credits" });
    const topUpCheck = await autumn.check(ctx, { featureId: "topup_credits" });

    return {
      success: true,
      monthlyBalance: monthlyCheck?.data?.balance || 0,
      topUpBalance: topUpCheck?.data?.balance || 0,
    };
  },
});
