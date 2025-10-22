// convex/agents/tools.ts
import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { prosemirrorSync } from "./canvas";
import { api, components, internal } from "../_generated/api";

/**
 * Tool for AI to create or update the collaborative document
 * Uses delete-and-recreate pattern to avoid OT conflicts
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
    const organizationId = identity.orgId;

    if (!organizationId || typeof organizationId !== "string") {
      console.error('[setDocumentText] No organization ID found');
      return "❌ Error: No organization context";
    }

    // Use hardcoded document ID for playground
    const documentId = `playground-doc-${organizationId}`;

    console.log('[setDocumentText] Using document ID:', documentId);

    // Check if document already exists
    const existingDoc = await ctx.runQuery(api.documents.functions.getByDocumentId, {
      documentId
    });

    console.log('[setDocumentText] Existing doc:', existingDoc ? 'found' : 'not found');

    // Convert text content to ProseMirror JSON structure
    const paragraphs = args.content.split('\n').filter(p => p.trim().length > 0);
    const documentContent = {
      type: "doc",
      content: paragraphs.length > 0
        ? paragraphs.map(paragraph => ({
            type: "paragraph",
            content: [{ type: "text", text: paragraph }]
          }))
        : [{
            type: "paragraph",
            content: []
          }]
    };

    console.log('[setDocumentText] Created document content with', documentContent.content.length, 'paragraphs');

    try {
      // DELETE-AND-RECREATE PATTERN (Critical for AI edits)
      if (existingDoc) {
        console.log('[setDocumentText] Deleting existing document');
        await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, {
          id: documentId
        });
      }

      // Recreate with new content
      console.log('[setDocumentText] Creating new document');
      await prosemirrorSync.create(ctx, documentId, documentContent);

      // If document metadata exists, update its version
      if (existingDoc) {
        console.log('[setDocumentText] Refreshing document timestamp');
        await ctx.runMutation(internal.documents.functions.refreshDocumentTimestamp, {
          threadDocumentId: existingDoc._id
        });
      } else {
        // Create initial document metadata
        console.log('[setDocumentText] Creating document metadata');
        await ctx.runMutation(internal.documents.functions.createDocumentMetadata, {
          documentId,
          title: args.title || "AI Playground Document",
          userId,
          organizationId,
          threadId: "playground-thread", // Hardcoded for now
        });
      }

      console.log('[setDocumentText] Document successfully updated');
      return `✅ Document updated successfully! (${args.content.length} characters, ${paragraphs.length} paragraphs)`;
    } catch (error) {
      console.error('[setDocumentText] Error updating document:', error);
      return `❌ Error updating document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});
