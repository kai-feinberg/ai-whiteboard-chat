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

    // Check if ProseMirror snapshot exists (this is the actual document)
    const latestVersion = await ctx.runQuery(components.prosemirrorSync.lib.latestVersion, {
      id: documentId
    });

    console.log('[setDocumentText] Latest ProseMirror version:', latestVersion);

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
      // Check for actual snapshot, not just metadata
      if (latestVersion !== null) {
        console.log('[setDocumentText] Deleting existing ProseMirror document');
        await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, {
          id: documentId
        });

        // Wait a moment for deletion to complete (helps avoid race conditions)
        // The deleteDocument mutation schedules async deletion of steps
        console.log('[setDocumentText] Document deleted, waiting before recreate');
      }

      // Recreate with new content at version 1 (since we deleted everything)
      console.log('[setDocumentText] Creating new document at version 1');
      await prosemirrorSync.create(ctx, documentId, documentContent);

      // Handle document metadata
      if (existingDocMetadata) {
        console.log('[setDocumentText] Refreshing document timestamp');
        await ctx.runMutation(internal.documents.functions.refreshDocumentTimestamp, {
          threadDocumentId: existingDocMetadata._id
        });
      } else {
        // Create initial document metadata
        console.log('[setDocumentText] Creating document metadata');
        await ctx.runMutation(internal.documents.functions.createDocumentMetadata, {
          documentId,
          title: args.title || "AI Playground Document",
          userId,
          organizationId: organizationId as string,
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
