# AI Credits System - Autumn Implementation Guide

## Overview

Implement org-scoped AI credits using Autumn's metered billing. Track token usage from Convex Agent component and deduct from credit balance in real-time.

**Key Insight**: Vercel AI Gateway (via Convex Agent) provides actual USD cost in `providerMetadata.gateway.cost`. No need to manually calculate rates per model - just convert USD to credits!

## TL;DR - What We Need to Do

1. **Autumn Config** (5 min) - Add `ai_credits` feature as `single_use` type with included usage
2. **Cost Conversion** (5 min) - Create simple util: `parseFloat(gateway.cost) * 4000`
3. **Update usageHandler** (10 min) - Add 3 lines to existing `usageHandler` to call `autumn.track()`
4. **Pre-flight Check** (5 min) - Add credit check before AI call in `sendMessage`
5. **Frontend Display** (15 min) - Add `<CreditBalance>` component to sidebar using `useCustomer()`
6. **Error Handling** (5 min) - Show top-up dialog on insufficient credits

**Total**: ~45 min MVP implementation (most code already exists!)

**Credit Amounts** (4000 credits = $1):
- **Free tier**: 8,000 credits/month ($2 value)
- **Pro Monthly**: 60,000 credits/month ($15 value)
- **Pro Annual**: 720,000 credits/year ($180 value)
- **Top-up**: 40,000 credits for $10 (never expires)

**What We Already Have**:
- ✅ Autumn integrated for canvas tracking
- ✅ `usageHandler` with logging in `convex/canvas/chat.ts`
- ✅ Org-scoped billing configured
- ✅ Vercel AI Gateway providing costs

---

## Vercel AI Gateway Integration

### What We Get

The Convex Agent's `usageHandler` receives a `providerMetadata` object with actual API costs:

```typescript
{
  providerMetadata: {
    gateway: {
      cost: "0.0001545",           // ⭐ Actual USD cost from gateway
      marketCost: "0.0001545",
      routing: { ... },            // Model routing info
      generationId: "gen_...",
    }
  },
  usage: {
    inputTokens: 720,
    outputTokens: 21,
    totalTokens: 741,
  },
  model: "grok-4-fast-non-reasoning",
  provider: "xai",
}
```

### Why This Matters

- ✅ **Automatic rate updates**: If OpenAI/Anthropic changes pricing, Gateway reflects it immediately
- ✅ **All models supported**: No need to maintain rate tables for GPT-4, Claude, Grok, etc.
- ✅ **Precise billing**: Actual cost, not estimates based on token counts
- ✅ **Simpler code**: Just convert USD → credits, no complex calculations

### Conversion Formula

```typescript
// Gateway provides: "0.0001545" (USD)
// We define: 4000 credits = $1 (or 1 credit = $0.00025)
// Conversion: $0.0001545 * 4000 = 0.618 credits

const costInCredits = parseFloat(gateway.cost) * 4000;
```

---

## 1. Database Design

