# Top-Up Credits System - Implementation Plan

## Overview
Add non-expiring top-up credits purchasable by Pro users. Monthly credits consumed first, then top-up credits. Top-ups never reset.

**Key Requirements**:
- 3200 credits per $1 USD
- Flexible amount input with presets ($10, $50, $100)
- Only Pro users can purchase
- Monthly credits consumed before top-up credits
- Separate display for monthly vs top-up balances
- "Buy More Credits" button shows only when monthly credits depleted

---

## 1. Database Design

**New Tables**: None (use Autumn's feature tracking)

**Autumn Config Changes**:
- Add `topUpCredits` feature (type: `single_use`, no interval)
- Keep existing `aiCredits` feature (monthly/yearly reset)

**Key Queries**:

- `getCurrentCredits()` - Get both monthly + top-up balances
  - Input: organizationId (from auth)
  - Output: `{ monthlyBalance: number, topUpBalance: number, monthlyIncluded: number }`
  - Purpose: Display both credit pools in UI

- `deductCredits(amount)` - Custom deduction logic
  - Input: amount to deduct, organizationId
  - Output: `{ deductedFromMonthly: number, deductedFromTopUp: number }`
  - Purpose: Deduct from monthly first, then top-up

---

## 2. Data Flow

**High-level Flow**:
1. User sends AI message → Pre-flight check both credit pools
2. AI processes → usageHandler receives USD cost from gateway
3. Custom deduction logic → Check monthly balance, deduct from monthly if available
4. Overflow to top-up → If monthly exhausted, deduct remainder from top-up
5. UI updates → Real-time display via useCustomer() shows both pools

**Key Transformations**:
- Gateway cost → Credits (USD * 3200 for top-up pricing display)
- Deduction priority: `monthlyBalance > 0 ? deductMonthly : deductTopUp`
- Two separate `autumn.track()` calls (one per feature ID)

---

## 3. User Flows

**Pro User Flow**:
- View credit balance: Monthly (60k/60k) + Top-up (50k)
- Send AI messages → Monthly credits decrease first
- Monthly hits 0 → "Buy More Credits" button appears
- Click "Buy More" → Pricing page with credit purchase section
- Select preset ($10/$50/$100) or enter custom amount
- Checkout → Autumn processes payment
- Top-up balance increases immediately
- Continue using AI → Now deducting from top-up pool

**Free User Flow**:
- View credit balance: Monthly (8k/8k) only
- No top-up purchase option shown
- Monthly hits 0 → Upgrade to Pro prompt (no top-up option)

---

## 4. UI Components

**CreditBalance Component** (Updated)
- Purpose: Display monthly + top-up credits separately with visual indicators
- Key interactions:
  - Progress bar for monthly credits
  - Secondary display for top-up balance
  - "Buy More Credits" button (conditional: monthly === 0 && isPro)
- Data requirements: `customer.features.ai_credits` + `customer.features.topup_credits`, `customer.products`

**CreditPurchaseSection Component** (New - in pricing page)
- Purpose: Allow Pro users to purchase top-up credits
- Key interactions:
  - Preset buttons: $10 (32k credits), $50 (160k credits), $100 (320k credits)
  - Custom amount input (validates min $5, max $500)
  - Shows credit calculation in real-time
  - Checkout button triggers Autumn payment
- Data requirements: Current product tier, custom amount state

**CheckoutDialog Enhancement**
- Purpose: Handle top-up credit purchase confirmations
- Key interactions: Shows "Purchase X credits for $Y" messaging
- Data requirements: Credit amount, USD cost

**PricingPage Enhancement**
- Purpose: Add credit purchase section below tier cards
- Key interactions: Show/hide based on Pro status, link from "Buy More" button
- Data requirements: Current tier, top-up feature access

---

## 5. API Routes

N/A - All via Convex actions/queries

---

## 6. Patterns to Reuse

**Custom Agent Creation Pattern** (`convex/agents/functions.ts:256-306`)
- Action wrapper → Check Pro tier via `autumn.check({ featureId: "custom_agents" })`
- Internal mutation → Actual DB operations
- **Apply to**: Top-up purchase validation (check Pro tier before allowing purchase)

**Credit Tracking Pattern** (`convex/canvas/chat.ts:22-62`)
- usageHandler receives gateway cost → Convert to credits → Track via `autumn.track()`
- **Apply to**: Custom deduction logic (call track for both monthly + top-up)

**Customer Hook Pattern** (`src/features/credits/components/CreditBalance.tsx:1-72`)
- `useCustomer()` → Access `customer.features.ai_credits`
- **Apply to**: Add `customer.features.topup_credits` alongside monthly credits

**Checkout Pattern** (`src/routes/pricing.tsx:19-24`)
- `checkout({ productId, dialog })` → Triggers Autumn payment flow
- **Apply to**: Top-up credit purchase with dynamic product ID or amount

---

## 7. Implementation Steps

### Backend

**Step 1: Autumn Config** (`autumn.config.ts`)
- Add `topUpCredits` feature:
  ```typescript
  export const topUpCredits = feature({
    id: "topup_credits",
    name: "Top-Up Credits",
    type: "single_use", // No interval = never resets
  });
  ```
- Export in default config alongside `aiCredits`
- Push config: `npx atmn push`

**Step 2: Custom Deduction Logic** (`convex/ai/credits.ts` - NEW)
- `deductCreditsWithPriority(ctx, amount, organizationId)`
  - Query Autumn for monthly balance (`ai_credits`)
  - Query Autumn for top-up balance (`topup_credits`)
  - If monthly >= amount: `autumn.track({ featureId: "ai_credits", value: amount })`
  - Else: Deduct monthly fully, then `autumn.track({ featureId: "topup_credits", value: remainder })`
  - Return breakdown for logging

**Step 3: Update usageHandler** (`convex/canvas/chat.ts:22-62`, `convex/chat/functions.ts`)
- Replace single `autumn.track()` call
- Call `deductCreditsWithPriority()` instead
- Log which pool was deducted from

**Step 4: Top-Up Purchase Action** (`convex/credits/functions.ts` - NEW)
- `purchaseTopUpCredits(amount: number)` - Action
  - Auth check + organizationId
  - Verify Pro tier: `autumn.check({ featureId: "custom_agents" })` (reuse Pro check pattern)
  - Validate amount (min $5, max $500)
  - Calculate credits: `amount * 3200`
  - Return checkout data for frontend
- Backend validation only - Autumn handles actual payment

**Step 5: Pre-flight Check Enhancement** (`convex/canvas/chat.ts:99-107`)
- Check combined balance (monthly + top-up) >= estimated cost
- Update error message to show both balances

### Frontend

**Step 6: Update CreditBalance** (`src/features/credits/components/CreditBalance.tsx`)
- Fetch both features: `customer.features.ai_credits` + `customer.features.topup_credits`
- Display monthly credits with progress bar (existing)
- Add top-up credits display below (static number, no progress bar)
- "Buy More Credits" button: Show if `monthlyBalance === 0 && isPro`
- Link to `/pricing#credits` on click

**Step 7: Credit Purchase Section** (`src/features/credits/components/CreditPurchaseSection.tsx` - NEW)
- Preset buttons: $10, $50, $100
- Custom input field (number, min 5, max 500)
- Live credit calculation: `{amount * 3200} credits for ${amount}`
- Purchase button → Call Convex action for validation, then trigger checkout
- Pro-only check: Show "Upgrade to Pro" if not Pro tier

**Step 8: Pricing Page Integration** (`src/routes/pricing.tsx`)
- Add anchor: `<div id="credits">` below tier cards
- Conditionally render `<CreditPurchaseSection />` if Pro
- Show placeholder if Free tier: "Upgrade to Pro to purchase credits"

**Step 9: Checkout Dialog Content** (`src/lib/autumn/checkout-content.tsx`)
- Add case for top-up credits
- Message: "Purchase {X} credits for ${Y}. Credits never expire."

**Step 10: Error Handling** (Chat components)
- Update credit error messages to show both balances
- "Insufficient credits. Monthly: 0, Top-up: 50. Purchase more?"

---

## 8. Technical Details

### Credit Deduction Algorithm

```typescript
// convex/ai/credits.ts
export async function deductCreditsWithPriority(
  ctx: ActionCtx,
  amount: number,
  organizationId: string
) {
  // Get current balances from Autumn
  const monthlyData = await autumn.usage(ctx, { featureId: "ai_credits" });
  const topUpData = await autumn.usage(ctx, { featureId: "topup_credits" });

  const monthlyBalance = monthlyData?.balance || 0;
  const topUpBalance = topUpData?.balance || 0;

  let deductedMonthly = 0;
  let deductedTopUp = 0;

  // Deduct from monthly first
  if (monthlyBalance >= amount) {
    await autumn.track(ctx, { featureId: "ai_credits", value: amount });
    deductedMonthly = amount;
  } else if (monthlyBalance > 0) {
    // Partial monthly deduction
    await autumn.track(ctx, { featureId: "ai_credits", value: monthlyBalance });
    deductedMonthly = monthlyBalance;

    const remainder = amount - monthlyBalance;
    await autumn.track(ctx, { featureId: "topup_credits", value: remainder });
    deductedTopUp = remainder;
  } else {
    // All from top-up
    await autumn.track(ctx, { featureId: "topup_credits", value: amount });
    deductedTopUp = amount;
  }

  return { deductedMonthly, deductedTopUp };
}
```

### Top-Up Purchase Flow

```typescript
// Frontend: CreditPurchaseSection.tsx
const handlePurchase = async (amount: number) => {
  // Validate Pro tier + amount on backend
  const validation = await validateTopUpPurchase({ amount });

  if (!validation.allowed) {
    toast.error(validation.error);
    return;
  }

  // Trigger Autumn checkout (Autumn handles payment + credit addition)
  await checkout({
    productId: "topup_credits", // Or dynamic product with amount
    quantity: amount, // Custom amount
    dialog: CheckoutDialog,
  });
};

// Backend: convex/credits/functions.ts
export const validateTopUpPurchase = action({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const organizationId = identity.organizationId;

    // Check Pro tier
    const { data, error } = await autumn.check(ctx, {
      featureId: "custom_agents", // Pro-only feature
    });

    if (error || !data?.allowed) {
      return { allowed: false, error: "Top-up credits are only available for Pro users." };
    }

    // Validate amount
    if (args.amount < 5 || args.amount > 500) {
      return { allowed: false, error: "Amount must be between $5 and $500." };
    }

    return { allowed: true, credits: args.amount * 3200 };
  },
});
```

### Pre-flight Check Enhancement

```typescript
// convex/canvas/chat.ts - sendMessage action
const estimatedCost = estimateCost(args.message);

// Check BOTH balances
const monthlyData = await autumn.usage(ctx, { featureId: "ai_credits" });
const topUpData = await autumn.usage(ctx, { featureId: "topup_credits" });

const monthlyBalance = monthlyData?.balance || 0;
const topUpBalance = topUpData?.balance || 0;
const totalBalance = monthlyBalance + topUpBalance;

if (totalBalance < estimatedCost) {
  throw new Error(
    `Insufficient credits. You have ${monthlyBalance} monthly + ${topUpBalance} top-up credits. ` +
    `This message requires ~${estimatedCost} credits. Purchase more to continue.`
  );
}
```

---

## 9. UI Mockup (Text Description)

**CreditBalance Widget**:
```
┌─────────────────────────────┐
│ ⚡ AI Credits         [Pro] │
├─────────────────────────────┤
│ Monthly Credits             │
│ 15,000 / 60,000             │
│ ████████░░░░░░░░ 25%        │
│                             │
│ Top-Up Credits              │
│ 50,000 (never expires)      │
│                             │
│ [Buy More Credits]          │ ← Only shows when monthly = 0
└─────────────────────────────┘
```

**Pricing Page - Credit Purchase Section**:
```
┌────────────────────────────────────────────┐
│         Purchase Additional Credits         │
│  (Available for Pro users only)            │
├────────────────────────────────────────────┤
│  Select Amount:                            │
│  [$10]  [$50]  [$100]  [Custom: $___ ]     │
│                                            │
│  You'll get: 32,000 credits                │
│  Rate: 3,200 credits per $1                │
│                                            │
│  [Purchase Credits]                        │
└────────────────────────────────────────────┘
```

---

## 10. Testing Checklist

- [ ] Pro user can purchase top-up credits
- [ ] Free user cannot purchase top-up (shows upgrade prompt)
- [ ] Monthly credits deducted before top-up credits
- [ ] Top-up credits never reset on billing cycle
- [ ] Monthly credits reset on billing cycle
- [ ] Both balances display correctly in UI
- [ ] "Buy More" button only shows when monthly = 0 and user is Pro
- [ ] Pre-flight check accounts for both credit pools
- [ ] Custom amount validation (min $5, max $500)
- [ ] Preset buttons work ($10, $50, $100)
- [ ] Checkout flow completes successfully
- [ ] Credits added immediately after purchase
- [ ] Error messages show both balance types
- [ ] Org-scoped: Team members share both credit pools
- [ ] Deduction logging shows which pool was used

---

## 11. Gotchas & Considerations

**GOTCHA #1: Two Feature IDs**
- Must track two separate features: `ai_credits` (monthly) + `topup_credits` (permanent)
- Cannot combine into single feature - different reset intervals
- Use custom deduction logic, not Autumn's built-in priority

**GOTCHA #2: Top-Up Pricing Different**
- Monthly credits: 4000 credits = $1 (included in tier)
- Top-up credits: 3200 credits = $1 (purchased separately)
- Users paying for convenience + no-expiry

**GOTCHA #3: Autumn.usage() vs Customer Object**
- Backend: Use `autumn.usage()` to get current balances in actions
- Frontend: Use `customer.features.ai_credits` / `customer.features.topup_credits` from `useCustomer()`

**GOTCHA #4: Pre-flight Check Must Check Both**
- Don't just check `autumn.check({ featureId: "ai_credits" })`
- Must manually query both balances and sum them

**GOTCHA #5: Checkout for Variable Amounts**
- Autumn may require multiple product IDs for different amounts
- OR single product with `quantity` parameter
- Test which pattern Autumn supports for one-time purchases

**GOTCHA #6: UI Sync**
- useCustomer() provides real-time updates
- But custom deduction logic may cause brief desync
- Ensure both features update atomically or handle race conditions

---

## 12. File Checklist

**Backend (New)**:
- `convex/ai/credits.ts` - Custom deduction logic

**Backend (Updates)**:
- `autumn.config.ts` - Add topUpCredits feature
- `convex/canvas/chat.ts` - Use custom deduction in usageHandler
- `convex/chat/functions.ts` - Use custom deduction in usageHandler
- `convex/credits/functions.ts` - Purchase validation action

**Frontend (New)**:
- `src/features/credits/components/CreditPurchaseSection.tsx` - Purchase UI

**Frontend (Updates)**:
- `src/features/credits/components/CreditBalance.tsx` - Dual credit display
- `src/routes/pricing.tsx` - Add credit purchase section
- `src/lib/autumn/checkout-content.tsx` - Top-up checkout messaging

---

## 13. Deployment Steps

1. Update `autumn.config.ts` - Add topUpCredits feature
2. Push Autumn config: `npx atmn push`
3. Create `convex/ai/credits.ts` - Custom deduction logic
4. Update usageHandlers in chat files
5. Create credit purchase validation action
6. Build frontend components (CreditPurchaseSection, update CreditBalance)
7. Update pricing page with credit section
8. Test locally (both credit types, deduction priority, Pro check)
9. Deploy backend: Convex auto-deploy
10. Deploy frontend: Standard build process
11. Verify in production with test purchases

---

## 14. Open Questions - RESOLVED ✅

**1. Autumn Variable Amounts**: ✅ **RESOLVED**
- Autumn supports dynamic quantities via `options` parameter in `checkout()`
- Single product definition with `pricedFeatureItem` using `usage_model: "prepaid"`
- Pass quantity in options: `checkout({ productId: "topup_credits", options: [{ feature_id: "topup_credits", quantity: 160000 }] })`
- Autumn calculates total: `quantity * (price / billing_units)`

**2. Checkout Flow**: ✅ **RESOLVED**
- Use `options` array parameter (not metadata)
- Frontend: `checkout({ productId: "topup_credits", options: [{ feature_id: "topup_credits", quantity: amount * 3200 }] })`
- Stripe checkout displays calculated total automatically

**3. Balance Query Performance**: ⚠️ **TO MONITOR**
- `autumn.usage()` makes API call per feature
- Consider caching if performance becomes issue
- Real-time accuracy more important than caching for MVP

**4. Deduction Atomicity**: ⚠️ **TO HANDLE**
- Wrap both `autumn.track()` calls in try-catch
- Log failed deductions for manual reconciliation
- Autumn doesn't provide transactions - handle at app level

**5. UI Real-time Updates**: ✅ **RESOLVED**
- `useCustomer()` uses real-time Convex subscriptions
- Updates reflect immediately after Autumn processes webhook
- Typical delay: < 1 second

---

## 15. Recommended Autumn Config

Based on Autumn docs, here's the optimal config structure:

```typescript
// Feature definition (no interval = never resets)
export const topUpCredits = feature({
  id: "topup_credits",
  name: "Top-Up Credits",
  type: "single_use",
});

// Product definition with dynamic pricing
export const topUpProduct = product({
  id: "topup_credits",
  name: "Credit Top-Up",
  items: [
    pricedFeatureItem({
      feature_id: topUpCredits.id,
      price: 1, // $1 USD
      billing_units: 3200, // per 3200 credits
      usage_model: "prepaid", // One-time purchase
    }),
  ],
});
```

**Usage**:
```typescript
// Purchase 160,000 credits for $50
await checkout({
  productId: "topup_credits",
  options: [
    { feature_id: "topup_credits", quantity: 160000 }
  ]
});
// Autumn calculates: (160000 / 3200) * $1 = $50
```

---

## 16. Success Metrics

- Pro users can purchase top-up credits without friction
- Monthly credits always consumed first (validate via logs)
- Top-up balance persists across billing cycles
- Clear UI showing both credit types
- No user confusion about which pool is being used
- Zero failed deductions due to race conditions
