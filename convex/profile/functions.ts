import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get current user profile information
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return {
        viewer: null,
        email: null,
      };
    }

    const user = await ctx.db.get(userId);

    return {
      viewer: user?.name ?? null,
      email: user?.email ?? null,
    };
  },
});
