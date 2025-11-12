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
    modelId: v.optional(v.string()), // AI model to use (e.g., "openai/gpt-4o")
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
    nodeType: v.union(v.literal("text"), v.literal("chat"), v.literal("youtube"), v.literal("website"), v.literal("tiktok"), v.literal("facebook_ad"), v.literal("group")), // Node type
    position: v.object({ x: v.number(), y: v.number() }),
    width: v.number(),
    height: v.number(),
    data: v.object({
      // Reference to type-specific table
      nodeId: v.union(v.id("text_nodes"), v.id("chat_nodes"), v.id("youtube_nodes"), v.id("website_nodes"), v.id("tiktok_nodes"), v.id("facebook_ads_nodes"), v.id("group_nodes")),
    }),
    notes: v.optional(v.string()), // User-added notes
    parentGroupId: v.optional(v.id("canvas_nodes")), // Parent group node (for nesting)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_organization", ["organizationId"])
    .index("by_parent_group", ["parentGroupId"]),

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
    agentId: v.optional(v.string()), // Which agent to use
    modelId: v.optional(v.string()), // Which AI model to use (e.g., "openai/gpt-4o")
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

  // Website Nodes - Scraped website content
  website_nodes: defineTable({
    organizationId: v.string(),
    url: v.string(), // Full website URL
    title: v.optional(v.string()), // Page title
    markdown: v.optional(v.string()), // Scraped content in Markdown
    screenshotStorageId: v.optional(v.string()), // Convex storage ID for screenshot
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

  // TikTok Nodes - TikTok video transcripts
  tiktok_nodes: defineTable({
    organizationId: v.string(),
    url: v.string(), // Full TikTok URL
    videoId: v.optional(v.string()), // Extracted video ID from API response
    title: v.optional(v.string()), // Video description/caption
    transcript: v.optional(v.string()), // Full transcript text
    author: v.optional(v.string()), // Video author/creator
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

  // Facebook Ads Nodes - Facebook Ad Library ads
  facebook_ads_nodes: defineTable({
    organizationId: v.string(),
    adId: v.string(), // Facebook Ad Archive ID (user input)
    adArchiveID: v.optional(v.string()), // Confirmed Ad Archive ID from API
    url: v.optional(v.string()), // Ad Library URL
    title: v.optional(v.string()), // Ad title (from snapshot.title or cards)
    body: v.optional(v.string()), // Ad body text
    linkDescription: v.optional(v.string()), // Link description
    transcript: v.optional(v.string()), // Video transcript if available
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"), v.literal("none"))), // Type of media
    imageStorageIds: v.optional(v.array(v.string())), // Convex storage IDs for images
    videoThumbnailStorageId: v.optional(v.string()), // Convex storage ID for video thumbnail
    videoUrl: v.optional(v.string()), // HD video URL
    pageName: v.optional(v.string()), // Page/advertiser name
    publisherPlatform: v.optional(v.array(v.string())), // Platforms ad ran on
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

  // Group Nodes - Container nodes that hold multiple child nodes
  group_nodes: defineTable({
    organizationId: v.string(),
    title: v.string(), // Group name/title
    description: v.optional(v.string()), // Optional description
    color: v.optional(v.string()), // Background color
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Custom Agents - Organization-scoped custom AI agents
  custom_agents: defineTable({
    organizationId: v.string(),
    name: v.string(), // Display name (e.g., "VSL Writer", "Ideation Bot")
    systemPrompt: v.string(), // Custom instructions for agent
    isDefault: v.boolean(), // Whether this is the default agent for org
    createdBy: v.string(), // userId who created it
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_default", ["organizationId", "isDefault"]),
});
