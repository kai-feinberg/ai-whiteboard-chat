// convex/ad-creation/actions.ts
import { v } from "convex/values";
import { internalAction, action } from "../_generated/server";
import { internal, api, components } from "../_generated/api";
import { prosemirrorSync } from "../agents/canvas";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { createThread, saveMessage } from "@convex-dev/agent";

// Define the extensions - must match the client-side editor schema
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  Markdown,
];

/**
 * Helper function to parse simple inline markdown
 */
function parseInlineMarkdown(text: string): any[] {
  if (!text) return [];

  const nodes: any[] = [];
  const combinedPattern = /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(~~([^~]+)~~)|(`([^`]+)`)/g;

  let lastIndex = 0;
  let match;

  while ((match = combinedPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plainText = text.substring(lastIndex, match.index);
      if (plainText) {
        nodes.push({ type: 'text', text: plainText });
      }
    }

    let markedText = '';
    let markType = '';

    if (match[1]) {
      markedText = match[2];
      markType = 'bold';
    } else if (match[3]) {
      markedText = match[4];
      markType = 'underline';
    } else if (match[5]) {
      markedText = match[6];
      markType = 'italic';
    } else if (match[7]) {
      markedText = match[8];
      markType = 'strike';
    } else if (match[9]) {
      markedText = match[10];
      markType = 'code';
    }

    if (markedText && markType) {
      nodes.push({
        type: 'text',
        text: markedText,
        marks: [{ type: markType }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      nodes.push({ type: 'text', text: remainingText });
    }
  }

  if (nodes.length === 0 && text) {
    return [{ type: 'text', text }];
  }

  return nodes;
}

/**
 * Convert markdown template to ProseMirror JSON
 */
function markdownToProseMirror(markdown: string): any[] {
  const lines = markdown.split('\n');
  const content: any[] = [];

  for (const line of lines) {
    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInlineMarkdown(text),
      });
      continue;
    }

    // Regular paragraph
    if (line.trim().length > 0) {
      content.push({
        type: "paragraph",
        content: parseInlineMarkdown(line),
      });
    } else {
      // Empty line = empty paragraph for spacing
      content.push({
        type: "paragraph",
        content: [],
      });
    }
  }

  return content;
}

/**
 * Render template with placeholder replacement
 */
function renderTemplate(template: string, data: Record<string, any>): string {
  let rendered = template;

  // Simple string replacement for {{placeholder}}
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }

  return rendered;
}

/**
 * Initialize 4 ProseMirror documents with templates
 * Internal action called after ad creation
 */
export const initializeAdDocuments = internalAction({
  args: {
    adId: v.id("createdAds"),
    organizationId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[initializeAdDocuments] Starting for ad ${args.adId}`);

    // Fetch ad with all related data
    const ad = await ctx.runQuery(internal.adCreation.queries.getCreatedAdByIdInternal, {
      adId: args.adId,
    });

    if (!ad) {
      throw new Error("Ad not found");
    }

    // Fetch onboarding profile for product/buyer description
    let profile = null;
    try {
      profile = await ctx.runQuery(api.onboarding.queries.getOnboardingProfile, {});
    } catch (e) {
      console.warn("[initializeAdDocuments] No onboarding profile found");
    }

    // Build template data
    const templateData = {
      conceptName: ad.concept?.name || '',
      angleName: ad.angle?.name || '',
      styleName: ad.style?.name || '',
      hookName: ad.hook?.name || '',
      desires: ad.desires?.map((d: any) => `- ${d.text} (${d.category || 'uncategorized'})`).join('\n') || '',
      beliefs: ad.beliefs?.map((b: any) => `- ${b.text} (${b.category || 'uncategorized'})`).join('\n') || '',
      productDescription: profile?.productDescription || '[No product description available]',
      targetBuyerDescription: profile?.targetBuyerDescription || '[No target buyer description available]',
      createdDate: new Date(ad.createdAt).toLocaleDateString(),
    };

    // Document types to create
    const documentTypes = [
      { type: "details", templateType: "ad_details" },
      { type: "copy", templateType: "ad_copy" },
      { type: "asset_brief", templateType: "ad_asset_brief" },
      { type: "notes", templateType: "ad_notes" },
    ];

    const schema = getSchema(extensions);

    // Create each document
    for (const docType of documentTypes) {
      const documentId = `ad_${args.adId}_${docType.type}`;

      // Fetch template
      const templateContent = await ctx.runQuery(
        internal.adCreation.queries.getTemplateContentInternal,
        { templateType: docType.templateType }
      );

      if (!templateContent) {
        console.error(`[initializeAdDocuments] Template not found: ${docType.templateType}`);
        continue;
      }

      // Render template with data
      const rendered = renderTemplate(templateContent, templateData);

      // Convert markdown to ProseMirror JSON
      const proseMirrorContent = markdownToProseMirror(rendered);

      // Create ProseMirror document
      console.log(`[initializeAdDocuments] Creating ProseMirror doc: ${documentId}`);
      await prosemirrorSync.create(ctx, documentId, {
        type: "doc",
        content: proseMirrorContent,
      });

      // Create database record
      await ctx.runMutation(internal.adCreation.mutations.createAdDocumentRecord, {
        adId: args.adId,
        organizationId: args.organizationId,
        documentType: docType.type,
        documentId,
      });

      console.log(`[initializeAdDocuments] Created ${docType.type} document`);
    }

    console.log(`[initializeAdDocuments] ✅ Initialized all 4 documents for ad ${args.adId}`);

    // Create thread with initial context message
    await ctx.runAction(internal.adCreation.actions.createAdThreadWithContext, {
      adId: args.adId,
      userId: args.userId,
      organizationId: args.organizationId,
    });
  },
});

