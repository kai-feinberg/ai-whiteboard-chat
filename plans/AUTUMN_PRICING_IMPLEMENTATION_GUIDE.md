# Autumn Pricing Component - Implementation Guide for AI Whiteboard Chat

## Overview

This guide details how to implement Autumn's Convex component to add:
1. **Token usage metering** - Track AI message token consumption
2. **Canvas limits** - Restrict number of canvases per organization
3. **Credit system** - Org-scoped credits for usage
4. **Pricing tiers** - Different plans with different limits

## Why Autumn for Your App

- **Org-scoped billing** - Perfect for multi-tenant with Clerk organizations
- **Real-time metering** - Track token usage as it happens
- **Convex integration** - Native integration with your existing Convex backend
- **Credit system** - Flexible credits that map to multiple features (different token costs per model)
- **Canvas limits** - Gate features like canvas creation based on plan

---

## Installation & Setup

### 1. Install Packages

```bash
pnpm add autumn-js @useautumn/convex
```

### 2. Configure Convex with Autumn Component

**File: `convex/convex.config.ts`**

```typescript
import { defineApp } from "convex/server";
import autumn from "@useautumn/convex/convex.config";

const app = defineApp();
app.use(autumn);

export default app;
```

### 3. Set Autumn Secret Key

Get your secret key from [useautumn.com](https://useautumn.com) dashboard, then:

```bash
npx convex env set AUTUMN_SECRET_KEY=am_sk_xxxxxxxxxxxxx
```

### 4. Initialize Autumn Client

**File: `convex/autumn.ts`** (create new file)

```typescript
import { components } from "./_generated/api";
import { Autumn } from "@useautumn/convex";

export const autumn = new Autumn(components.autumn, {
  secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
  identify: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      return null;
    }

    // CRITICAL: Use organizationId as customerId for org-scoped billing
    return {
      customerId: organizationId, // Use org ID, not user ID!
      customerData: {
        name: identity.organizationName as string,
        email: identity.email as string,
      },
    };
  },
});

/**
 * Export all Autumn API functions
 * These are used in both backend functions and frontend hooks
 */
export const {
  track,
  cancel,
  query,
  attach,
  check,
  checkout,
  usage,
  setupPayment,
  createCustomer,
  listProducts,
  billingPortal,
  createReferralCode,
  redeemReferralCode,
  createEntity,
  getEntity,
} = autumn.api();
```

### 5. Setup Frontend Provider

**File: `src/routes/__root.tsx`** (or wherever you have your providers)

```typescript
import { AutumnProvider } from "autumn-js/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@clerk/tanstack-react-start";

function AutumnWrapper({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  if (!isLoaded) return <p>Loading...</p>;

  return (
    <AutumnProvider
      convexApi={(api as any).autumn}
      convexUrl={import.meta.env.VITE_CONVEX_URL}
      getBearerToken={async () => {
        try {
          return (await getToken({ template: "convex" })) || "";
        } catch (error) {
          console.error("Failed to get fresh token:", error);
          return null;
        }
      }}
    >
      {children}
    </AutumnProvider>
  );
}

// Wrap in your provider tree:
<ClerkProvider publishableKey={...}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <AutumnWrapper>
      {children}
    </AutumnWrapper>
  </ConvexProviderWithClerk>
</ClerkProvider>
```

---

## Pricing Configuration

### 1. Initialize Autumn CLI

```bash
npx atmn init
```

This prompts for authentication and creates `.env` with API keys.

### 2. Define Features and Products

**File: `autumn.config.ts`** (create in project root)

```typescript
import {
  feature,
  product,
  priceItem,
  featureItem,
  pricedFeatureItem,
} from "autumn-js/compose";

// ==================== FEATURES ====================

// Canvas limit feature (continuous_use = always active, like seats)
export const canvases = feature({
  id: "canvases",
  name: "Canvases",
  type: "continuous_use", // User "uses" a fixed number of canvases
});

// AI Credits for token usage (single_use = consumed and gone)
export const aiCredits = feature({
  id: "ai_credits",
  name: "AI Credits",
  type: "credit_system", // Credit system that maps to multiple metered features
  credit_schema: [
    {
      metered_feature_id: "gpt4_tokens",
      credit_cost: 10, // 10 credits per 1000 GPT-4 tokens
    },
    {
      metered_feature_id: "claude_tokens",
      credit_cost: 8, // 8 credits per 1000 Claude tokens
    },
    {
      metered_feature_id: "qwen_tokens",
      credit_cost: 2, // 2 credits per 1000 Qwen tokens
    },
  ],
});

// Individual token metering features (these feed into credits)

export const claudeTokens = feature({
  id: "claude_tokens",
  name: "Claude Tokens",
  type: "single_use",
});

// ==================== PRODUCTS ====================

// Free tier
export const free = product({
  id: "free",
  name: "Free",
  items: [
    // 3 canvases included
    featureItem({
      feature_id: canvases.id,
      included_usage: 3,
    }),
    // 1000 AI credits included
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 1000,
    }),
  ],
});

// Base tier ($20/month)
export const base = product({
  id: "base",
  name: "Base",
  items: [
    // $20/month flat fee
    priceItem({
      price: 20,
      interval: "month",
    }),
    // 3 canvases included
    featureItem({
      feature_id: canvases.id,
      included_usage: 3,
    }),
    // 5000 AI credits included
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 5000,
      interval: "month", // Resets monthly
    }),
    // $0.01 per 100 additional credits
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 0.01,
      billing_units: 100, // Price is per 100 credits
    }),
  ],
});

// Pro tier ($50/month)
export const pro = product({
  id: "pro",
  name: "Pro",
  items: [
    // $50/month flat fee
    priceItem({
      price: 50,
      interval: "month",
    }),
    // Unlimited canvases
    featureItem({
      feature_id: canvases.id,
      included_usage: 999999, // Effectively unlimited
    }),
    // 20000 AI credits included
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 20000,
      interval: "month",
    }),
    // $0.008 per 100 additional credits (20% discount)
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 0.008,
      billing_units: 100,
    }),
  ],
});

// Credit top-up (one-time purchase)
export const creditTopUp = product({
  id: "credit_topup",
  name: "Credit Top-Up",
  items: [
    // $5 for 1000 credits (one-time, no interval)
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 5,
      billing_units: 1000,
      usage_model: "prepaid", // One-time purchase
    }),
  ],
});

export default {
  features: [canvases, aiCredits, gpt4Tokens, claudeTokens, qwenTokens],
  products: [free, base, pro, creditTopUp],
};
```

### 3. Push Configuration to Autumn

```bash
npx atmn push
```

This syncs your local config to Autumn's platform.

---

## Implementation: Canvas Limits

### Backend: Check Canvas Limit Before Creation

**File: `convex/canvases/functions.ts`**

```typescript
import { mutation } from "../_generated/server";
import { autumn } from "../autumn";

export const createCanvas = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected");
    }

    // ========== CHECK CANVAS LIMIT ==========
    // First, get current canvas count
    const currentCanvases = await ctx.db
      .query("canvases")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const currentCount = currentCanvases.length;

    // Check if organization can create another canvas
    const { data: checkData, error: checkError } = await autumn.check(ctx, {
      featureId: "canvases",
    });

    if (checkError || !checkData?.allowed) {
      throw new Error(
        checkData?.preview?.message ||
        "Canvas limit reached. Please upgrade your plan."
      );
    }

    // ========== CREATE CANVAS ==========
    const canvasId = await ctx.db.insert("canvases", {
      organizationId,
      title: args.title,
      description: args.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: userId,
    });

    // ========== TRACK USAGE ==========
    // Set canvas count (overwrites previous value)
    await autumn.usage(ctx, {
      featureId: "canvases",
      value: currentCount + 1,
    });

    return canvasId;
  },
});
```

### Backend: Update Count When Canvas Deleted

```typescript
export const deleteCanvas = mutation({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const organizationId = identity.organizationId;
    if (!organizationId) throw new Error("No organization selected");

    // Verify ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== organizationId) {
      throw new Error("Canvas not found or access denied");
    }

    // Delete canvas
    await ctx.db.delete(args.canvasId);

    // Update canvas count
    const remainingCanvases = await ctx.db
      .query("canvases")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    await autumn.usage(ctx, {
      featureId: "canvases",
      value: remainingCanvases.length,
    });
  },
});
```

### Frontend: Display Canvas Limit

```typescript
import { useCustomer } from "autumn-js/react";

export function CanvasDashboard() {
  const { customer, check, checkout } = useCustomer();

  // Get canvas feature usage
  const canvasFeature = customer?.features?.find(
    (f) => f.feature_id === "canvases"
  );

  const usedCanvases = canvasFeature?.usage || 0;
  const limitCanvases = canvasFeature?.limit || 3;

  return (
    <div>
      <p>Canvases: {usedCanvases} / {limitCanvases}</p>

      <button
        onClick={async () => {
          const { data } = await check({
            featureId: "canvases",
          });

          if (!data.allowed) {
            // Show upgrade dialog
            await checkout({
              productId: "pro",
              dialog: CheckoutDialog, // Import from autumn-js/react
            });
          } else {
            // Create canvas
            createCanvas({ title: "New Canvas" });
          }
        }}
      >
        Create Canvas
      </button>
    </div>
  );
}
```

---

## Implementation: Token Usage Metering

### Backend: Track Tokens After AI Message

**File: `convex/ai/functions.ts`** (or wherever you handle AI chat)

```typescript
import { action } from "../_generated/server";
import { autumn } from "../autumn";
import { internal } from "../_generated/api";

export const sendChatMessage = action({
  args: {
    threadId: v.id("threads"),
    message: v.string(),
    modelId: v.string(), // "gpt-4", "claude-sonnet", "qwen"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const organizationId = identity.organizationId;
    if (!organizationId) throw new Error("No organization selected");

    // ========== CHECK CREDITS BEFORE SENDING ==========
    const { data: checkData } = await autumn.check(ctx, {
      featureId: "ai_credits",
    });

    if (!checkData?.allowed) {
      throw new Error(
        "Insufficient AI credits. Please upgrade or purchase credits."
      );
    }

    // ========== SEND MESSAGE TO AI ==========
    // Your existing AI logic here...
    const response = await sendToAI(args.message, args.modelId);

    // Calculate tokens used (prompt + completion)
    const tokensUsed = response.usage.prompt_tokens + response.usage.completion_tokens;

    // ========== TRACK TOKEN USAGE ==========
    // Map model to feature ID
    let featureId = "gpt4_tokens";
    if (args.modelId.includes("claude")) {
      featureId = "claude_tokens";
    } else if (args.modelId.includes("qwen")) {
      featureId = "qwen_tokens";
    }

    // Track tokens (this automatically deducts credits based on credit_schema)
    await autumn.track(ctx, {
      featureId,
      value: Math.ceil(tokensUsed / 1000), // Track per 1k tokens
    });

    return response;
  },
});
```

### Frontend: Display Credit Usage

```typescript
import { useCustomer } from "autumn-js/react";

export function CreditDisplay() {
  const { customer, refetch } = useCustomer();

  const creditFeature = customer?.features?.find(
    (f) => f.feature_id === "ai_credits"
  );

  const usedCredits = creditFeature?.usage || 0;
  const limitCredits = creditFeature?.limit || 1000;
  const remainingCredits = limitCredits - usedCredits;

  return (
    <div>
      <h3>AI Credits</h3>
      <p>{remainingCredits.toLocaleString()} credits remaining</p>
      <progress value={usedCredits} max={limitCredits} />

      {remainingCredits < 100 && (
        <button onClick={() => checkout({ productId: "credit_topup" })}>
          Buy More Credits
        </button>
      )}
    </div>
  );
}
```

### Frontend: Real-time Usage Dashboard with Analytics

```typescript
import { useAnalytics } from "autumn-js/react";
import { useState } from "react";

export function UsageDashboard() {
  const [timeRange, setTimeRange] = useState("30d");

  const { data, isLoading, error } = useAnalytics({
    featureId: ["gpt4_tokens", "claude_tokens", "qwen_tokens"],
    range: timeRange,
  });

  if (isLoading) return <div>Loading usage data...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
        <option value="24h">Last 24 Hours</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
        <option value="last_cycle">Current Billing Cycle</option>
      </select>

      {data?.map((point) => (
        <div key={point.period}>
          <h4>{new Date(point.period).toLocaleDateString()}</h4>
          <p>GPT-4: {point.gpt4_tokens || 0}k tokens</p>
          <p>Claude: {point.claude_tokens || 0}k tokens</p>
          <p>Qwen: {point.qwen_tokens || 0}k tokens</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Implementation: Pricing Table

### Frontend: Display Pricing Options

```typescript
import { PricingTable, CheckoutDialog } from "autumn-js/react";

export function PricingPage() {
  return (
    <div>
      <h1>Pricing Plans</h1>

      {/* Option 1: Use Autumn's default component */}
      <PricingTable />

      {/* Option 2: Customize with productDetails */}
      <PricingTable
        productDetails={[
          {
            id: "free",
            description: "Perfect for trying out AI Whiteboard Chat",
          },
          {
            id: "base",
            description: "For individuals and small teams",
            recommendText: "Most Popular",
          },
          {
            id: "pro",
            description: "For power users and large teams",
          },
        ]}
      />
    </div>
  );
}
```

### Frontend: Upgrade Flow with Paywall Dialog

```typescript
import { useCustomer, PaywallDialog } from "autumn-js/react";

export function FeatureButton() {
  const { check } = useCustomer();

  return (
    <button
      onClick={async () => {
        // Check feature access with automatic paywall
        const { data } = await check({
          featureId: "ai_credits",
          dialog: PaywallDialog, // Automatically shows if not allowed
        });

        if (data?.allowed) {
          // User has access, proceed with feature
          sendMessage();
        }
      }}
    >
      Send Message
    </button>
  );
}
```

---

## Advanced: Multi-Model Cost Preview

Show users cost BEFORE sending message:

```typescript
export function ChatInput() {
  const { customer } = useCustomer();
  const [selectedModel, setSelectedModel] = useState("gpt-4");

  // Cost per 1k tokens in credits
  const costPerThousandTokens = {
    "gpt-4": 10,
    "claude-sonnet": 8,
    "qwen": 2,
  };

  const estimatedTokens = 500; // Estimate based on input length
  const estimatedCost = Math.ceil(
    (estimatedTokens / 1000) * costPerThousandTokens[selectedModel]
  );

  const remainingCredits = customer?.features?.find(
    (f) => f.feature_id === "ai_credits"
  )?.limit - customer?.features?.find(
    (f) => f.feature_id === "ai_credits"
  )?.usage || 0;

  return (
    <div>
      <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
        <option value="gpt-4">GPT-4 (10 credits/1k tokens)</option>
        <option value="claude-sonnet">Claude Sonnet (8 credits/1k tokens)</option>
        <option value="qwen">Qwen (2 credits/1k tokens)</option>
      </select>

      <p>
        Estimated cost: ~{estimatedCost} credits
        ({remainingCredits} remaining)
      </p>

      <button disabled={estimatedCost > remainingCredits}>
        Send Message
      </button>
    </div>
  );
}
```

---

## Best Practices

### 1. Organization-Scoped Billing
- **ALWAYS use `organizationId` as `customerId`** in `autumn.ts` `identify` function
- This ensures billing is per-organization, not per-user
- Teams share the same credit pool and canvas limits

### 2. Track Usage Accurately
- **Use `autumn.track()`** for consumable features (tokens, messages)
  - Increments usage counter
  - Deducts from balance
- **Use `autumn.usage()`** for fixed features (seats, canvases)
  - Sets absolute value (overwrites previous)
  - Use when you know exact count

### 3. Check Before Action
- **ALWAYS check feature access** before expensive operations
- Show users helpful error messages with upgrade paths
- Use `dialog` parameter for automatic upgrade prompts

### 4. Idempotency for Critical Operations
```typescript
await autumn.track(ctx, {
  featureId: "gpt4_tokens",
  value: 10,
  idempotency_key: `msg_${messageId}`, // Prevents double-charging
});
```

### 5. Transparent Pricing
- Show users cost BEFORE they take action
- Display remaining credits prominently
- Provide usage analytics dashboard

### 6. Graceful Degradation
```typescript
const { data, error } = await autumn.check(ctx, { featureId: "ai_credits" });

if (error) {
  // Log error but don't block user
  console.error("Autumn check failed:", error);
  // Optionally: allow action but track manually
}
```

---

## Testing Checklist

- [ ] Canvas creation respects limits
- [ ] Canvas deletion updates count correctly
- [ ] Token usage tracks correctly for each model
- [ ] Credits deduct based on token type (GPT-4 vs Claude vs Qwen)
- [ ] Multiple users in same org share credit pool
- [ ] Upgrade flow works (free → base → pro)
- [ ] Credit top-up purchases work
- [ ] Usage dashboard shows accurate data
- [ ] Paywall dialogs appear when limits reached
- [ ] Idempotency prevents double-charging
- [ ] Cost preview shows accurate estimates

---

## Migration Steps

### Phase 1: Setup (Week 1)
1. Install packages
2. Configure Convex component
3. Setup Autumn client (`convex/autumn.ts`)
4. Setup frontend provider
5. Define pricing config (`autumn.config.ts`)
6. Push to Autumn platform

### Phase 2: Canvas Limits (Week 2)
1. Add canvas limit checks to `createCanvas`
2. Update canvas count on delete
3. Add canvas usage display to dashboard
4. Test with multiple orgs

### Phase 3: Token Metering (Week 3)
1. Add token tracking to AI message handler
2. Add credit display to UI
3. Add cost preview before sending
4. Test with different models

### Phase 4: Pricing & Upgrades (Week 4)
1. Add pricing table page
2. Add upgrade flows with dialogs
3. Add usage analytics dashboard
4. Add credit top-up purchase flow

---

## Troubleshooting

### Issue: "No organization selected" error
**Solution:** Ensure `organizationId` exists in `identify` function:
```typescript
if (!organizationId || typeof organizationId !== "string") {
  return null; // Don't throw, return null
}
```

### Issue: Credits not deducting
**Solution:** Check `credit_schema` in feature definition matches your `track()` calls:
```typescript
// In autumn.config.ts
credit_schema: [
  { metered_feature_id: "gpt4_tokens", credit_cost: 10 },
]

// In backend
await autumn.track(ctx, {
  featureId: "gpt4_tokens", // Must match metered_feature_id
  value: 1,
});
```

### Issue: Canvas count wrong after operations
**Solution:** Use `autumn.usage()` to SET absolute value, not increment:
```typescript
const currentCount = await db.query("canvases")...collect();
await autumn.usage(ctx, {
  featureId: "canvases",
  value: currentCount.length, // Absolute count, not increment
});
```

---

## Resources

- [Autumn Docs](https://docs.useautumn.com)
- [Autumn Convex Setup](https://docs.useautumn.com/setup/convex)
- [Autumn API Reference](https://docs.useautumn.com/api-reference)
- [Autumn Dashboard](https://useautumn.com/dashboard)
- [Convex Autumn Component](https://github.com/useautumn/autumn-js)

---

## Summary

Autumn provides a complete billing solution for AI Whiteboard Chat:

1. **Organization-scoped** - Perfect for multi-tenant with Clerk
2. **Credit system** - Flexible pricing for different AI models
3. **Canvas limits** - Gate features by plan tier
4. **Real-time tracking** - Convex integration for instant updates
5. **Transparent pricing** - Show costs before actions
6. **Upgrade flows** - Built-in dialogs and checkout

Start with canvas limits (simpler), then add token metering once comfortable with the system.
