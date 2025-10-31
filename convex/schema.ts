import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // AI Chat Threads - Conversation threads for AI chat feature
  threads: defineTable({
    userId: v.string(), // Auth identity subject (owner)
    organizationId: v.string(), // Clerk organization ID for multi-tenancy
    title: v.optional(v.string()), // Thread title/name
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),
});