/**
 * Create thread for ad + inject initial assistant message with ad context
 * Internal action called after document initialization
 */
export const createAdThreadWithContext = internalAction({
  args: {
    adId: v.id("createdAds"),
    userId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[createAdThreadWithContext] Creating thread for ad ${args.adId}`);

    // Fetch ad with all details
    const ad = await ctx.runQuery(internal.adCreation.queries.getCreatedAdByIdInternal, {
      adId: args.adId,
    });

    if (!ad) {
      throw new Error("Ad not found");
    }

    // Create thread using Agent component
    const agentThreadId = await createThread(ctx, components.agent, {
      userId: args.userId,
      title: `Ad: ${ad.name}`,
      summary: `Thread for ad creation: ${ad.name}`,
    });

    console.log(`[createAdThreadWithContext] Created agent thread: ${agentThreadId}`);

    // Build context message
    const contextMessage = `# Ad Creation Session Started

I'm ready to help you create **${ad.name}**.

## Ad Framework
- **Concept:** ${ad.concept?.name} - ${ad.concept?.description}
- **Angle:** ${ad.angle?.name} - ${ad.angle?.description}
- **Style:** ${ad.style?.name} - ${ad.style?.description}
- **Hook:** ${ad.hook?.name} - ${ad.hook?.description}

## Target Desires (${ad.desires?.length || 0} selected)
${ad.desires?.map((d: any) => `- ${d.text}`).join('\n') || '- None selected'}

## Target Beliefs (${ad.beliefs?.length || 0} selected)
${ad.beliefs?.map((b: any) => `- ${b.text}`).join('\n') || '- None selected'}

---

**What would you like to work on?**
- Edit the **Details** tab to refine your ad strategy
- Write compelling **Copy** for your ad
- Create an **Asset Brief** for your designer
- Add **Notes** for your team

Switch between document tabs above and I'll help you edit them in real-time.`;

    // Save initial assistant message using Agent SDK
    await saveMessage(ctx, components.agent, {
      threadId: agentThreadId,
      agentName: "AdScout AI",
      message: { role: "assistant", content: contextMessage },
    });

    console.log(`[createAdThreadWithContext] ✅ Saved initial context message`);

    // Store thread mapping in our custom table
    await ctx.runMutation(internal.adCreation.mutations.saveAdThreadMapping, {
      adId: args.adId,
      agentThreadId,
      organizationId: args.organizationId,
    });

    return agentThreadId;
  },
});


/**
 * Get thread for a specific ad
 * Public query - checks organization ownership
 */
export const getAdThread = action({
  args: { adId: v.id("createdAds") },
  handler: async (ctx, args): Promise<{ agentThreadId: string } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Verify ad belongs to current organization - use internal query to avoid circular dependency
    const ad = await ctx.runQuery(internal.adCreation.queries.getCreatedAdByIdInternal, {
      adId: args.adId,
    });

    if (!ad || ad.organizationId !== organizationId) {
      throw new Error("Ad not found or unauthorized");
    }

    // Find thread mapping
    const thread = await ctx.runQuery(internal.agents.queries.queryPlaygroundThread, {
      organizationId: args.adId as string, // We stored adId temporarily
    });

    return thread;
  },
});

/**
 * Send message to ad chat
 * Includes active document context in system prompt
 */
export const sendAdMessage = action({
  args: {
    adId: v.id("createdAds"),
    message: v.string(),
    activeDocumentId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response: string; threadId: string }> => {
    console.log(`[sendAdMessage] Sending message for ad ${args.adId}, doc: ${args.activeDocumentId}`);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Verify ad belongs to current organization - use internal query to avoid circular dependency
    const ad = await ctx.runQuery(internal.adCreation.queries.getCreatedAdByIdInternal, {
      adId: args.adId,
    });

    if (!ad || ad.organizationId !== organizationId) {
      throw new Error("Ad not found or unauthorized");
    }

    // Get thread ID (find or create thread for this ad)
    // For now, we'll reuse the existing sendMessage pattern from agents/actions.ts
    // This is a simplified implementation - full version would fetch threadId from mapping

    // TODO: Implement proper thread retrieval and document context injection
    // For MVP, we can pass through to the existing sendMessage action
    const result = await ctx.runAction(api.agents.actions.sendMessage, {
      message: args.message,
    });

    return result;
  },
});
