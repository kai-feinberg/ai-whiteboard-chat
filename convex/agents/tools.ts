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
    // Don't include history on server side - it doesn't affect schema
    paragraph: {},
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    bold: {},
    italic: {},
    code: {},
    codeBlock: {},
    bulletList: {},
    orderedList: {},
    listItem: {},
    blockquote: {},
    horizontalRule: {},
    hardBreak: {}, // Enable hard breaks for line breaks
  }),
  Markdown, // Enable markdown parsing and serialization
];

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

    // Convert text content to ProseMirror JSON structure
    // NOTE: Do NOT filter out empty lines - they create blank lines for spacing
    const paragraphs = args.content.split('\n');
    const newContent = paragraphs.length > 0
      ? paragraphs.map(paragraph => ({
          type: "paragraph",
          content: paragraph.trim().length > 0 ? [{ type: "text", text: paragraph }] : []
        }))
      : [{
          type: "paragraph",
          content: []
        }];

    console.log('[setDocumentText] Created new content with', newContent.length, 'paragraphs');

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
