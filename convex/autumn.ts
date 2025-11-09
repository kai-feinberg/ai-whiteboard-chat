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
