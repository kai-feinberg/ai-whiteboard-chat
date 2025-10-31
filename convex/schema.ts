import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // AI Chat Threads - Conversation threads for AI chat feature
  threads: defineTable({
    agentThreadId: v.string(), // Agent component thread ID
    userId: v.string(), // Auth identity subject (creator)
    organizationId: v.string(), // Clerk organization ID for multi-tenancy
    canvasId: v.optional(v.id("canvases")), // Optional: canvas this thread belongs to
    title: v.optional(v.string()), // Thread title/name
    createdAt: v.number(), // Timestamp when thread was created
    updatedAt: v.number(), // Timestamp when thread was last updated
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_org_updated", ["organizationId", "updatedAt"])
    .index("by_canvas", ["canvasId"]),

  // Canvases - Infinite canvas workspaces
  canvases: defineTable({
    organizationId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.string(), // userId
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_updated", ["organizationId", "updatedAt"]),

  // Canvas Nodes - Node positions and references on canvas
  canvas_nodes: defineTable({
    canvasId: v.id("canvases"),
    organizationId: v.string(),
    nodeType: v.union(v.literal("text"), v.literal("chat"), v.literal("youtube")), // Node type
    position: v.object({ x: v.number(), y: v.number() }),
    width: v.number(),
    height: v.number(),
    data: v.object({
      // Reference to type-specific table
      nodeId: v.union(v.id("text_nodes"), v.id("chat_nodes"), v.id("youtube_nodes")),
    }),
    notes: v.optional(v.string()), // User-added notes
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_organization", ["organizationId"]),

  // Canvas Edges - Connections between nodes
  canvas_edges: defineTable({
    canvasId: v.id("canvases"),
    organizationId: v.string(),
    source: v.id("canvas_nodes"), // Source node
    target: v.id("canvas_nodes"), // Target node
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_target", ["target"]), // For finding incoming edges to a node

  // Text Nodes - Text content for canvas
  text_nodes: defineTable({
    organizationId: v.string(),
    content: v.string(), // Markdown text
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Chat Nodes - AI chat conversations on canvas
  chat_nodes: defineTable({
    organizationId: v.string(),
    canvasId: v.optional(v.id("canvases")), // Canvas this chat node belongs to
    selectedThreadId: v.optional(v.id("threads")), // Currently selected thread
    threadId: v.optional(v.id("threads")), // Legacy: single thread reference (deprecated)
    agentId: v.optional(v.string()), // Which agent/model to use
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_canvas", ["canvasId"]),

  // YouTube Nodes - YouTube video transcripts
  youtube_nodes: defineTable({
    organizationId: v.string(),
    url: v.string(), // Full YouTube URL
    videoId: v.string(), // Extracted video ID
    title: v.optional(v.string()), // Video title
    transcript: v.optional(v.string()), // Full transcript text
    thumbnailUrl: v.optional(v.string()), // Video thumbnail
    duration: v.optional(v.number()), // Video duration in seconds
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()), // Error message if failed
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),
});
