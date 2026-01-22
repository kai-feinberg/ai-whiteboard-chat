// convex/documents/functions.ts
import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

/**
 * Create a new document
 */
export const createDocument = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const now = Date.now();

    const documentId = await ctx.db.insert("documents", {
      organizationId,
      title: args.title,
      content: args.content || "",
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    });

    return documentId;
  },
});

/**
 * Get a single document by ID, validates org ownership
 */
export const getDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    // Verify ownership
    if (document.organizationId !== organizationId) {
      throw new Error("Document does not belong to your organization");
    }

    return document;
  },
});

/**
 * List all documents for current org, sorted by updatedAt desc
 */
export const listMyDocuments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_organization_updated", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    return documents;
  },
});

/**
 * Update document title and/or content
 */
export const updateDocument = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify ownership
    if (document.organizationId !== organizationId) {
      throw new Error("Document does not belong to your organization");
    }

    const updates: { title?: string; content?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.content !== undefined) {
      updates.content = args.content;
    }

    await ctx.db.patch(args.documentId, updates);

    return { success: true };
  },
});

/**
 * Delete a document, validates org ownership
 */
export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify ownership
    if (document.organizationId !== organizationId) {
      throw new Error("Document does not belong to your organization");
    }

    await ctx.db.delete(args.documentId);

    return { success: true };
  },
});