**New Tables**: None (leverage Autumn's usage tracking)

**Schema Adjustments**: None required

**Key Queries**:

- `getCurrentCredits()` - Gets org's credit balance from Autumn customer object
  - Input: organizationId (via auth)
  - Output: `{ balance: number, included_usage: number, usage: number }`
  - Purpose: Display credit balance in UI

- `getUsageByThread(threadId)` - Track usage per thread for transparency
  - Input: threadId
  - Output: `{ totalTokens: number, cost: number }`
  - Purpose: Show cost breakdown per conversation

---

## 2. Data Flow

### High-level Flow

1. **User sends message** → Action handler with auth check
2. **Check credits** → `autumn.check(ctx, { featureId: "ai_credits" })` before AI call
3. **AI processes** → Agent runs with `usageHandler` callback
4. **Usage callback fires** → Track tokens via `autumn.track(ctx, { featureId: "ai_credits", value: tokenCost })`
5. **UI updates** → Real-time credit balance via useCustomer()

### Key Transformations

- **Vercel AI Gateway → Cost**: Extract cost directly from `providerMetadata.gateway.cost`
  - Gateway calculates actual API cost (e.g., "0.0001545" = $0.0001545)
  - Convert USD to credits: `cost_in_credits = parseFloat(gateway.cost) * 4000` (4000 credits = $1)
  - No manual rate calculation needed - Gateway handles all models automatically!

- **Autumn Tracking**: Increment usage by cost amount
  - `autumn.track(ctx, { featureId: "ai_credits", value: cost_in_credits })`

---

## 3. User Flows

### Admin Flow

- View org credit balance in sidebar/dashboard
- See usage breakdown by canvas/thread
- Purchase credit top-ups via Autumn checkout
- Receive low-balance warnings

### End User Flow

- Send AI message (checks credit balance first)
- See live credit deduction after message completes
- Blocked if insufficient credits with upgrade prompt
- View per-message cost transparency

---

## 4. UI Components

### CreditBalance Component

**Purpose**: Display current credit balance with visual indicator
**Key Interactions**:
- Click to view detailed usage breakdown
- Shows warning when < 20% remaining
**Data Requirements**: `customer.features.ai_credits` from useCustomer()

### CreditTopUpDialog Component

**Purpose**: Purchase additional credits
**Key Interactions**:
- Select credit package (500, 1000, 5000 credits)
- Triggers `checkout({ productId: "credits_500" })`
**Data Requirements**: Available credit packages from Autumn config

### MessageCostBadge Component

**Purpose**: Show estimated/actual cost per message
**Key Interactions**: Tooltip with token breakdown
**Data Requirements**: Token usage from message metadata

### LowCreditWarning Component

**Purpose**: Banner warning when credits < 20%
**Key Interactions**: Click to top-up
**Data Requirements**: Current balance vs. included_usage

---

## 5. API Routes

N/A - All logic via Convex actions/mutations

---

## 6. Patterns to Reuse

### Canvas Tracking Pattern (Reusable!)

**From**: `convex/canvas/functions.ts` createCanvas/deleteCanvas
**Apply to**: AI credit tracking

```typescript
// ✅ PATTERN: Action + Internal Mutation + Autumn API
export const sendMessage = action({
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    const organizationId = identity.organizationId;

    // 2. Check limit (pre-flight)
    const { data, error } = await autumn.check(ctx, {
      featureId: "ai_credits",
      amount: ESTIMATED_COST, // Estimate based on prompt length
    });

    if (error || !data?.allowed) {
      throw new Error("Insufficient credits. Please top-up.");
    }

    // 3. Run AI via internal logic
    const result = await agent.streamText(ctx, { threadId }, { prompt });

    // 4. Track actual usage (deduct credits)
    // NOTE: This happens in usageHandler callback automatically!

    return result;
  },
});
```

### usageHandler Pattern (Already Exists!)

**From**: `convex/canvas/chat.ts` createCanvasChatAgent (lines 10-42)
**Status**: ✅ Already implemented with logging - just add Autumn tracking!
**Apply to**: All AI agents with credit tracking

```typescript
function createCreditTrackedAgent(userId: string, organizationId: string) {
  return new Agent(components.agent, {
    name: "Chat Assistant",
    languageModel: 'xai/grok-4-fast-non-reasoning',

    // ⭐ KEY: usageHandler tracks tokens and calls Autumn
    usageHandler: async (ctx, args) => {
      const { threadId, model, provider, usage } = args;

      // Calculate cost based on model rates
      const cost = calculateCost(model, usage);

      // Track usage (decrement credits)
      await autumn.track(ctx, {
        featureId: "ai_credits",
        value: cost, // Positive value = deduction
      });

      // Optional: Log to usage_logs table for transparency
      await ctx.runMutation(internal.usage.logUsage, {
        organizationId,
        userId,
        threadId,
        model,
        provider,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        cost,
        timestamp: Date.now(),
      });
    },
  });
}
```

### Frontend Customer Hook Pattern

**From**: Sidebar canvas usage display
**Apply to**: Credit balance display

```typescript
import { useCustomer } from "autumn-js/react";

function CreditBalance() {
  const { customer, checkout } = useCustomer();

  // ✅ Access credits feature (features is OBJECT, not array!)
  const creditsFeature = customer?.features?.ai_credits;
  const balance = creditsFeature?.balance || 0;
  const included = creditsFeature?.included_usage || 0;
  const used = creditsFeature?.usage || 0;

  const percentRemaining = (balance / included) * 100;
  const isLow = percentRemaining < 20;

  return (
    <div>
      <div>Credits: {balance.toLocaleString()} / {included.toLocaleString()}</div>
      {isLow && (
        <Button onClick={() => checkout({ productId: "credits_500" })}>
          Top Up
        </Button>
      )}
    </div>
  );
}
```

---

## 7. Implementation Steps

### Flow Diagram

```
User sends message
       ↓
[Pre-flight check] autumn.check() → Estimate ~1 credit
       ↓
[AI processes] Agent.streamText() → Vercel AI Gateway
       ↓
[usageHandler fires] providerMetadata.gateway.cost = "0.0001545"
       ↓
[Convert USD→Credits] 0.0001545 * 4000 = 0.618 credits
       ↓
[Track usage] autumn.track({ featureId: "ai_credits", value: 0.618 })
       ↓
[UI updates] useCustomer() reflects new balance (real-time!)
```

### Step 1: Autumn Config

Update `autumn.config.ts`:

```typescript
// Define AI credits feature (single_use = consumed when used)
export const aiCredits = feature({
  id: "ai_credits",
  name: "AI Credits",
  type: "single_use", // ⚠️ single_use, NOT continuous_use!
});

// Free tier (from AUTUMN_PRICING_IMPLEMENTATION_GUIDE.md)
export const free = product({
  id: "free",
  name: "Free",
  items: [
    featureItem({ feature_id: canvases.id, included_usage: 3 }),
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 8000, // $2 worth (4000 credits = $1)
      interval: "month", // Resets monthly
    }),
  ],
});

// Pro tier - Monthly (from AUTUMN_PRICING_IMPLEMENTATION_GUIDE.md)
export const proMonthly = product({
  id: "pro_monthly",
  name: "Pro (Monthly)",
  items: [
    priceItem({ price: 30, interval: "month" }),
    featureItem({ feature_id: canvases.id, included_usage: 999999 }),
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 60000, // $15 worth (4000 credits = $1)
      interval: "month", // Resets monthly
    }),
    // Overage pricing: $1 per 4,000 credits (at-cost passthrough)
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 0.00025, // $0.00025 per credit = $1 per 4000 credits
      billing_units: 1, // Price per individual credit
    }),
  ],
});

// Pro tier - Annual (from AUTUMN_PRICING_IMPLEMENTATION_GUIDE.md)
export const proAnnual = product({
  id: "pro_annual",
  name: "Pro (Annual)",
  items: [
    priceItem({ price: 300, interval: "year" }),
    featureItem({ feature_id: canvases.id, included_usage: 999999 }),
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 720000, // $180 worth (4000 credits = $1)
      interval: "year", // Resets yearly
    }),
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 0.00025,
      billing_units: 1,
    }),
  ],
});

// Credit top-up (one-time purchase)
export const creditTopUp = product({
  id: "credit_topup",
  name: "Credit Top-Up",
  items: [
    priceItem({ price: 10, interval: "lifetime" }), // One-time $10
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 40000, // $10 worth (4000 credits = $1)
    }),
  ],
});

export default {
  features: [canvases, aiCredits],
  products: [free, proMonthly, proAnnual, creditTopUp],
};
```

Push config: `npx atmn push`

---

### Step 2: Cost Conversion Utilities

Create `convex/ai/pricing.ts`:

```typescript
// 4000 credits = $1 USD (or 1 credit = $0.00025)
// Vercel AI Gateway provides cost in USD (e.g., "0.0001545")
// Convert to credits by multiplying by 4000

export function convertUsdToCredits(usdCost: string | number): number {
  const usd = typeof usdCost === 'string' ? parseFloat(usdCost) : usdCost;

  // Convert USD to credits (4000 credits = $1)
  // Example: $0.0001545 * 4000 = 0.618 credits
  const credits = usd * 4000;

  // Round to 2 decimal places for cleaner display
  return Math.round(credits * 100) / 100;
}

export function estimateCost(prompt: string): number {
  // Rough estimate for pre-flight check
  // Average: 1 token ~= 4 chars, typical cost ~$0.0002 per 1k tokens
  const estimatedTokens = Math.ceil(prompt.length / 4);
  const estimatedUsd = (estimatedTokens / 1000) * 0.0002 * 2; // 2x for completion

  return convertUsdToCredits(estimatedUsd);
}
```

---

### Step 3: Update Agent Creation

Update `convex/canvas/chat.ts` and `convex/chat/functions.ts`:

```typescript
import { autumn } from "../autumn";
import { convertUsdToCredits } from "../ai/pricing";
import { internal } from "../_generated/api";

function createCreditTrackedAgent(userId: string, organizationId: string) {
  return new Agent(components.agent, {
    name: "Chat Assistant",
    languageModel: 'xai/grok-4-fast-non-reasoning',
    maxSteps: 10,

    usageHandler: async (ctx, args) => {
      const { threadId, model, provider, usage, providerMetadata } = args;

      // ⭐ Extract cost directly from Vercel AI Gateway!
      const gatewayCost = providerMetadata?.gateway?.cost;
      if (!gatewayCost) {
        console.warn('[AI Usage] No gateway cost found, skipping tracking');
        return;
      }

      // Convert USD to credits (1 credit = $0.001)
      const costInCredits = convertUsdToCredits(gatewayCost);

      console.log('[AI Usage]', {
        organizationId,
        userId,
        threadId,
        model,
        provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        usdCost: gatewayCost,
        creditsDeducted: costInCredits,
      });

      // Track usage with Autumn (deduct credits)
      await autumn.track(ctx, {
        featureId: "ai_credits",
        value: costInCredits, // Positive = deduction for single_use features
      });

      // Optional: Log for detailed breakdown
      // await ctx.runMutation(internal.usage.logUsage, { ... });
    },
  });
}
```

---

### Step 4: Pre-flight Credit Check

Update `convex/canvas/chat.ts` sendMessage:

```typescript
import { estimateCost } from "../ai/pricing";

export const sendMessage = action({
  args: {
    threadId: v.id("threads"),
    canvasNodeId: v.id("canvas_nodes"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const organizationId = identity.organizationId;

    // ========== PRE-FLIGHT CREDIT CHECK ==========
    const estimatedCost = estimateCost(args.message);

    const { data, error } = await autumn.check(ctx, {
      featureId: "ai_credits",
      amount: estimatedCost, // Check if we have enough for estimated cost
    });

    if (error || !data?.allowed) {
      throw new Error(
        `Insufficient credits. This message will cost ~${estimatedCost.toFixed(2)} credits. Top up to continue.`
      );
    }

    // ========== CONTINUE WITH AI CALL ==========
    const agent = createCreditTrackedAgent(userId, organizationId);

    // ... rest of implementation (context gathering, streaming, etc.)
  },
});
```

---

### Step 5: Frontend - Credit Balance Display

Create `src/features/credits/components/CreditBalance.tsx`:

```typescript
import { useCustomer } from "autumn-js/react";
import { CheckoutDialog } from "@/features/pricing/components/CheckoutDialog";

export function CreditBalance() {
  const { customer, checkout } = useCustomer();

  // ✅ Access credits feature (features is OBJECT!)
  const creditsFeature = customer?.features?.ai_credits;
  const balance = creditsFeature?.balance || 0;
  const included = creditsFeature?.included_usage || 0;
  const percentRemaining = (balance / included) * 100;
  const isLow = percentRemaining < 20;

  // Convert to dollars (4000 credits = $1)
  const balanceDollars = (balance / 4000).toFixed(2);
  const includedDollars = (included / 4000).toFixed(2);

  const handleTopUp = async () => {
    await checkout({
      productId: "credit_topup", // $10 for 40,000 credits
      dialog: CheckoutDialog,
    });
  };

  return (
    <div className="p-4 border-t">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">AI Credits</div>
          <div className="text-xs text-muted-foreground">
            {balance.toLocaleString()} credits (${balanceDollars})
          </div>
          <div className="text-xs text-muted-foreground opacity-70">
            {included.toLocaleString()} total (${includedDollars})
          </div>
        </div>

        <Button size="sm" onClick={handleTopUp}>
          Top Up
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isLow ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${Math.max(0, percentRemaining)}%` }}
        />
      </div>

      {isLow && (
        <div className="mt-2 text-xs text-destructive">
          Low credits! Top up to continue using AI features.
        </div>
      )}
    </div>
  );
}
```

Add to sidebar: `src/components/app-sidebar.tsx`

---

### Step 6: Frontend - Error Handling

Update chat components to handle credit errors:

```typescript
const handleSendMessage = async (message: string) => {
  try {
    await sendMessage({ threadId, canvasNodeId, message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send message";

    // Check for credit-specific errors
    if (errorMessage.includes("Insufficient credits")) {
      toast.error(errorMessage, {
        action: {
          label: "Top Up",
          onClick: () => checkout({
            productId: "credits_1000",
            dialog: CheckoutDialog
          }),
        },
      });
    } else {
      toast.error(errorMessage);
    }
  }
};
```

---

## 8. Testing Checklist

- [ ] Free tier: 1000 credits included on signup
- [ ] Pro tier: 10k credits included monthly
- [ ] Credit deduction: Sends message → balance decreases immediately
- [ ] Pre-flight check: Blocks message if insufficient credits
- [ ] Error handling: Shows top-up dialog on credit error
- [ ] UI display: Sidebar shows live credit balance
- [ ] Top-up flow: Purchase adds credits to balance
- [ ] Org-scoped: Team members share credit pool
- [ ] Model rates: Different models deduct correct amounts
- [ ] Usage logging: Console shows token/cost breakdown

---

## 9. Gotchas & Best Practices

### ⚠️ GOTCHA #1: single_use vs continuous_use

```typescript
// ❌ WRONG - Credits are consumed, not continuous!
export const aiCredits = feature({
  type: "continuous_use", // NO! This is for seats/canvases
});

// ✅ CORRECT - single_use for consumable resources
export const aiCredits = feature({
  type: "single_use", // Credits get consumed
});
```

### ⚠️ GOTCHA #2: Positive Value = Deduction

```typescript
// ✅ For single_use features, positive value = consumption
await autumn.track(ctx, {
  featureId: "ai_credits",
  value: 10, // Deducts 10 credits (not adds!)
});

// ❌ Don't use negative values for single_use
await autumn.track(ctx, {
  featureId: "ai_credits",
  value: -10, // WRONG for single_use features
});
```

### ⚠️ GOTCHA #3: Estimate Before Check

Always estimate cost before calling `autumn.check()`:

```typescript
// ✅ CORRECT - Estimate first
const estimatedCost = estimateCost(message, model);
await autumn.check(ctx, { featureId: "ai_credits", amount: estimatedCost });

// ❌ WRONG - Checking without amount doesn't reserve credits
await autumn.check(ctx, { featureId: "ai_credits" }); // Just checks > 0
```

### ⚠️ GOTCHA #4: usageHandler is Async

```typescript
// ✅ usageHandler can call Autumn API (it's in an action context)
usageHandler: async (ctx, args) => {
  await autumn.track(ctx, { ... }); // ✅ Works!
}
```

### ⚠️ GOTCHA #5: Gateway Cost Always Present

Vercel AI Gateway always provides cost - no need for model-specific fallbacks:

```typescript
// ✅ Gateway cost is always present
const gatewayCost = providerMetadata?.gateway?.cost; // "0.0001545"

// ❌ No need for manual model rate lookups anymore!
// Gateway handles all models (GPT-4, Claude, Grok, etc.) automatically
```

---

## 10. Cost Transparency

Show users what they're paying for:

### Message Cost Badge

```typescript
function MessageWithCost({ message, cost }: { message: string; cost: number }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">{message}</div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-xs">
              {cost} credits
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Tokens: {promptTokens} prompt + {completionTokens} completion
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
```

### Pre-send Estimate

```typescript
function ChatInput({ onSend }: { onSend: (msg: string) => void }) {
  const [message, setMessage] = useState("");
  const { customer } = useCustomer();

  const estimatedCost = useMemo(() => {
    if (!message) return 0;
    return estimateCost(message, "xai/grok-4-fast-non-reasoning");
  }, [message]);

  const balance = customer?.features?.ai_credits?.balance || 0;
  const canAfford = balance >= estimatedCost;

  return (
    <div>
      <textarea value={message} onChange={e => setMessage(e.target.value)} />
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Est. cost: {estimatedCost} credits
        </div>
        <Button disabled={!canAfford} onClick={() => onSend(message)}>
          Send {!canAfford && "(Insufficient credits)"}
        </Button>
      </div>
    </div>
  );
}
```

---

## 11. File Reference

### Backend
- `convex/autumn.ts` - Autumn client (already configured)
- `convex/ai/pricing.ts` - **NEW** USD to credits conversion
- `convex/canvas/chat.ts` - Update usageHandler for credits
- `convex/chat/functions.ts` - Update usageHandler for credits
- `autumn.config.ts` - Add ai_credits feature + top-up products

### Frontend
- `src/features/credits/components/CreditBalance.tsx` - **NEW** Balance display
- `src/features/credits/components/CreditTopUpDialog.tsx` - **NEW** Top-up flow
- `src/components/app-sidebar.tsx` - Add CreditBalance component
- `src/features/chat/components/Chat.tsx` - Add error handling for credits

---

## 12. Deployment Steps

1. Update `autumn.config.ts` with ai_credits feature
2. Push config: `npx atmn push`
3. Create `convex/ai/pricing.ts` with cost conversion utilities
4. Update agent creation in `convex/canvas/chat.ts` and `convex/chat/functions.ts`
5. Add pre-flight checks to `sendMessage` actions
6. Create frontend credit components
7. Add CreditBalance to sidebar
8. Update chat error handling
9. Test thoroughly (see checklist above)
10. Deploy: `pnpm deploy` (or whatever your deploy command is)

---

## Resources

- [Autumn Docs - Metered Billing](https://docs.useautumn.com/features/metered-billing)
- [Autumn Docs - single_use Features](https://docs.useautumn.com/features/feature-types)
- [Convex Agent - Usage Tracking](https://docs.convex.dev/agent/usage-tracking)
- [AUTUMN_PAYMENT_FLOW_AND_GOTCHAS.md](./AUTUMN_PAYMENT_FLOW_AND_GOTCHAS.md)
