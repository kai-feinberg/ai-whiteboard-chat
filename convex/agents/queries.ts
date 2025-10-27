// convex/agents/queries.ts
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Query playground thread (internal query helper)
 */
export const queryPlaygroundThread = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("threads")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("title"), "Playground"))
      .first();

    if (existing) {
      return { agentThreadId: existing.userId }; // We'll store agentThreadId in userId field temporarily
    }
    return null;
  },
});
