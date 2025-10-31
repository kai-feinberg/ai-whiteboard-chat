import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // AI Chat Threads - Conversation threads for AI chat feature
  threads: defineTable({
    agentThreadId: v.string(), // Agent component thread ID
    userId: v.string(), // Auth identity subject (creator)
    organizationId: v.string(), // Clerk organization ID for multi-tenancy
    title: v.optional(v.string()), // Thread title/name
    createdAt: v.number(), // Timestamp when thread was created
    updatedAt: v.number(), // Timestamp when thread was last updated
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_org_updated", ["organizationId", "updatedAt"]),
});
