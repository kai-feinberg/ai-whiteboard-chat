// convex/documents/functions.ts
import { v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

/**
 * Get document metadata by document ID
 */
export const getByDocumentId = query({
  args: {
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const organizationId = identity.orgId;
    if (!organizationId) return null;

    const doc = await ctx.db
      .query("threadDocuments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();

    // Ensure user has access (same organization)
    if (doc && doc.organizationId === organizationId) {
      return doc;
    }

    return null;
  },
});

/**
 * Get document metadata by thread ID
 */
export const getByThreadId = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const organizationId = identity.orgId;
    if (!organizationId) return null;

    const doc = await ctx.db
      .query("threadDocuments")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    // Ensure user has access (same organization)
    if (doc && doc.organizationId === organizationId) {
      return doc;
    }

    return null;
  },
});

/**
 * Get the playground document for the current organization
 */
export const getPlaygroundDocument = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const organizationId = identity.orgId;
    if (!organizationId) return null;

    const documentId = `playground-doc-${organizationId}`;

    const doc = await ctx.db
      .query("threadDocuments")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .first();

    return doc;
  },
});

/**
 * Create document metadata (internal - called by tools)
 */
export const createDocumentMetadata = internalMutation({
  args: {
    documentId: v.string(),
    title: v.string(),
    userId: v.string(),
    organizationId: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[createDocumentMetadata] Creating metadata:', args);

    const existing = await ctx.db
      .query("threadDocuments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();

    if (existing) {
      console.log('[createDocumentMetadata] Document metadata already exists');
      return existing._id;
    }

    const docId = await ctx.db.insert("threadDocuments", {
      documentId: args.documentId,
      threadId: args.threadId,
      title: args.title,
      createdBy: args.userId,
      organizationId: args.organizationId,
      createdAt: Date.now(),
      documentVersion: 1,
    });

    console.log('[createDocumentMetadata] Created document metadata:', docId);
    return docId;
  },
});

/**
 * Refresh document timestamp and increment version (internal - called by tools)
 * This triggers UI updates when AI modifies the document
 */
export const refreshDocumentTimestamp = internalMutation({
  args: {
    threadDocumentId: v.id("threadDocuments"),
  },
  handler: async (ctx, args) => {
    console.log('[refreshDocumentTimestamp] Refreshing:', args.threadDocumentId);

    const doc = await ctx.db.get(args.threadDocumentId);
    if (!doc) {
      console.error('[refreshDocumentTimestamp] Document not found');
      return;
    }

    await ctx.db.patch(args.threadDocumentId, {
      createdAt: Date.now(),
      documentVersion: (doc.documentVersion || 1) + 1,
    });

    console.log('[refreshDocumentTimestamp] Document version incremented to:', (doc.documentVersion || 1) + 1);
  },
});

/**
 * Update document title
 */
export const updateTitle = mutation({
  args: {
    documentId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.orgId;
    if (!organizationId) {
      throw new Error("No organization context");
    }

    const doc = await ctx.db
      .query("threadDocuments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();

    if (!doc) {
      throw new Error("Document not found");
    }

    if (doc.organizationId !== organizationId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(doc._id, {
      title: args.title,
    });

    return { success: true };
  },
});

/**
 * Delete document and its metadata
 */
export const deleteDocument = mutation({
  args: {
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.orgId;
    if (!organizationId) {
      throw new Error("No organization context");
    }

    const doc = await ctx.db
      .query("threadDocuments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();

    if (!doc) {
      throw new Error("Document not found");
    }

    if (doc.organizationId !== organizationId) {
      throw new Error("Unauthorized");
    }

    // Delete metadata
    await ctx.db.delete(doc._id);

    // Note: ProseMirror document deletion should be handled separately via components

    return { success: true };
  },
});
