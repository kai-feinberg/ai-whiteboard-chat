# Autumn Integration with Convex: Complete Implementation Guide

**For**: Adding billing, credits, and feature gating to multi-tenant Convex applications
**Prerequisites**: Existing Convex app with authentication (Clerk recommended)
**Time to implement**: 2-4 weeks

---

## Table of Contents
1. [Feature Overview](#feature-overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Database Schema Considerations](#database-schema-considerations)
5. [Core Implementation Patterns](#core-implementation-patterns)
6. [AI Credit Tracking with Provider Metadata](#ai-credit-tracking-with-provider-metadata)
7. [Frontend Integration](#frontend-integration)
8. [Configuration & Deployment](#configuration--deployment)
9. [Testing Strategy](#testing-strategy)
10. [Common Gotchas](#common-gotchas)

---

## Feature Overview

### Purpose
Autumn provides organization-scoped billing and feature gating for Convex applications, enabling:
- **AI credit metering** - Track actual AI costs and deduct from credit balance
- **Feature limits** - Gate features based on subscription tier (canvases, nodes, custom agents, etc.)
- **Real-time updates** - Credit balance updates instantly via Convex reactivity
- **Multi-tenant billing** - Each organization has its own credit pool and limits

### User Value
- **Transparent pricing** - Users see actual AI costs (4000 credits = $1)
- **Flexible tiers** - Free tier to try, Pro for unlimited features
- **Usage tracking** - Real-time visibility into credit consumption
- **Shared resources** - Teams share credit pools and feature limits

### Key Functionality
1. Check feature access before expensive operations
2. Track usage after operations complete
3. Display real-time balance in UI
4. Refetch credits after AI operations to update UI
5. Block operations when limits reached with upgrade prompts

---

## Architecture

### Data Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ User Action (Create Canvas, Send Chat Message)             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend (Convex Action/Mutation)                           │
│                                                             │
│  1. Authenticate & get organizationId                       │
│  2. autumn.check(ctx, { featureId: "..." })                │
│  3. If allowed → Perform operation                          │
│  4. autumn.track(ctx, { featureId: "...", value: X })      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Autumn Convex Component                                     │
│                                                             │
│  - Identifies customer via organizationId                   │
│  - Checks feature limits & balance                          │
│  - Tracks usage (increment/decrement)                       │
│  - Syncs with Autumn API                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React)                                            │
│                                                             │
│  - useCustomer() hook provides real-time customer data      │
│  - Display balance, limits, upgrade prompts                 │
│  - refetch() after AI operations to update UI               │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Map

**Backend Components:**
- `convex/autumn.ts` - Autumn client initialization, exports API functions
- `convex/convex.config.ts` - Registers Autumn component with Convex
- `convex/[feature]/functions.ts` - Feature logic with check/track calls
- `convex/ai/pricing.ts` - USD to credits conversion utilities

**Frontend Components:**
- `src/routes/__root.tsx` - AutumnProvider wrapper
- `src/features/credits/components/CreditBalance.tsx` - Balance display
- Feature components - Use `useCustomer()` hook for limits

**External Services:**
- Autumn API - Manages customers, products, features
- Clerk - Authentication & organization management
- Vercel AI Gateway - Provides actual AI costs in metadata

---

## Installation & Setup

### Step 1: Install Packages

```bash
pnpm add autumn-js @useautumn/convex
```

### Step 2: Configure Convex Component

**File**: `convex/convex.config.ts`

```typescript
import { defineApp } from "convex/server";
import autumn from "@useautumn/convex/convex.config";

const app = defineApp();
app.use(autumn);

export default app;
```

**Key Points:**
- Import the Autumn component config
- Register with `app.use(autumn)`
- Deploy changes: `npx convex deploy`

### Step 3: Set Environment Variable

Get your secret key from [useautumn.com](https://useautumn.com) dashboard:

```bash
npx convex env set AUTUMN_SECRET_KEY=am_sk_xxxxxxxxxxxxx
```

### Step 4: Initialize Autumn Client

**File**: `convex/autumn.ts` (create new file)

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
      customerId: organizationId, // NOT user ID!
      customerData: {
        name: identity.organizationName as string,
        email: identity.email as string,
      },
    };
  },
});

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

**Critical Details:**
- `customerId: organizationId` - Bills per org, not per user
- `identify` function called automatically on every request
- Return `null` if no org selected (handles unauthenticated state)
- Export all API functions for use in backend and frontend

### Step 5: Setup Frontend Provider

**File**: `src/routes/__root.tsx` (or your root component)

```typescript
import { AutumnProvider } from "autumn-js/react";
import { api } from "../../convex/_generated/api";
import { useConvex } from "convex/react";

function AutumnWrapper({ children }: { children: React.ReactNode }) {
  const convex = useConvex();

  return (
    <AutumnProvider convex={convex} convexApi={(api as any).autumn}>
      {children}
    </AutumnProvider>
  );
}

// In your provider tree:
<ClerkProvider>
  <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
    <AutumnWrapper>
      {children}
    </AutumnWrapper>
  </ConvexProviderWithClerk>
</ClerkProvider>
```

**Key Points:**
- Use `useConvex()` hook to get Convex client (NOT URL-based)
- Pass `convex={convex}` and `convexApi={(api as any).autumn}`
- Place inside `ConvexProviderWithClerk` so Convex context is available
- No manual token management needed

---

## Database Schema Considerations

### Organization-Scoped Data

**All tables must include `organizationId` field:**

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  canvases: defineTable({
    organizationId: v.string(), // REQUIRED for org-scoped billing
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_updated", ["organizationId", "updatedAt"]),

  // Other tables follow same pattern
});
```

**Required Indexes:**
- `by_organization` - For querying all org's data
- `by_org_updated` - For sorting by recency within org
- `by_canvas` - For querying nodes/edges within a canvas

**Migration Considerations:**
- If migrating existing data, backfill `organizationId` field
- Consider data isolation strategy for personal vs team orgs
- Clerk personal orgs have ID format: `user_xxxxx`

---

## Core Implementation Patterns

### Pattern 1: Feature Gating (Continuous Use Features)

**Use Case**: Canvas limits, node limits, custom agents, team seats

**Backend - Check Before Creation**

```typescript
import { mutation, action } from "../_generated/server";
import { autumn } from "../autumn";
import { v } from "convex/values";

export const createCanvas = action({
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

    // ========== CHECK FEATURE LIMIT ==========
    const { data: checkData, error: checkError } = await autumn.check(ctx, {
      featureId: "canvases",
    });

    if (checkError || !checkData?.allowed) {
      throw new Error(
        "Canvas limit reached. Upgrade to Pro for unlimited canvases."
      );
    }

    // ========== CREATE RESOURCE ==========
    const canvasId = await ctx.runMutation(internal.canvas.createCanvasMutation, {
      organizationId,
      userId,
      title: args.title,
      description: args.description,
      now: Date.now(),
    });

    // ========== TRACK USAGE (Increment by 1) ==========
    await autumn.track(ctx, {
      featureId: "canvases",
      value: 1,
    });

    return canvasId;
  },
});
```

**Backend - Update Count on Deletion**

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

    // Delete resource
    await ctx.db.delete(args.canvasId);

    // ========== TRACK USAGE (Decrement by 1) ==========
    await autumn.track(ctx, {
      featureId: "canvases",
      value: -1, // Negative to decrement
    });
  },
});
```

**Frontend - Display Limits**

```typescript
import { useCustomer } from "autumn-js/react";

export function CanvasLimitBadge() {
  const { customer } = useCustomer();

  // Access feature from object (NOT array!)
  const canvasFeature = customer?.features?.canvases;

  const usage = canvasFeature?.usage || 0;
  const limit = canvasFeature?.included_usage || 1;
  const isUnlimited = limit >= 999999;

  return (
    <div>
      <p>
        Canvases: {usage} / {isUnlimited ? "Unlimited" : limit}
      </p>
      {!isUnlimited && usage >= limit && (
        <p className="text-destructive">
          Limit reached. <a href="/pricing">Upgrade to Pro</a>
        </p>
      )}
    </div>
  );
}
```

**Key Concepts:**
- `autumn.check()` - Verify if action is allowed (pre-flight)
- `autumn.track()` - Record usage change (post-operation)
- Use `value: 1` to increment, `value: -1` to decrement
- `included_usage: 999999` = effectively unlimited

---

### Pattern 2: Zero-Limit Features (Pro-Only Gating)

**Use Case**: Custom agents (Free tier = 0, Pro = unlimited)

**Backend - Check Zero Limit**

```typescript
export const createCustomAgent = mutation({
  args: {
    name: v.string(),
    systemPrompt: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const organizationId = identity.organizationId;
    if (!organizationId) throw new Error("No organization selected");

    // ========== CHECK IF FEATURE AVAILABLE ==========
    const { data: checkData } = await autumn.check(ctx, {
      featureId: "custom_agents",
    });

    if (checkData?.limit === 0) {
      throw new Error(
        "Custom agents not available on Free tier. Upgrade to Pro."
      );
    }

    // Get current count
    const currentAgents = await ctx.db
      .query("custom_agents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    if (currentAgents.length >= (checkData?.limit || 0)) {
      throw new Error("Custom agent limit reached.");
    }

    // Create resource
    const agentId = await ctx.db.insert("custom_agents", {
      organizationId,
      name: args.name,
      systemPrompt: args.systemPrompt,
      model: args.model,
      createdBy: identity.subject,
      createdAt: Date.now(),
    });

    // Track usage
    await autumn.track(ctx, {
      featureId: "custom_agents",
      value: 1,
    });

    return agentId;
  },
});
```

**Frontend - Pro Gate UI**

```typescript
export function CustomAgentsPage() {
  const { customer, checkout } = useCustomer();

  const agentFeature = customer?.features?.custom_agents;
  const limit = agentFeature?.included_usage || 0;
  const canCreate = limit > 0;

  if (!canCreate) {
    return (
      <div className="border rounded p-6 text-center">
        <h3>Custom Agents (Pro Feature)</h3>
        <p className="text-muted-foreground">
          Create custom AI agents with your own prompts and models
        </p>
        <button onClick={() => checkout({ productId: "pro_monthly" })}>
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return <CustomAgentsList />;
}
```

---

## AI Credit Tracking with Provider Metadata

### The Credit System

**Conversion Rate**: 4000 credits = $1 USD

**Why This Ratio?**
- Feels generous (thousands of credits vs cents)
- Still transparent (easy to convert: divide by 4000)
- Works well with typical AI costs ($0.0001-0.01 per request)

### Pattern 3: AI Usage Tracking with Vercel AI Gateway

**Use Case**: Track AI API costs and deduct from credit balance

**Step 1: Create Pricing Utility**

**File**: `convex/ai/pricing.ts`

```typescript
/**
 * Convert USD cost to credits
 * 4000 credits = $1 USD
 */
export function convertUsdToCredits(usdCost: string | number): number {
  const usd = typeof usdCost === 'string' ? parseFloat(usdCost) : usdCost;
  const credits = usd * 4000;
  return Math.round(credits * 100) / 100; // Round to 2 decimals
}

/**
 * Estimate cost for pre-flight check
 */
export function estimateCost(prompt: string): number {
  const estimatedTokens = Math.ceil(prompt.length / 4);
  const estimatedUsd = (estimatedTokens / 1000) * 0.0002 * 2; // 2x for completion
  return convertUsdToCredits(estimatedUsd);
}
```

**Step 2: Configure Agent with Usage Handler**

**File**: `convex/canvas/chat.ts` (or your AI action)

```typescript
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { autumn } from "../autumn";
import { convertUsdToCredits } from "../ai/pricing";

function createCanvasChatAgent(userId: string, organizationId: string) {
  return new Agent(components.agent, {
    name: "Canvas Chat Assistant",
    languageModel: 'openai/gpt-4o-mini',
    usageHandler: async (ctx, args) => {
      const {
        threadId,
        agentName,
        model,
        provider,
        usage,
        providerMetadata // ✨ This contains actual cost from Vercel AI Gateway
      } = args;

      // Extract cost from Vercel AI Gateway
      // Gateway adds `gateway.cost` to providerMetadata
      const gatewayCost = providerMetadata?.gateway?.cost;

      if (!gatewayCost) {
        console.warn('[Usage Handler] No gateway cost found, skipping tracking');
        return;
      }

      // Convert USD to credits
      const costInCredits = convertUsdToCredits(gatewayCost);

      console.log('[AI Usage]', {
        userId,
        organizationId,
        threadId,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        usdCost: gatewayCost,
        creditsDeducted: costInCredits,
      });

      // Track usage with Autumn (deduct credits)
      await autumn.track(ctx, {
        featureId: "ai_credits",
        value: costInCredits, // Positive value = deduction for single_use
      });
    },
  });
}
```

**Step 3: Pre-Flight Credit Check**

```typescript
export const sendMessage = action({
  args: {
    threadId: v.id("threads"),
    canvasNodeId: v.id("canvas_nodes"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const organizationId = identity.organizationId;
    if (!organizationId) throw new Error("No organization selected");

    // ========== PRE-FLIGHT CREDIT CHECK ==========
    const { data, error } = await autumn.check(ctx, {
      featureId: "ai_credits",
    });

    if (error || !data?.allowed) {
      throw new Error(
        "Insufficient credits. Please upgrade or wait for your monthly reset."
      );
    }

    // Create agent with user context for usage tracking
    const agent = createCanvasChatAgent(identity.subject, organizationId);

    // Send message (usageHandler will track credits automatically)
    const result = await agent.streamText(
      ctx,
      { threadId: args.threadId },
      { prompt: args.message }
    );

    return await result.text;
  },
});
```

**Key Points:**
- `providerMetadata.gateway.cost` - Actual USD cost from Vercel AI Gateway
- `usageHandler` called automatically after AI response completes
- Credits deducted based on real cost, not estimates
- Pre-flight check prevents requests when balance is zero

---

### Frontend: Real-Time Credit Display

**Pattern 4: Live Credit Balance with Refetch**

**File**: `src/features/credits/components/CreditBalance.tsx`

```typescript
import { useCustomer } from "autumn-js/react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export function CreditBalance() {
  const navigate = useNavigate();
  const { customer } = useCustomer();

  // Access credits feature (features is OBJECT, not array!)
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
        <span className="text-sm font-medium">AI Credits</span>
        {isPro && <span className="text-xs text-yellow-600">Pro</span>}
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
          Upgrade to Pro
        </Button>
      )}
    </div>
  );
}
```

**Pattern 5: Refetch After AI Operations**

```typescript
import { useCustomer } from "autumn-js/react";

function ChatInterface() {
  const { refetch } = useCustomer();
  const sendMessage = useAction(api.canvas.chat.sendMessage);

  const handleSendMessage = async (message: string) => {
    try {
      await sendMessage({
        threadId,
        canvasNodeId,
        message
      });

      // ✨ Refetch credits after message to update UI
      await refetch();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return <ChatUI onSendMessage={handleSendMessage} />;
}
```

**Why Refetch?**
- Autumn updates credits in usageHandler (backend)
- UI needs to re-query to see updated balance
- Convex subscriptions would work, but Autumn data is external
- Manual refetch is simple and reliable

---

## Configuration & Deployment

### Autumn CLI Configuration

**Step 1: Initialize CLI**

```bash
npx atmn init
```

Creates `.env` with Autumn API keys.

**Step 2: Define Products & Features**

**File**: `autumn.config.ts` (project root)

```typescript
import {
  feature,
  product,
  priceItem,
  featureItem,
  pricedFeatureItem,
} from "autumn-js/compose";

// ==================== FEATURES ====================

// Canvas limit
export const canvases = feature({
  id: "canvases",
  name: "Canvases",
  type: "continuous_use", // Always active, like seats
});

// AI Credits
export const aiCredits = feature({
  id: "ai_credits",
  name: "AI Credits",
  type: "single_use", // Consumed and gone
});

// Custom agents (Pro only)
export const customAgents = feature({
  id: "custom_agents",
  name: "Custom Agents",
  type: "continuous_use",
});

// ==================== PRODUCTS ====================

// Free tier
export const free = product({
  id: "free",
  name: "Free",
  items: [
    featureItem({
      feature_id: canvases.id,
      included_usage: 1,
    }),
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 8000, // $2 worth (4000 credits = $1)
      interval: "month", // Resets monthly
    }),
    featureItem({
      feature_id: customAgents.id,
      included_usage: 0, // 0 = not available
    }),
  ],
});

// Pro tier (Monthly)
export const proMonthly = product({
  id: "pro_monthly",
  name: "Pro (Monthly)",
  items: [
    priceItem({
      price: 30,
      interval: "month",
    }),
    featureItem({
      feature_id: canvases.id,
      included_usage: 999999, // Unlimited
    }),
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 60000, // $15 worth
      interval: "month",
    }),
    // Overage pricing: $1 per 4,000 credits
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 0.00025, // $0.00025 per credit = $1 per 4000
      billing_units: 1,
    }),
    featureItem({
      feature_id: customAgents.id,
      included_usage: 999999, // Unlimited
    }),
  ],
});

export default {
  features: [canvases, aiCredits, customAgents],
  products: [free, proMonthly],
};
```

**Step 3: Push to Autumn**

```bash
npx atmn push
```

Syncs config to Autumn platform.

---

## Testing Strategy

### Manual Testing Checklist

**Feature Gating:**
- [ ] Create resource respects limits (1 canvas on Free, unlimited on Pro)
- [ ] Delete resource updates count correctly
- [ ] Error message shows when limit reached
- [ ] Upgrade flow works (Free → Pro)

**AI Credits:**
- [ ] Credits deduct after AI message sent
- [ ] Deduction matches actual cost from provider metadata
- [ ] Balance displays correctly in UI (credits + dollars)
- [ ] Refetch updates UI after message sent
- [ ] Pre-flight check blocks when balance is zero

**Multi-Tenant:**
- [ ] Multiple users in same org share credit pool
- [ ] Multiple users in same org share feature limits
- [ ] Different orgs have separate credit pools
- [ ] Personal org vs team org billing works

**Real-Time Updates:**
- [ ] Credit balance updates immediately after refetch
- [ ] Feature limits update after create/delete operations
- [ ] Multiple tabs show consistent data

### Automated Testing

**Unit Tests - Pricing Utilities:**

```typescript
import { convertUsdToCredits } from "./convex/ai/pricing";

test("converts USD to credits correctly", () => {
  expect(convertUsdToCredits(1)).toBe(4000);
  expect(convertUsdToCredits(0.25)).toBe(1000);
  expect(convertUsdToCredits(0.0001)).toBe(0.4);
  expect(convertUsdToCredits("0.0001545")).toBe(0.62);
});
```

**Integration Tests - Feature Checks:**

```typescript
import { ConvexTestingHelper } from "convex-test";
import { autumn } from "./convex/autumn";

test("canvas limit enforced on Free tier", async () => {
  const t = new ConvexTestingHelper();

  // Mock user with Free tier org
  t.setAuth({ organizationId: "org_free123" });

  // Create first canvas - should succeed
  const canvas1 = await t.run(api.canvas.functions.createCanvas, {
    title: "Canvas 1",
  });
  expect(canvas1).toBeDefined();

  // Try to create second canvas - should fail
  await expect(
    t.run(api.canvas.functions.createCanvas, { title: "Canvas 2" })
  ).rejects.toThrow("Canvas limit reached");
});
```

---

## Common Gotchas

### 1. Customer Object Structure

**WRONG:**
```typescript
const creditFeature = customer?.features?.find(f => f.feature_id === "ai_credits");
```

**RIGHT:**
```typescript
const creditFeature = customer?.features?.ai_credits;
```

**Why**: `customer.features` is an **object keyed by feature ID**, NOT an array!

```typescript
customer = {
  products: [{ name: "Free" }], // Array of products
  features: {                   // Object keyed by feature ID
    canvases: { usage: 0, included_usage: 1, ... },
    ai_credits: { balance: 8000, included_usage: 8000, ... }
  }
}
```

---

### 2. Organization ID is NOT Optional

**WRONG:**
```typescript
const organizationId = identity.organizationId || identity.subject;
```

**RIGHT:**
```typescript
const organizationId = identity.organizationId;
if (!organizationId || typeof organizationId !== "string") {
  throw new Error("No organization selected");
}
```

**Why**: Autumn billing is org-scoped. Falling back to user ID breaks multi-tenant logic.

---

### 3. Provider Metadata Path

**WRONG:**
```typescript
const cost = providerMetadata?.cost;
```

**RIGHT:**
```typescript
const cost = providerMetadata?.gateway?.cost;
```

**Why**: Vercel AI Gateway nests cost under `gateway` key. Direct `cost` field won't exist.

---

### 4. Track vs Usage

**track()** - Relative change (increment/decrement)
```typescript
await autumn.track(ctx, {
  featureId: "canvases",
  value: 1, // Increment by 1
});
```

**usage()** - Absolute value (set to specific count)
```typescript
await autumn.usage(ctx, {
  featureId: "canvases",
  value: currentCanvases.length, // Set to this count
});
```

**When to use which?**
- Use `track()` for events (create, delete, consume credits)
- Use `usage()` for syncing current state (useful for migrations)

---

### 5. Actions vs Mutations for Autumn Calls

**Actions required for Autumn calls** because they use `fetch` under the hood:

```typescript
// ✅ CORRECT - Action can call autumn.check() and autumn.track()
export const createCanvas = action({
  handler: async (ctx, args) => {
    await autumn.check(ctx, { featureId: "canvases" });
    const id = await ctx.runMutation(internal.canvas.createMutation, { ... });
    await autumn.track(ctx, { featureId: "canvases", value: 1 });
  },
});

// ❌ WRONG - Mutations cannot call autumn.check() (uses fetch)
export const createCanvas = mutation({
  handler: async (ctx, args) => {
    await autumn.check(ctx, { featureId: "canvases" }); // ERROR!
  },
});
```

**Pattern**: Check in action → Create in mutation → Track in action

---

### 6. Refetch is Manual

Autumn data doesn't automatically update in UI via Convex subscriptions. You must manually refetch:

```typescript
const { refetch } = useCustomer();

const handleSendMessage = async (message: string) => {
  await sendMessage({ ... });
  await refetch(); // ✨ Required to see updated balance
};
```

---

### 7. Idempotency for Critical Operations

Prevent double-charging with idempotency keys:

```typescript
await autumn.track(ctx, {
  featureId: "ai_credits",
  value: creditsUsed,
  idempotency_key: `thread_${threadId}_${Date.now()}`,
});
```

**When to use**: Any operation that might retry (network errors, user double-clicks, etc.)

---

## Implementation Checklist

### Phase 1: Setup (Week 1)
- [ ] Install `autumn-js` and `@useautumn/convex` packages
- [ ] Configure `convex.config.ts` with Autumn component
- [ ] Create `convex/autumn.ts` with identify function
- [ ] Set `AUTUMN_SECRET_KEY` environment variable
- [ ] Add `AutumnProvider` to root component
- [ ] Define pricing config in `autumn.config.ts`
- [ ] Push config to Autumn platform with `npx atmn push`
- [ ] Test authentication flow (org selected = customer created)

### Phase 2: Feature Gating (Week 2)
- [ ] Add canvas limit checks to `createCanvas` action
- [ ] Add canvas limit tracking to `deleteCanvas` mutation
- [ ] Add node limit checks to `addNodeToCanvas` action
- [ ] Add custom agent limit checks to `createCustomAgent` mutation
- [ ] Create `CreditBalance` component for sidebar
- [ ] Test with multiple organizations (Free vs Pro)
- [ ] Test edge cases (no org selected, limit exactly reached, etc.)

### Phase 3: AI Credit Tracking (Week 3)
- [ ] Create `convex/ai/pricing.ts` utility file
- [ ] Add `usageHandler` to Agent configuration
- [ ] Extract cost from `providerMetadata.gateway.cost`
- [ ] Convert USD to credits using 4000:1 ratio
- [ ] Add pre-flight credit check to `sendMessage` action
- [ ] Add `refetch()` call after message sent
- [ ] Display credit balance in UI (credits + dollars)
- [ ] Test with different models and context sizes
- [ ] Verify credits deduct correctly in Autumn dashboard

### Phase 4: Pricing & Upgrades (Week 4)
- [ ] Create pricing table page with `PricingTable` component
- [ ] Add upgrade flows with `checkout()` function
- [ ] Add credit top-up purchase flow (optional)
- [ ] Test upgrade flow (Free → Pro)
- [ ] Test downgrade flow (Pro → Free)
- [ ] Verify credit reset works (monthly/yearly)
- [ ] Add error handling for failed payments
- [ ] Document pricing strategy for users

---

## Best Practices

### 1. Always Check Before Expensive Operations

```typescript
// Pre-flight check prevents wasted work
const { data } = await autumn.check(ctx, { featureId: "ai_credits" });
if (!data?.allowed) {
  throw new Error("Insufficient credits");
}

// Only then perform expensive operation
await agent.streamText(...);
```

### 2. Show Users Cost Before Action

```typescript
const estimatedCredits = estimateCost(message);
const remainingCredits = customer?.features?.ai_credits?.balance || 0;

if (estimatedCredits > remainingCredits) {
  return <div>Estimated cost ({estimatedCredits} credits) exceeds balance</div>;
}
```

### 3. Graceful Degradation

```typescript
const { data, error } = await autumn.check(ctx, { featureId: "ai_credits" });

if (error) {
  console.error("Autumn check failed:", error);
  // Option 1: Fail closed (block operation)
  throw new Error("Unable to verify credits");

  // Option 2: Fail open (allow but log)
  console.warn("Proceeding without credit check");
}
```

### 4. Transparent Pricing UI

```typescript
function CreditDisplay() {
  const credits = 618;
  const dollars = (credits / 4000).toFixed(4);

  return (
    <div>
      <p className="text-2xl">{credits.toLocaleString()} credits</p>
      <p className="text-sm text-muted">≈ ${dollars} (4000 credits = $1)</p>
    </div>
  );
}
```

### 5. Organization-Scoped Everything

```typescript
// ALWAYS verify organization ownership
const canvas = await ctx.db.get(args.canvasId);
if (!canvas || canvas.organizationId !== organizationId) {
  throw new Error("Canvas not found or access denied");
}

// ALWAYS use organization indexes
const canvases = await ctx.db
  .query("canvases")
  .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
  .collect();
```

---

## Resources

- [Autumn Docs](https://docs.useautumn.com)
- [Autumn Convex Integration](https://docs.useautumn.com/setup/convex)
- [Autumn API Reference](https://docs.useautumn.com/api-reference)
- [Convex Docs](https://docs.convex.dev)
- [Clerk Organizations](https://clerk.com/docs/organizations/overview)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

---

## Summary

Autumn provides a complete billing solution for Convex applications:

✅ **Organization-scoped billing** - Perfect for multi-tenant with Clerk
✅ **Transparent credit system** - 4000 credits = $1 (real-time passthrough)
✅ **Feature gating** - Canvas, node, custom agent limits by tier
✅ **Real-time tracking** - Convex integration for instant updates
✅ **Simple API** - `check()` before, `track()` after
✅ **Manual refetch** - Update UI after AI operations

**Key Patterns:**
1. Feature gating: `check()` → create → `track(value: 1)`
2. AI credits: `check()` → AI call → usageHandler tracks automatically
3. Frontend: `useCustomer()` for data, `refetch()` after operations
4. Organization: Always use `organizationId` as `customerId`

**Implementation Time**: 2-4 weeks for full integration with all features.

**Gotchas to Avoid:**
- `customer.features` is object, not array
- `organizationId` is required, not optional
- Autumn calls require actions, not mutations
- Manual `refetch()` after operations
- Provider metadata is `providerMetadata.gateway.cost`

**Result**: Transparent, real-time billing for AI SaaS with minimal code.
