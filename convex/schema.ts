import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({

  // Ad Subscriptions - User's tracked search terms and companies
  subscriptions: defineTable({
    userId: v.string(), // Auth identity subject (owner)
    organizationId: v.string(), // Clerk organization ID for multi-tenancy
    searchTerm: v.optional(v.string()),
    company: v.optional(v.string()),
    platform: v.string(), // "facebook", "google", "linkedin", etc.
    frequency: v.string(), // "daily", "weekly", "realtime"
    isActive: v.boolean(),
    lastScrapedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Advertisers - Deduplicated advertiser/page data
  advertisers: defineTable({
    pageId: v.string(), // Platform's unique page/advertiser ID
    platform: v.string(), // "facebook", "google", "linkedin", etc.
    pageName: v.string(),
    pageLikeCount: v.number(),
    pageCategories: v.array(v.string()),
    pageProfilePictureUrl: v.optional(v.string()), // Meta-hosted URL (backward compatibility)
    pageProfilePictureStorageId: v.optional(v.id("_storage")), // Convex storage ID
    pageProfileUri: v.optional(v.string()), // e.g., https://www.facebook.com/username/
    lastScrapedAt: v.number(), // Track when we last saw this advertiser
    organizationId: v.optional(v.string()), // Organization that discovered this advertiser (optional)
  })
    .index("by_page_id_and_platform", ["pageId", "platform"])
    .index("by_platform", ["platform"]),

  // Competitor Ads - Scraped competitor ad data
  competitorAds: defineTable({
    userId: v.string(), // Auth identity subject (owner)
    organizationId: v.string(), // Clerk organization ID for multi-tenancy
    subscriptionId: v.id("subscriptions"),
    platform: v.string(),
    adId: v.string(), // Platform's unique ad ID
    title: v.string(),
    description: v.string(),
    link: v.optional(v.string()),
    mediaUrls: v.array(v.string()), // Meta-hosted URLs (backward compatibility)
    thumbnailUrl: v.optional(v.string()), // Meta-hosted URL (backward compatibility)
    thumbnailStorageId: v.optional(v.id("_storage")), // Convex storage ID for thumbnail
    mediaStorageIds: v.optional(v.array(v.id("_storage"))), // Array of Convex storage IDs
    mediaMetadata: v.optional(
      v.array(
        v.object({
          type: v.string(), // "image" | "video"
          storageId: v.id("_storage"),
          originalUrl: v.string(), // Original Meta URL for reference
        })
      )
    ),
    scrapedAt: v.number(),
    rawData: v.optional(v.any()), // Store full platform response

    // Foreign key to advertiser (optional for backward compatibility)
    pageId: v.optional(v.string()), // Links to advertisers.pageId

    // Campaign timeline (optional for backward compatibility)
    startDate: v.optional(v.number()), // Unix timestamp (milliseconds)
    endDate: v.optional(v.number()), // Unix timestamp, undefined if still active
    isActive: v.optional(v.boolean()),
    totalActiveTime: v.optional(v.number()), // Duration in seconds ad has been running

    // Ad format & creative (optional for backward compatibility)
    displayFormat: v.optional(v.string()), // "MULTI_IMAGES", "DCO", "VIDEO", "SINGLE_IMAGE", etc.
    ctaText: v.optional(v.string()), // "Subscribe", "Learn More", "No button", etc.
    ctaType: v.optional(v.string()), // "SUBSCRIBE", "LEARN_MORE", "NO_BUTTON", etc.
    collationCount: v.optional(v.number()), // Number of ad variations in collection
    caption: v.optional(v.string()), // Link caption text

    // Distribution (optional for backward compatibility)
    publisherPlatforms: v.optional(v.array(v.string())), // ["FACEBOOK", "INSTAGRAM", "MESSENGER", ...]
    reachEstimate: v.optional(
      v.object({
        lower: v.number(),
        upper: v.number(),
      })
    ),
    spend: v.optional(
      v.object({
        lower: v.number(),
        upper: v.number(),
        currency: v.string(),
      })
    ),

    // Content structure (for carousel/DCO ads - optional for backward compatibility)
    cards: v.optional(
      v.array(
        v.object({
          title: v.optional(v.string()),
          body: v.optional(v.string()),
          caption: v.optional(v.string()),
          linkUrl: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          videoUrl: v.optional(v.string()),
        })
      )
    ),
    hasVideo: v.optional(v.boolean()),
    videoCount: v.optional(v.number()),
    imageCount: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_scraped_at", ["scrapedAt"])
    .index("by_platform_and_ad_id", ["platform", "adId"])
    .index("by_page_id", ["pageId"]),

  // AI Chat Threads - Conversation threads for AI chat feature
  threads: defineTable({
    userId: v.string(), // Auth identity subject (owner)
    organizationId: v.string(), // Clerk organization ID for multi-tenancy
    title: v.optional(v.string()), // Thread title/name
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Thread Documents - Links chat threads to collaborative documents
  threadDocuments: defineTable({
    threadId: v.string(), // Foreign key to thread
    documentId: v.string(), // ProseMirror document ID (e.g., "doc_thread123")
    title: v.optional(v.string()), // User-editable document title
    createdBy: v.string(), // User who created document
    organizationId: v.string(), // Clerk organization ID for multi-tenancy
    createdAt: v.number(), // Timestamp (used to trigger refreshes)
    documentVersion: v.optional(v.number()), // Incremented on AI edits
  })
    .index("by_thread", ["threadId"])
    .index("by_document", ["documentId"])
    .index("by_organization", ["organizationId"]),

  // Onboarding Profiles - Organization's onboarding data (one per org)
  onboardingProfiles: defineTable({
    organizationId: v.string(), // Clerk organization ID
    websiteUrl: v.optional(v.string()), // Optional website for analysis
    vslTranscript: v.string(), // Required VSL/sales letter transcript
    productDescription: v.string(), // Required product details
    marketDescription: v.string(), // Required market details
    targetBuyerDescription: v.string(), // Required buyer persona
    additionalIdeas: v.optional(v.string()), // Optional freeform ideas/notes
    workflowId: v.optional(v.string()), // Workflow execution ID for tracking
    completedAt: v.optional(v.number()), // When all documents finished generating
    createdBy: v.string(), // User who filled form
    // Facebook ad scraping fields (optional for backward compatibility)
    facebookPageId: v.optional(v.string()),
    facebookPageName: v.optional(v.string()),
    facebookAdLibraryUrl: v.optional(v.string()),
    totalAdsScraped: v.optional(v.number()),
    adsLastScrapedAt: v.optional(v.number()),
    adsScrapeStatus: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"]),

  // Generated Documents - AI-generated marketing documents
  generatedDocuments: defineTable({
    organizationId: v.string(), // Clerk organization ID
    onboardingProfileId: v.id("onboardingProfiles"), // Foreign key to profile
    documentType: v.string(), // "offer_brief" | "copy_blocks" | "ump_ums" | "beat_map" | "build_a_buyer" | "pain_core_wound" | "competitors"
    content: v.optional(v.string()), // Generated markdown content
    status: v.string(), // "pending" | "generating" | "completed" | "failed"
    errorMessage: v.optional(v.string()), // Error message if failed
    generatedAt: v.optional(v.number()), // Timestamp when completed
    regenerationCount: v.number(), // Track regeneration attempts
  })
    .index("by_organization", ["organizationId"])
    .index("by_profile", ["onboardingProfileId"])
    .index("by_profile_and_type", ["onboardingProfileId", "documentType"]),

  // Document Analysis - AI quality analysis of generated documents
  documentAnalysis: defineTable({
    organizationId: v.string(), // Clerk organization ID
    onboardingProfileId: v.id("onboardingProfiles"), // Foreign key to profile
    documentType: v.string(), // Same as generatedDocuments
    completeness: v.number(), // 0-100 percentage
    suggestions: v.array(v.string()), // Improvement suggestions
    missingElements: v.array(v.string()), // Critical gaps
    status: v.string(), // "pending" | "analyzing" | "completed" | "failed"
    errorMessage: v.optional(v.string()), // Error if analysis failed
    analysisGeneratedAt: v.optional(v.number()), // Timestamp
    regenerationCount: v.number(), // Track re-analysis
  })
    .index("by_organization", ["organizationId"])
    .index("by_profile", ["onboardingProfileId"])
    .index("by_profile_and_type", ["onboardingProfileId", "documentType"]),

  // Target Desires - AI-generated list of customer desires
  targetDesires: defineTable({
    organizationId: v.string(), // Clerk organization ID
    profileId: v.id("onboardingProfiles"), // Foreign key to profile
    text: v.string(), // Desire statement (5-15 words)
    category: v.optional(v.string()), // "status" | "security" | "achievement" | "belonging" | "freedom" | "growth"
  })
    .index("by_organization", ["organizationId"])
    .index("by_profile", ["profileId"]),

  // Target Beliefs - AI-generated list of customer beliefs
  targetBeliefs: defineTable({
    organizationId: v.string(), // Clerk organization ID
    profileId: v.id("onboardingProfiles"), // Foreign key to profile
    text: v.string(), // Belief statement (5-15 words)
    category: v.optional(v.string()), // "self_identity" | "worldview" | "solutions" | "obstacles" | "values"
  })
    .index("by_organization", ["organizationId"])
    .index("by_profile", ["profileId"]),

  // Created Ads - User-created ads from wizard flow
  createdAds: defineTable({
    organizationId: v.string(), // Clerk organization ID
    createdBy: v.string(), // User ID
    name: v.string(), // Auto-generated from filters (e.g., "Social Proof - Testimonial - Bold")
    conceptId: v.id("adConcepts"), // Selected concept
    angleId: v.id("adAngles"), // Selected angle
    styleId: v.id("adStyles"), // Selected style
    hookId: v.id("adHooks"), // Selected hook
    selectedDesireIds: v.array(v.id("targetDesires")), // Multi-select desires
    selectedBeliefIds: v.array(v.id("targetBeliefs")), // Multi-select beliefs
    pipelineStage: v.string(), // "to_do" | "in_progress" | "ready_for_review" | "asset_creation" | "ready_to_publish" | "published"
    campaignId: v.optional(v.string()), // Future campaign grouping
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_pipeline_stage", ["organizationId", "pipelineStage"])
    .index("by_created_at", ["organizationId", "createdAt"]),

  // Ad Documents - ProseMirror documents for each created ad (4 per ad)
  adDocuments: defineTable({
    organizationId: v.string(), // Clerk organization ID
    adId: v.id("createdAds"), // Parent ad (note: different from competitorAds)
    documentType: v.string(), // "details" | "copy" | "asset_brief" | "notes"
    documentId: v.string(), // ProseMirror doc ID (e.g., "doc_ad_123_copy")
    documentVersion: v.number(), // Incremented by AI edits
    createdAt: v.number(),
  })
    .index("by_ad", ["adId"])
    .index("by_organization", ["organizationId"])
    .index("by_document_id", ["documentId"]),

  // Ad Concepts - Filtering options for ad creation wizard
  adConcepts: defineTable({
    name: v.string(), // Display name
    description: v.string(), // Search/description text
    organizationId: v.optional(v.string()), // null = global, set = org-specific
  })
    .index("by_organization", ["organizationId"]),

  // Ad Angles - Filtering options for ad creation wizard
  adAngles: defineTable({
    name: v.string(), // Display name
    description: v.string(), // Search/description text
    organizationId: v.optional(v.string()), // null = global, set = org-specific
  })
    .index("by_organization", ["organizationId"]),

  // Ad Styles - Filtering options for ad creation wizard
  adStyles: defineTable({
    name: v.string(), // Display name
    description: v.string(), // Search/description text
    organizationId: v.optional(v.string()), // null = global, set = org-specific
  })
    .index("by_organization", ["organizationId"]),

  // Ad Hooks - Filtering options for ad creation wizard
  adHooks: defineTable({
    name: v.string(), // Display name
    description: v.string(), // Search/description text
    organizationId: v.optional(v.string()), // null = global, set = org-specific
  })
    .index("by_organization", ["organizationId"]),

  // Document Templates - Markdown templates for ad documents
  documentTemplates: defineTable({
    templateType: v.string(), // "ad_details" | "ad_copy" | "ad_asset_brief" | "ad_notes"
    templateContent: v.string(), // Markdown with {{placeholders}}
    organizationId: v.optional(v.string()), // null = global default
  })
    .index("by_template_type", ["templateType"])
    .index("by_organization", ["organizationId"]),
});
