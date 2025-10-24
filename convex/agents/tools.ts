// convex/agents/tools.ts
import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { prosemirrorSync } from "./canvas";
import { api, components, internal } from "../_generated/api";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Transform } from "@tiptap/pm/transform";

// Define the extensions - must match the client-side editor schema
// Note: For server-side operations, we only need extensions that affect the schema
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] }, // Customize heading levels to match client
    // All other extensions use defaults (includes bold, italic, strike, etc.)
  }),
  Markdown, // Enable markdown parsing/serialization
];

/**
 * Parse inline markdown (bold, italic, strikethrough, code, underline) into ProseMirror text nodes with marks
 */
function parseInlineMarkdown(text: string): any[] {
  if (!text) return [];

  // Process markdown patterns in a single pass to avoid overlaps
  // Patterns: **bold**, __underline__, *italic*, ~~strike~~, `code`
  // Use a combined regex that matches all patterns and processes them in order

  const nodes: any[] = [];
  let remaining = text;
  let processed = '';

  // Combined pattern - order matters: longer patterns first to avoid false matches
  // \*\*([^*]+)\*\* = **bold**
  // __([^_]+)__ = __underline__
  // \*([^*]+)\* = *italic*
  // ~~([^~]+)~~ = ~~strike~~
  // `([^`]+)` = `code`
  const combinedPattern = /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(~~([^~]+)~~)|(`([^`]+)`)/g;

  let lastIndex = 0;
  let match;

  while ((match = combinedPattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plainText = text.substring(lastIndex, match.index);
      if (plainText) {
        nodes.push({ type: 'text', text: plainText });
      }
    }

    // Determine which pattern matched and extract the text
    let markedText = '';
    let markType = '';

    if (match[1]) { // **bold**
      markedText = match[2];
      markType = 'bold';
    } else if (match[3]) { // __underline__
      markedText = match[4];
      markType = 'underline';
    } else if (match[5]) { // *italic*
      markedText = match[6];
      markType = 'italic';
    } else if (match[7]) { // ~~strike~~
      markedText = match[8];
      markType = 'strike';
    } else if (match[9]) { // `code`
      markedText = match[10];
      markType = 'code';
    }

    // Add marked text node
    if (markedText && markType) {
      nodes.push({
        type: 'text',
        text: markedText,
        marks: [{ type: markType }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text after last match
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      nodes.push({ type: 'text', text: remainingText });
    }
  }

  // If no markdown found, return simple text node
  if (nodes.length === 0 && text) {
    return [{ type: 'text', text }];
  }

  return nodes;
}

/**
 * Helper function to get current document text
 * Exported so it can be used by the agent to provide context
 */
export async function getCurrentDocumentText(ctx: any, organizationId: string): Promise<string | null> {
  const documentId = `playground-doc-${organizationId}`;
  const schema = getSchema(extensions);

  try {
    // Check if document exists
    const latestVersion = await ctx.runQuery(components.prosemirrorSync.lib.latestVersion, {
      id: documentId
    });

    if (latestVersion === null) {
      return null; // Document doesn't exist yet
    }

    // Get the document content
    const { doc } = await prosemirrorSync.getDoc(ctx, documentId, schema);

    // Convert ProseMirror doc to plain text
    let text = '';
    doc.content.forEach((node: any) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        node.content?.forEach((textNode: any) => {
          if (textNode.type.name === 'text') {
            text += textNode.text;
          }
        });
        text += '\n';
      }
    });

    return text.trim();
  } catch (error) {
    console.error('[getCurrentDocumentText] Error:', error);
    return null;
  }
}

/**
 * Tool for AI to create or update the collaborative document
 * Uses ProseMirror transforms for proper OT (Operational Transform) support
 */
export const setDocumentText = createTool({
  description: "Create or update the collaborative document with new content. Use this when you want to write, edit, or replace content in the document.",
  args: z.object({
    content: z.string().describe("The full text content to set in the document. Can be multiple paragraphs separated by newlines."),
    title: z.optional(z.string()).describe("Optional title for the document"),
  }),
  handler: async (ctx, args): Promise<string> => {
    console.log('[setDocumentText] Tool called with:', { contentLength: args.content.length, title: args.title });

    // Get user and organization info
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error('[setDocumentText] No authenticated user');
      return "❌ Error: Not authenticated";
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      console.error('[setDocumentText] No organization ID found');
      return "❌ Error: No organization context";
    }

    // Use hardcoded document ID for playground
    const documentId = `playground-doc-${organizationId}`;

    console.log('[setDocumentText] Using document ID:', documentId);

    // Check if document metadata exists
    const existingDocMetadata = await ctx.runQuery(api.documents.functions.getByDocumentId, {
      documentId
    });

    console.log('[setDocumentText] Existing metadata:', existingDocMetadata ? 'found' : 'not found');

    // Get the schema (must match client-side editor)
    const schema = getSchema(extensions);

    // Check if ProseMirror snapshot exists
    const latestVersion = await ctx.runQuery(components.prosemirrorSync.lib.latestVersion, {
      id: documentId
    });

    console.log('[setDocumentText] Latest ProseMirror version:', latestVersion);

    // Convert markdown text content to ProseMirror JSON structure with formatting marks
    // We need to manually parse markdown since generateJSON requires browser APIs
    // For now, we'll create a simple parser that handles common markdown:
    // **bold**, *italic*, ~~strikethrough~~, # headings

    const lines = args.content.split('\n');
    const newContent: any[] = [];

    for (const line of lines) {
      // Check for headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        newContent.push({
          type: "heading",
          attrs: { level },
          content: parseInlineMarkdown(text),
        });
        continue;
      }

      // Regular paragraph
      if (line.trim().length > 0) {
        newContent.push({
          type: "paragraph",
          content: parseInlineMarkdown(line),
        });
      } else {
        // Empty line = empty paragraph for spacing
        newContent.push({
          type: "paragraph",
          content: [],
        });
      }
    }

    console.log('[setDocumentText] Parsed markdown into', newContent.length, 'nodes');

    try {
      // If document doesn't exist yet, create it
      if (latestVersion === null) {
        console.log('[setDocumentText] Creating new document');
        await prosemirrorSync.create(ctx, documentId, {
          type: "doc",
          content: newContent
        });

        // Create document metadata
        console.log('[setDocumentText] Creating document metadata');
        await ctx.runMutation(internal.documents.functions.createDocumentMetadata, {
          documentId,
          title: args.title || "AI Playground Document",
          userId,
          organizationId: organizationId as string,
          threadId: "playground-thread",
        });

        console.log('[setDocumentText] Document created successfully');
        return `✅ Document created successfully! (${args.content.length} characters, ${newContent.length} paragraphs)`;
      }

      // Document exists - use transform to replace content
      console.log('[setDocumentText] Transforming existing document');

      await prosemirrorSync.transform(ctx, documentId, schema, (doc) => {
        const tr = new Transform(doc);

        // Replace entire document content with new content
        // Delete everything from position 0 to end of doc
        tr.delete(0, doc.content.size);

        // Insert new content at position 0
        for (let i = 0; i < newContent.length; i++) {
          const paragraphJson = newContent[i];
          const node = schema.nodeFromJSON(paragraphJson);
          tr.insert(i === 0 ? 0 : tr.doc.content.size, node);
        }

        return tr;
      });

      // Update document metadata timestamp
      if (existingDocMetadata) {
        console.log('[setDocumentText] Refreshing document timestamp');
        await ctx.runMutation(internal.documents.functions.refreshDocumentTimestamp, {
          threadDocumentId: existingDocMetadata._id
        });
      }

      console.log('[setDocumentText] Document successfully transformed');
      return `✅ Document updated successfully! (${args.content.length} characters, ${newContent.length} paragraphs)`;
    } catch (error) {
      console.error('[setDocumentText] Error updating document:', error);
      return `❌ Error updating document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});
