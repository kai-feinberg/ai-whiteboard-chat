# Autumn Pricing Component - Implementation Guide for AI Whiteboard Chat

## 📋 Autumn Features Required

You need to configure these features in Autumn to implement the pricing strategy:

| Feature ID | Feature Name | Type | Purpose | Free Tier | Pro Tier |
|------------|--------------|------|---------|-----------|----------|
| `canvases` | Canvases | `continuous_use` | Limit number of canvases per org | 1 | Unlimited |
| `nodes_per_canvas` | Nodes Per Canvas | `continuous_use` | Limit nodes per canvas | 5 (any type) | Unlimited |
| `ai_credits` | AI Credits | `single_use` | Meter AI usage (4000 credits = $1) | 8,000/month | 60,000/month |
| `custom_agents` | Custom Agents | `continuous_use` | Gate custom agent creation | 0 (presets only) | Unlimited |
| `team_seats` | Team Seats | `continuous_use` | Control team size | 1 | 5 (+$5/seat) |

### Credit Conversion Formula
- **4,000 credits = $1.00** (customer-facing)
- Backend conversion: `creditsUsed = Math.ceil(costInDollars * 4000)`
- Rationale: More generous-sounding numbers, still transparent

---

## Overview

This guide details how to implement Autumn's Convex component to add:
1. **AI credit metering** - Track AI usage with transparent pricing (4000 credits = $1)
2. **Canvas limits** - Restrict number of canvases per organization
3. **Node limits** - Restrict number of nodes per canvas (Free tier only)
4. **Custom agents** - Gate custom agent creation by tier
5. **Team seats** - Control team size per organization
6. **Pricing tiers** - Free and Pro plans with clear upgrade paths

## Why Autumn for Your App

- **Org-scoped billing** - Perfect for multi-tenant with Clerk organizations
- **Real-time metering** - Track AI usage as it happens with cost passthrough
- **Convex integration** - Native integration with your existing Convex backend
- **Transparent pricing** - Credits map to dollars (4000 credits = $1)
- **Feature gating** - Canvas, node, and custom agent limits by tier
- **Profitable margins** - Base subscription fee + AI credits at cost

---

## Pricing Strategy

### Competitive Positioning
- **vs. Poppy AI ($300/year):** More customizable (custom agents), transparent pricing, monthly option, free tier
- **vs. Competitors:** Unlimited nodes (all types), generous free tier, team collaboration built-in

### Value Proposition
- "Transparent AI canvases for modern teams"
- "Unlimited context inputs (nodes). Pay for AI usage at cost."
- "4,000 credits = $1. No hidden markups."

### Pricing Tiers Summary

| | **Free** | **Pro Monthly** | **Pro Annual** |
|---|----------|-----------------|----------------|
| **Price** | $0 | $30/month | $300/year |
| **Canvases** | 1 | Unlimited | Unlimited |
| **Nodes/Canvas** | 5 (all types) | Unlimited | Unlimited |
| **AI Credits** | 8,000/month ($2) | 60,000/month ($15) | 720,000/year ($180) |
| **Overage** | - | $1 per 4,000 credits | $1 per 4,000 credits |
| **Custom Agents** | Presets only | Unlimited | Unlimited |
| **Team Seats** | 1 | 5 (+$5/seat) | 5 (+$5/seat) |
| **Reset** | Monthly | Monthly | Yearly |

**Profit Margins:**
- **Pro Monthly:** $30 price - $15 credits = **$15/month profit** (50% margin)
- **Pro Annual:** $300 price - $180 credits = **$120/year profit** (40% margin)
- **Overage:** At-cost passthrough (no markup on AI usage)

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

✅ **Implementation Complete** - See [convex/autumn.ts](../convex/autumn.ts)

### 5. Setup Frontend Provider

**File: `src/routes/__root.tsx`** (or wherever you have your providers)

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

// Wrap in your provider tree:
<ClerkProvider>
  <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
    <AutumnWrapper>
      {children}
    </AutumnWrapper>
  </ConvexProviderWithClerk>
