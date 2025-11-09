# Autumn Payment System - Flow, Types & Gotchas

## Overview

AI Whiteboard Chat uses [Autumn](https://useautumn.com) for pricing, billing, and feature gating. Autumn integrates with Stripe and Convex to provide org-scoped subscription management.

---

## Architecture

### High-Level Flow

```
┌─────────────┐
│   Frontend  │  useCustomer() hook
│             │  ↓ gets customer data
│             │  ↓ checks limits
│             │  ↓ calls actions
└─────────────┘
       ↓
┌─────────────┐
│   Actions   │  createCanvas, deleteCanvas
│   (HTTP OK) │  ↓ autumn.check() - verify limit
│             │  ↓ autumn.track() - update usage
│             │  ↓ ctx.runMutation() - DB ops
└─────────────┘
       ↓
┌─────────────┐
│  Internal   │  createCanvasMutation
│  Mutations  │  ↓ DB operations only
│  (No HTTP)  │  ↓ transactional safety
└─────────────┘
```

### Why Actions + Internal Mutations?

**Problem**: Autumn API uses `fetch()`, which **isn't allowed in Convex mutations**.

**Solution**:
- **Actions**: Handle HTTP calls (Autumn API)
- **Internal Mutations**: Handle database operations
- **Separation**: Clean, secure, follows Convex best practices

---

## Customer Object Structure

### ⚠️ GOTCHA #1: Features is an Object, NOT an Array!

```typescript
// ❌ WRONG - This will crash!
const canvasFeature = customer?.features?.find(f => f.feature_id === "canvases");

// ✅ CORRECT - Direct key access
const canvasFeature = customer?.features?.canvases;
```

### Full Customer Object Type

```typescript
interface Customer {
  id: string;                    // Organization ID
  email: string;
  name: string | null;
  env: "sandbox" | "production";
  created_at: number;            // Timestamp

  // Products is an ARRAY
  products: Array<{
    id: string;                  // "free" or "pro"
    name: string;                // "Free" or "Pro"
    // ... other product fields
  }>;

  // Features is an OBJECT keyed by feature ID
  features: {
    [featureId: string]: {
      id: string;                // Feature ID (e.g., "canvases")
      name: string;              // Display name
      type: "continuous_use" | "single_use";

      // Usage tracking
      usage: number;             // Current usage count
      balance: number;           // Remaining balance
      included_usage: number;    // Limit from plan
      unlimited: boolean;        // True if no limit

      // Billing
      interval: "lifetime" | "month" | "year";
      interval_count: number;
      next_reset_at: number | null;
      overage_allowed: boolean;
    };
  };
}
```

### ⚠️ GOTCHA #2: Product is at products[0], NOT customer.product

```typescript
// ❌ WRONG
const productName = customer?.product?.name;

// ✅ CORRECT
const currentProduct = customer?.products?.[0];
const productName = currentProduct?.name || "Free";
```

---

## Frontend Usage

### 1. Get Customer Data

```typescript
import { useCustomer } from "autumn-js/react";

function Dashboard() {
  const { customer, check, checkout } = useCustomer();

  // Get current plan
  const currentProduct = customer?.products?.[0];
  const isPro = currentProduct?.name === "Pro";

  // Get canvas feature (features is OBJECT, not array!)
  const canvasFeature = customer?.features?.canvases;
  const usedCanvases = canvasFeature?.usage || 0;
  const limitCanvases = canvasFeature?.included_usage || 3;
  const isUnlimited = canvasFeature?.unlimited || false;
}
```

### 2. Check Limits (Proactive UX)

```typescript
const handleCreateCanvas = async () => {
  // Optional: Check limit on frontend for better UX
  if (usedCanvases >= limitCanvases && !isUnlimited) {
    // Show upgrade dialog
    const result = await checkout({
      productId: "pro",
      dialog: CheckoutDialog,
    });

    if (!result) return; // User cancelled
  }

  // Backend enforces limit securely
  const result = await createCanvas({});
};
```

### 3. Handle Errors with Upgrade CTA

```typescript
try {
  await createCanvas({});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Failed";

  // Show upgrade option if it's a limit error
  if (errorMessage.includes("limit reached")) {
    toast.error(errorMessage, {
      action: {
        label: "Upgrade",
        onClick: () => checkout({ productId: "pro", dialog: CheckoutDialog }),
      },
    });
  } else {
    toast.error(errorMessage);
  }
}
```

---

## Backend Implementation

### 1. Action Pattern (Autumn API Calls)

```typescript
import { action, internalMutation } from "../_generated/server";
import { autumn } from "../autumn";
import { internal } from "../_generated/api";

export const createCanvas = action({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ canvasId: Id<"canvases">; title: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const organizationId = identity.organizationId;
    if (!organizationId) throw new Error("No organization selected");

    // ========== CHECK LIMIT (Backend enforcement) ==========
    const { data, error } = await autumn.check(ctx, {
      featureId: "canvases",
    });

    if (error || !data?.allowed) {
      throw new Error("Canvas limit reached. Upgrade to Pro.");
    }

    // ========== CREATE CANVAS (via internal mutation) ==========
    const canvasId: Id<"canvases"> = await ctx.runMutation(
      internal.canvas.functions.createCanvasMutation,
      { organizationId, title: args.title || "New Canvas", ... }
    );

    // ========== TRACK USAGE ==========
    await autumn.track(ctx, {
      featureId: "canvases",
      value: 1, // Increment by 1
    });

    return { canvasId, title };
  },
});
```

### 2. Internal Mutation Pattern (Database Only)

```typescript
export const createCanvasMutation = internalMutation({
  args: {
    organizationId: v.string(),
    title: v.string(),
    // ... other args
  },
  handler: async (ctx, args) => {
    // Database operations only - NO HTTP calls
    const canvasId = await ctx.db.insert("canvases", {
      organizationId: args.organizationId,
      title: args.title,
      createdAt: Date.now(),
      // ...
    });

    return canvasId;
  },
});
```

### ⚠️ GOTCHA #3: Add Explicit Type Annotations

TypeScript can't infer types when calling internal mutations from the same file. Add explicit types:

```typescript
// ✅ CORRECT - Explicit type annotation
const canvasId: Id<"canvases"> = await ctx.runMutation(
  internal.canvas.functions.createCanvasMutation,
  { ... }
);

// ✅ CORRECT - Explicit return type
handler: async (ctx, args): Promise<{ canvasId: Id<"canvases"> }> => {
  // ...
}
```

---

## Autumn API Reference

### Backend Methods

#### `autumn.check(ctx, { featureId })`
**Purpose**: Check if user can perform action
**Where**: Actions only (uses HTTP)
**Returns**: `{ data: { allowed: boolean }, error?: Error }`

```typescript
const { data, error } = await autumn.check(ctx, {
  featureId: "canvases",
});

if (error || !data?.allowed) {
  throw new Error("Limit reached");
}
```

#### `autumn.track(ctx, { featureId, value })`
**Purpose**: Update usage counter
**Where**: Actions only (uses HTTP)
**Behavior**: Increments/decrements by `value`

```typescript
// Increment on creation
await autumn.track(ctx, {
  featureId: "canvases",
  value: 1, // Add 1
});

// Decrement on deletion
await autumn.track(ctx, {
  featureId: "canvases",
  value: -1, // Subtract 1
});
```

### ⚠️ GOTCHA #4: track() Increments, NOT Sets Absolute Value

```typescript
// ❌ WRONG - Don't calculate total count
const totalCanvases = await ctx.db.query("canvases").collect();
await autumn.track(ctx, { featureId: "canvases", value: totalCanvases.length });

// ✅ CORRECT - Increment/decrement by delta
await autumn.track(ctx, { featureId: "canvases", value: 1 });  // +1
await autumn.track(ctx, { featureId: "canvases", value: -1 }); // -1
```

### Frontend Methods

#### `useCustomer()`
**Purpose**: Get customer data and Autumn methods
**Returns**: `{ customer, check, checkout, track }`

```typescript
const { customer, checkout } = useCustomer();

// Trigger upgrade
await checkout({
  productId: "pro",
  dialog: CheckoutDialog,
});
```

---

## Configuration

### Pricing Config (autumn.config.ts)

```typescript
import { feature, product, featureItem, priceItem } from "atmn";

// Define feature
export const canvases = feature({
  id: "canvases",
  name: "Canvases",
  type: "continuous_use", // Always active (like seats)
});

// Free tier
export const free = product({
  id: "free",
  name: "Free",
  items: [
    featureItem({
      feature_id: canvases.id,
      included_usage: 3, // Limit: 3 canvases
    }),
  ],
});

// Pro tier
export const pro = product({
  id: "pro",
  name: "Pro",
  items: [
    priceItem({
      price: 30,
      interval: "month",
    }),
    featureItem({
      feature_id: canvases.id,
      included_usage: 999999, // Effectively unlimited
    }),
  ],
});

export default {
  features: [canvases],
  products: [free, pro],
};
```

### Push Config to Autumn

```bash
# First time setup
npx atmn init

# Push config
npx atmn push

# Pull config
npx atmn pull
```

---

## Organization-Scoped Billing

### ⚠️ GOTCHA #5: ALWAYS Use organizationId as customerId

```typescript
// convex/autumn.ts
export const autumn = new Autumn(components.autumn, {
  secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
  identify: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      return null;
    }

    // ✅ CRITICAL: Use organizationId, NOT userId
    return {
      customerId: organizationId, // Org-scoped billing
      customerData: {
        name: identity.organizationName as string,
        email: identity.email as string,
      },
    };
  },
});
```

**Why**: Teams share the same credit pool, canvas limits, and subscription.

---

## Error Handling

### ⚠️ GOTCHA #6: Don't Assume All Errors = Limit Reached

```typescript
// ❌ BAD - Assumes all errors are limit errors
try {
  await createCanvas({});
} catch (error) {
  throw new Error("Canvas limit reached"); // Could be auth error, network error, etc!
}

// ✅ GOOD - Check actual error message
try {
  await createCanvas({});
} catch (error) {
  const message = error instanceof Error ? error.message : "Failed";

  if (message.includes("limit reached")) {
    // Handle limit error
  } else if (message.includes("Not authenticated")) {
    // Handle auth error
  } else {
    // Handle other errors
  }
}
```

---

## Testing Checklist

- [ ] **Free tier**: Can create 3 canvases
- [ ] **Free tier**: 4th canvas shows "limit reached" error
- [ ] **Free tier**: Upgrade dialog appears
- [ ] **Pro tier**: Can create unlimited canvases
- [ ] **Usage tracking**: Sidebar shows correct count (X / Y)
- [ ] **Usage tracking**: Count decrements on canvas deletion
- [ ] **Multi-user**: Teams share canvas pool (org-scoped)
- [ ] **Error handling**: Shows correct error messages
- [ ] **Frontend UX**: Proactive upgrade warning before limit
- [ ] **Backend security**: Limits enforced server-side

---

## Common Pitfalls

### 1. ❌ Using fetch() in Mutations
**Error**: `Can't use fetch() in queries and mutations`
**Fix**: Use actions instead

### 2. ❌ Treating features as Array
**Error**: `customer?.features?.find is not a function`
**Fix**: Direct key access: `customer?.features?.canvases`

### 3. ❌ Wrong product access
**Error**: `undefined`
**Fix**: `customer?.products?.[0]` not `customer?.product`

### 4. ❌ Absolute value tracking
**Error**: Usage counts get out of sync
**Fix**: Use `track(value: 1)` to increment, `track(value: -1)` to decrement

### 5. ❌ User-scoped billing
**Error**: Each user gets separate limits
**Fix**: Use `organizationId` as `customerId`

### 6. ❌ Cyclic type errors
**Error**: `implicitly has type 'any'`
**Fix**: Add explicit type annotations

---

## File Reference

### Backend
- [convex/autumn.ts](../convex/autumn.ts) - Autumn client configuration
- [convex/canvas/functions.ts](../convex/canvas/functions.ts) - Actions + mutations
- [autumn.config.ts](../autumn.config.ts) - Pricing configuration

### Frontend
- [src/routes/__root.tsx](../src/routes/__root.tsx) - AutumnProvider setup
- [src/components/app-sidebar.tsx](../src/components/app-sidebar.tsx) - Tier badge
- [src/routes/index.tsx](../src/routes/index.tsx) - Dashboard with usage
- [src/routes/pricing.tsx](../src/routes/pricing.tsx) - Pricing table

---

## Resources

- [Autumn Docs](https://docs.useautumn.com)
- [Autumn Convex Setup](https://docs.useautumn.com/setup/convex)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [Implementation Guide](./AUTUMN_PRICING_IMPLEMENTATION_GUIDE.md)
