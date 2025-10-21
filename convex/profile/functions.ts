import { query } from "../_generated/server";

// Get current user profile information
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
      return {
        viewer: null,
        email: null,
      };
    }

    return {
      viewer: identity.name ?? identity.email ?? null,
      email: identity.email ?? null,
    };
  },
});