</ClerkProvider>
```

**Key Points:**
- Use `useConvex()` hook to get the Convex client instance (not URL-based approach)
- Pass `convex={convex}` and `convexApi={(api as any).autumn}` props
- Place `AutumnWrapper` inside `ConvexProviderWithClerk` so Convex context is available
- No need for manual token management - uses existing Convex auth

✅ **Implementation Complete** - See [src/routes/__root.tsx](../src/routes/__root.tsx)

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
  type: "continuous_use",
});

// Node limit per canvas (Free tier only)
export const nodesPerCanvas = feature({
  id: "nodes_per_canvas",
  name: "Nodes Per Canvas",
  type: "continuous_use",
});

// AI Credits for token usage (single_use = consumed and gone)
// 4000 credits = $1 (4x multiplier for better perceived value)
export const aiCredits = feature({
  id: "ai_credits",
  name: "AI Credits",
  type: "single_use", // Direct consumption, no complex credit_schema
});

// Custom agents limit
export const customAgents = feature({
  id: "custom_agents",
  name: "Custom Agents",
  type: "continuous_use",
});

// Team seats limit
export const teamSeats = feature({
  id: "team_seats",
  name: "Team Seats",
  type: "continuous_use",
});

// ==================== PRODUCTS ====================

// Free tier
export const free = product({
  id: "free",
  name: "Free",
  items: [
    // 1 canvas
    featureItem({
      feature_id: canvases.id,
      included_usage: 1,
    }),
    // 5 nodes per canvas (any type)
    featureItem({
      feature_id: nodesPerCanvas.id,
      included_usage: 5,
    }),
    // $2 in AI credits (8,000 credits at 4000:1 ratio)
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 8000, // $2 worth (4000 credits = $1)
      interval: "month", // Resets monthly
    }),
    // No custom agents (preset only)
    featureItem({
      feature_id: customAgents.id,
      included_usage: 0, // 0 = preset agents only
    }),
    // 1 team seat (solo only)
    featureItem({
      feature_id: teamSeats.id,
      included_usage: 1,
    }),
  ],
});

// Pro tier (Monthly)
export const proMonthly = product({
  id: "pro_monthly",
  name: "Pro (Monthly)",
  items: [
    // $30/month flat fee
    priceItem({
      price: 30,
      interval: "month",
    }),
    // Unlimited canvases
    featureItem({
      feature_id: canvases.id,
      included_usage: 999999, // Effectively unlimited
    }),
    // Unlimited nodes per canvas
    featureItem({
      feature_id: nodesPerCanvas.id,
      included_usage: 999999, // No limit
    }),
    // $15 in AI credits included (60,000 credits at 4000:1 ratio)
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
    // Unlimited custom agents
    featureItem({
      feature_id: customAgents.id,
      included_usage: 999999,
    }),
    // 5 team seats included
    featureItem({
      feature_id: teamSeats.id,
      included_usage: 5,
    }),
  ],
});

// Pro tier (Annual - same as Poppy price)
export const proAnnual = product({
  id: "pro_annual",
  name: "Pro (Annual)",
  items: [
    // $300/year (same as Poppy AI)
    priceItem({
      price: 300,
      interval: "year",
    }),
    // Unlimited canvases
    featureItem({
      feature_id: canvases.id,
      included_usage: 999999,
    }),
    // Unlimited nodes per canvas
    featureItem({
      feature_id: nodesPerCanvas.id,
      included_usage: 999999,
    }),
    // $180 in AI credits for the year (720,000 credits at 4000:1 ratio)
    featureItem({
      feature_id: aiCredits.id,
      included_usage: 720000, // $180 worth (4000 credits = $1)
      interval: "year",
    }),
    // Same overage pricing
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 0.00025,
      billing_units: 1,
    }),
    // Unlimited custom agents
    featureItem({
      feature_id: customAgents.id,
      included_usage: 999999,
    }),
    // 5 team seats included
    featureItem({
      feature_id: teamSeats.id,
      included_usage: 5,
    }),
  ],
});

// Credit top-up (one-time purchase)
export const creditTopUp = product({
  id: "credit_topup",
  name: "Credit Top-Up",
  items: [
    // $10 for 40,000 credits (never expires)
    pricedFeatureItem({
      feature_id: aiCredits.id,
      price: 10,
      billing_units: 40000, // $10 worth (4000 credits = $1)
      usage_model: "prepaid", // One-time purchase, no expiry
    }),
  ],
});

// Additional seat add-on
export const additionalSeat = product({
  id: "additional_seat",
  name: "Additional Seat",
  items: [
    // $5/month per additional seat (after 5)
    priceItem({
      price: 5,
      interval: "month",
    }),
    featureItem({
      feature_id: teamSeats.id,
      included_usage: 1,
    }),
  ],
});

export default {
  features: [canvases, nodesPerCanvas, aiCredits, customAgents, teamSeats],
  products: [free, proMonthly, proAnnual, creditTopUp, additionalSeat],
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

**File: `convex/canvas/functions.ts`**

```typescript
import { mutation } from "../_generated/server";
import { autumn } from "../autumn";
import { v } from "convex/values";

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
    const { data: checkData, error: checkError } = await autumn.check(ctx, {
      featureId: "canvases",
    });

    if (checkError || !checkData?.allowed) {
      throw new Error(
        checkData?.preview?.message ||
        "Canvas limit reached. Upgrade to Pro for unlimited canvases."
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
    // Get current count
    const currentCanvases = await ctx.db
      .query("canvases")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Set absolute count
    await autumn.usage(ctx, {
      featureId: "canvases",
      value: currentCanvases.length,
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

**Important**: The `customer.features` object is a **dictionary/object keyed by feature ID**, not an array.

```typescript
import { useCustomer } from "autumn-js/react";

export function CanvasDashboard() {
  const { customer, check, checkout } = useCustomer();

  // Get canvas feature usage - features is an object, not array!
  const canvasFeature = customer?.features?.canvases; // Direct key access

  const usedCanvases = canvasFeature?.usage || 0;
  const limitCanvases = canvasFeature?.included_usage || 1;

  return (
    <div>
      <p>Canvases: {usedCanvases} / {limitCanvases === 999999 ? "Unlimited" : limitCanvases}</p>

      <button
        onClick={async () => {
          const { data } = await check({
            featureId: "canvases",
          });

          if (!data.allowed) {
            // Show upgrade dialog
            await checkout({
              productId: "pro_monthly",
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

## Implementation: Node Limits (Free Tier Only)

### Backend: Check Node Limit Before Adding Node

**File: `convex/canvas/nodes.ts`**

```typescript
import { mutation } from "../_generated/server";
import { autumn } from "../autumn";
import { v } from "convex/values";

export const addNodeToCanvas = mutation({
  args: {
    canvasId: v.id("canvases"),
    nodeType: v.string(),
    // ... other node args
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const organizationId = identity.organizationId;
    if (!organizationId) throw new Error("No organization selected");

    // ========== CHECK NODE LIMIT (Free tier only) ==========
    const { data: checkData, error: checkError } = await autumn.check(ctx, {
      featureId: "nodes_per_canvas",
    });

    // Get current node count for this canvas
    const currentNodes = await ctx.db
      .query("canvas_nodes")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    const nodeLimit = checkData?.limit || 5;

    if (currentNodes.length >= nodeLimit && nodeLimit < 999999) {
      throw new Error(
        `Node limit reached (${nodeLimit} nodes per canvas on Free tier). Upgrade to Pro for unlimited nodes.`
      );
    }

    // ========== CREATE NODE ==========
    // ... your existing node creation logic

    // ========== TRACK USAGE (Optional - for analytics) ==========
    await autumn.usage(ctx, {
      featureId: "nodes_per_canvas",
      value: currentNodes.length + 1,
    });

    return nodeId;
  },
});
```

### Frontend: Display Node Limit

```typescript
import { useCustomer } from "autumn-js/react";

export function NodeLimitBadge({ canvasId }: { canvasId: string }) {
  const { customer } = useCustomer();
  const nodes = useQuery(api.canvas.nodes.listNodes, { canvasId });

  const nodeFeature = customer?.features?.find(
    (f) => f.feature_id === "nodes_per_canvas"
  );

  const nodeLimit = nodeFeature?.limit || 5;
  const nodeCount = nodes?.length || 0;

  if (nodeLimit >= 999999) return null; // Pro tier, no limit

  return (
    <div className="text-sm text-muted-foreground">
      Nodes: {nodeCount} / {nodeLimit}
      {nodeCount >= nodeLimit && (
        <span className="text-red-500 ml-2">
          Limit reached. <a href="/pricing">Upgrade to Pro</a>
        </span>
      )}
    </div>
  );
}
```

---

## Implementation: AI Credit Metering (1:1 Passthrough)

### Backend: Track AI Usage with Provider Metadata

**File: `convex/canvas/chat.ts`**

```typescript
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { autumn } from "../autumn";

function createCanvasChatAgent(userId: string, organizationId: string) {
  return new Agent(components.agent, {
    name: "Canvas Chat Assistant",
    languageModel: 'xai/grok-4-fast-non-reasoning',
    usageHandler: async (ctx, args) => {
      const {
        threadId,
        model,
        provider,
        usage,
        providerMetadata
      } = args;

      // Get actual cost from provider metadata (in dollars)
      const costInDollars = providerMetadata?.cost || 0;

      // Convert to credits (4000 credits = $1)
      const creditsUsed = Math.ceil(costInDollars * 4000);

      console.log('[Canvas Chat Usage]', {
        userId,
        organizationId,
        threadId,
        model,
        costInDollars,
        creditsUsed,
      });

      // Track in Autumn (deduct from balance)
      await autumn.track(ctx, {
        featureId: "ai_credits",
        value: creditsUsed,
        idempotency_key: `thread_${threadId}_${Date.now()}`, // Prevent double-charging
      });
    },
  });
}
```

### Backend: Check Credits Before Sending Message

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

    // ========== CHECK CREDITS BEFORE SENDING ==========
    const { data: checkData } = await autumn.check(ctx, {
      featureId: "ai_credits",
    });

    if (!checkData?.allowed) {
      throw new Error(
        "Insufficient AI credits. Please upgrade or purchase a credit top-up."
      );
    }

    // ========== SEND MESSAGE ==========
    // ... your existing AI logic
    // Note: Credits are automatically tracked in usageHandler
  },
});
```

### Frontend: Display Credit Usage

```typescript
import { useCustomer } from "autumn-js/react";

export function CreditDisplay() {
  const { customer, checkout } = useCustomer();

  const creditFeature = customer?.features?.find(
    (f) => f.feature_id === "ai_credits"
  );

  const usedCredits = creditFeature?.usage || 0;
  const limitCredits = creditFeature?.limit || 8000;
  const remainingCredits = limitCredits - usedCredits;

  // Convert to dollars for display (4000 credits = $1)
  const remainingDollars = (remainingCredits / 4000).toFixed(2);
  const usedDollars = (usedCredits / 4000).toFixed(2);
  const limitDollars = (limitCredits / 4000).toFixed(2);

  return (
    <div>
      <h3>AI Credits</h3>
      <p className="text-2xl font-bold">
        {remainingCredits.toLocaleString()} credits remaining
      </p>
      <p className="text-sm text-muted-foreground">
        ${remainingDollars} of ${limitDollars} (4,000 credits = $1)
      </p>
      <progress value={usedCredits} max={limitCredits} className="w-full" />

      {remainingCredits < 4000 && (
        <button
          onClick={() => checkout({ productId: "credit_topup" })}
          className="mt-2"
        >
          Buy 40,000 Credits ($10)
        </button>
      )}
    </div>
  );
}
```

### Frontend: Cost Preview Before Sending

```typescript
export function ChatInput() {
  const { customer } = useCustomer();
  const [message, setMessage] = useState("");

  const creditFeature = customer?.features?.find(
    (f) => f.feature_id === "ai_credits"
  );

  const remainingCredits = (creditFeature?.limit || 0) - (creditFeature?.usage || 0);
  const remainingDollars = (remainingCredits / 4000).toFixed(2);

  // Estimate cost based on message length (rough approximation)
  const estimatedTokens = message.length * 0.75; // ~0.75 tokens per char
  const estimatedCostDollars = (estimatedTokens / 1000) * 0.01; // ~$0.01 per 1k tokens
  const estimatedCostCredits = Math.ceil(estimatedCostDollars * 4000);

  return (
    <div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
      />

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          Est. cost: ~{estimatedCostCredits.toLocaleString()} credits (${estimatedCostDollars.toFixed(3)})
        </span>
        <span className="text-sm">
          {remainingCredits.toLocaleString()} credits (${remainingDollars}) remaining
        </span>
      </div>

      <button
        disabled={estimatedCostCredits > remainingCredits}
        onClick={handleSend}
      >
        Send Message
      </button>
    </div>
  );
}
```

---

## Implementation: Custom Agents Gating

### Backend: Check Custom Agent Limit

**File: `convex/agents/mutations.ts`**

```typescript
import { mutation } from "../_generated/server";
import { autumn } from "../autumn";
import { v } from "convex/values";

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

    // ========== CHECK CUSTOM AGENT LIMIT ==========
    const { data: checkData } = await autumn.check(ctx, {
      featureId: "custom_agents",
    });

    if (checkData?.limit === 0) {
      throw new Error(
        "Custom agents are not available on Free tier. Upgrade to Pro to create custom agents."
      );
    }

    // Get current custom agent count
    const currentAgents = await ctx.db
      .query("custom_agents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    if (currentAgents.length >= (checkData?.limit || 0)) {
      throw new Error(
        "Custom agent limit reached. Upgrade to Pro for unlimited custom agents."
      );
    }

    // ========== CREATE CUSTOM AGENT ==========
    const agentId = await ctx.db.insert("custom_agents", {
      organizationId,
      name: args.name,
      systemPrompt: args.systemPrompt,
      model: args.model,
      createdBy: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // ========== TRACK USAGE ==========
    await autumn.usage(ctx, {
      featureId: "custom_agents",
      value: currentAgents.length + 1,
    });

    return agentId;
  },
});
```

### Frontend: Display Custom Agent Limit

```typescript
import { useCustomer } from "autumn-js/react";

export function CustomAgentsList() {
  const { customer, checkout } = useCustomer();
  const agents = useQuery(api.agents.queries.listCustomAgents);

  const agentFeature = customer?.features?.find(
    (f) => f.feature_id === "custom_agents"
  );

  const agentLimit = agentFeature?.limit || 0;
  const agentCount = agents?.length || 0;

  const canCreateAgent = agentLimit > agentCount || agentLimit >= 999999;

  return (
    <div>
      <h2>Custom Agents</h2>

      {agentLimit === 0 && (
        <div className="bg-yellow-100 p-4 rounded mb-4">
          <p>Custom agents are available on Pro tier only.</p>
          <button onClick={() => checkout({ productId: "pro_monthly" })}>
            Upgrade to Pro
          </button>
        </div>
      )}

      {agentLimit > 0 && agentLimit < 999999 && (
        <p className="text-sm text-muted-foreground mb-2">
          {agentCount} / {agentLimit} custom agents
        </p>
      )}

      <button disabled={!canCreateAgent} onClick={handleCreateAgent}>
        Create Custom Agent
      </button>

      {/* List of agents */}
    </div>
  );
}
```

---

## Implementation: Pricing Table

### Frontend: Display Pricing Options

```typescript
import { PricingTable } from "autumn-js/react";

export function PricingPage() {
  return (
    <div>
      <h1>Transparent Pricing</h1>
      <p className="subtitle">
        Unlimited nodes. Pay for AI usage at cost. 4,000 credits = $1.
      </p>

      <PricingTable
        productDetails={[
          {
            id: "free",
            description: "Perfect for trying out AI Whiteboard Chat",
            features: [
              "1 canvas",
              "5 nodes per canvas (all types)",
              "8,000 AI credits/month ($2 value)",
              "Preset agents only",
              "1 team seat",
            ],
          },
          {
            id: "pro_monthly",
            description: "For builders who ship fast. Cancel anytime.",
            recommendText: "Most Popular",
            features: [
              "Unlimited canvases",
              "Unlimited nodes (all types)",
              "60,000 AI credits/month ($15 value)",
              "$1 per 4,000 credits overage (at cost)",
              "Unlimited custom agents",
              "5 team seats (+$5/seat after)",
              "Priority support",
            ],
          },
          {
            id: "pro_annual",
            description: "Same price as Poppy AI, more features.",
            features: [
              "Everything in Pro Monthly",
              "720,000 AI credits/year ($180 value)",
              "2x credits vs monthly",
            ],
          },
        ]}
      />

      <div className="mt-8">
        <h3>Add-Ons</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="border p-4 rounded">
            <h4>Credit Top-Up</h4>
            <p className="text-2xl font-bold">$10</p>
            <p className="text-sm text-muted-foreground">
              40,000 credits. Never expires.
            </p>
          </div>
          <div className="border p-4 rounded">
            <h4>Additional Seat</h4>
            <p className="text-2xl font-bold">$5/mo</p>
            <p className="text-sm text-muted-foreground">
              Add more team members (after 5).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Best Practices

### 1. Organization-Scoped Billing
- **ALWAYS use `organizationId` as `customerId`** in `autumn.ts` `identify` function
- This ensures billing is per-organization, not per-user
- Teams share the same credit pool, canvas limits, and custom agents

### 2. Track Usage Accurately
- **Use `autumn.track()`** for all feature tracking
  - Increments/decrements usage counter (e.g., `value: 1` to increment, `value: -1` to decrement)
  - Works for both consumable and continuous features

### 3. Customer Object Structure
**Important**: The `customer` object from `useCustomer()` has this structure:
```typescript
customer = {
  products: [{ name: "Free" | "Pro", ... }],  // Array of products
  features: {
    canvases: {                               // Object keyed by feature ID (NOT array!)
      usage: 0,
      included_usage: 3,
      unlimited: false,
      balance: 3,
      // ... other fields
    }
  }
}
```
- Access features by key: `customer.features.canvases` (NOT `customer.features.find(...)`)
- Current product: `customer.products[0]` (NOT `customer.product`)

### 3. Check Before Action
- **ALWAYS check feature access** before expensive operations
- Show users helpful error messages with upgrade paths
- Use `dialog` parameter for automatic upgrade prompts

### 4. Idempotency for Critical Operations
```typescript
await autumn.track(ctx, {
  featureId: "ai_credits",
  value: creditsUsed,
  idempotency_key: `thread_${threadId}_${timestamp}`, // Prevents double-charging
});
```

### 5. Transparent Pricing
- Show users cost BEFORE they take action
- Display credits prominently with dollar conversion visible
- Provide usage analytics dashboard
- Show conversion rate: "4,000 credits = $1"
- Lead with credit count (feels more generous), show dollar value as context

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

- [ ] Canvas creation respects limits (1 on Free, unlimited on Pro)
- [ ] Canvas deletion updates count correctly
- [ ] Node creation respects limits (5 per canvas on Free, unlimited on Pro)
- [ ] AI credit tracking uses 4000:1 ratio from providerMetadata.cost
- [ ] Credits display with both credit count and dollar conversion (4000 = $1)
- [ ] Multiple users in same org share credit pool
- [ ] Custom agent creation blocked on Free tier (0 limit)
- [ ] Custom agent creation works on Pro tier (unlimited)
- [ ] Upgrade flow works (Free → Pro Monthly/Annual)
- [ ] Credit top-up purchases work (40,000 credits for $10, never expire)
- [ ] Additional seat purchases work ($5/month per seat after 5)
- [ ] Usage dashboard shows accurate data
- [ ] Paywall dialogs appear when limits reached
- [ ] Idempotency prevents double-charging
- [ ] Cost preview shows accurate estimates in credits + dollars

---

## Migration Steps

### Phase 1: Setup (Week 1)
1. Install packages
2. Configure Convex component
3. Setup Autumn client (`convex/autumn.ts`)
4. Setup frontend provider
5. Define pricing config (`autumn.config.ts`)
6. Push to Autumn platform

### Phase 2: Feature Gating (Week 2)
1. Add canvas limit checks to `createCanvas`
2. Add node limit checks to `addNodeToCanvas`
3. Add custom agent limit checks to `createCustomAgent`
4. Update counts on delete operations
5. Test with multiple orgs

### Phase 3: Credit Metering (Week 3)
1. Add credit tracking to Agent usageHandler (1:1 passthrough)
2. Add credit display to UI (show in dollars)
3. Add cost preview before sending messages
4. Test with different models and context sizes

### Phase 4: Pricing & Upgrades (Week 4)
1. Add pricing table page
2. Add upgrade flows with dialogs
3. Add usage analytics dashboard
4. Add credit top-up purchase flow
5. Add additional seat purchase flow

---

## Troubleshooting

### Issue: "No organization selected" error
**Solution:** Ensure `organizationId` exists in `identify` function:
```typescript
if (!organizationId || typeof organizationId !== "string") {
  return null; // Don't throw, return null
}
```

### Issue: Credits not deducting correctly
**Solution:** Ensure you're using `providerMetadata.cost` from AI SDK with correct ratio:
```typescript
const costInDollars = providerMetadata?.cost || 0;
const creditsUsed = Math.ceil(costInDollars * 4000); // 4000:1 ratio
```

### Issue: Node limit not enforced
**Solution:** Check current node count BEFORE creating:
```typescript
const currentNodes = await ctx.db
  .query("canvas_nodes")
  .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
  .collect();

if (currentNodes.length >= nodeLimit && nodeLimit < 999999) {
  throw new Error("Node limit reached");
}
```

### Issue: Canvas count wrong after operations
**Solution:** Use `autumn.usage()` to SET absolute value, not increment:
```typescript
const currentCount = await db.query("canvases").collect();
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
2. **Transparent credit system** - 4,000 credits = $1 (generous-sounding, still transparent)
3. **Feature gating** - Canvas, node, and custom agent limits
4. **Real-time tracking** - Convex integration for instant updates
5. **Profitable margins** - $15/month base profit on Pro tier
6. **Upgrade flows** - Built-in dialogs and checkout

### Pricing Summary:
- **Free:** 1 canvas, 5 nodes, 8,000 credits/month ($2), preset agents only
- **Pro Monthly ($30):** Unlimited everything, 60,000 credits/month ($15), $15 profit margin
- **Pro Annual ($300):** Same as Poppy price, 720,000 credits/year ($180), $120 profit margin
- **Overages:** At-cost passthrough ($1 per 4,000 credits)

### Competitive Advantages:
- **vs. Poppy AI ($300/year):** More customizable, transparent, monthly option, free tier
- **Unlimited nodes** - All types included (YouTube, TikTok, Facebook, etc.)
- **At-cost AI pricing** - No hidden markups on overage
- **Healthy margins** - 50% profit on base subscription
- **Free tier** - Try before you buy (1 canvas, 5 nodes, 8,000 credits/month)

### Implementation Order:
1. **Week 1:** Canvas limits (simplest)
2. **Week 2:** Node limits + Custom agent gating
3. **Week 3:** AI credit metering (4000:1 ratio)
4. **Week 4:** Pricing table + upgrade flows
