// convex/canvas/website.ts
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import Firecrawl from "@mendable/firecrawl-js";

/**
 * Create a new website node on the canvas
 * This is an action because it needs to schedule background scraping
 */
export const createWebsiteNode = action({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
  },
  handler: async (ctx, args): Promise<{
    canvasNodeId: Id<"canvas_nodes">;
    websiteNodeId: Id<"website_nodes">;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Basic URL validation
    try {
      new URL(args.url);
    } catch {
      throw new Error("Invalid URL");
    }

    // Create website node via internal mutation
    const result = await ctx.runMutation(internal.canvas.website.createWebsiteNodeInternal, {
      canvasId: args.canvasId,
      position: args.position,
      url: args.url,
      organizationId,
    });

    // Schedule background scraping
    await ctx.scheduler.runAfter(0, internal.canvas.website.scrapeWebsite, {
      websiteNodeId: result.websiteNodeId,
    });

    return result;
  },
});

/**
 * Internal mutation to create website node (called from action)
 */
export const createWebsiteNodeInternal = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    position: v.object({ x: v.number(), y: v.number() }),
    url: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify canvas ownership
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || canvas.organizationId !== args.organizationId) {
      throw new Error("Canvas not found or unauthorized");
    }

    const now = Date.now();

    // Create website node data with pending status
    const websiteNodeId = await ctx.db.insert("website_nodes", {
      organizationId: args.organizationId,
      url: args.url,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create canvas node reference
    const canvasNodeId = await ctx.db.insert("canvas_nodes", {
      canvasId: args.canvasId,
      organizationId: args.organizationId,
      nodeType: "website",
      position: args.position,
      width: 450, // Website node width
      height: 400, // Website node height
      data: { nodeId: websiteNodeId },
      createdAt: now,
      updatedAt: now,
    });

    // Update canvas timestamp
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    return { canvasNodeId, websiteNodeId };
  },
});

/**
 * Background action to scrape website with Firecrawl
 */
export const scrapeWebsite = internalAction({
  args: {
    websiteNodeId: v.id("website_nodes"),
  },
  handler: async (ctx, args) => {
    console.log(`[Website] Starting scrape for node: ${args.websiteNodeId}`);

    // Get website node
    const node = await ctx.runQuery(internal.canvas.website.getWebsiteNodeInternal, {
      websiteNodeId: args.websiteNodeId,
    });

    if (!node) {
      console.error(`[Website] Node not found: ${args.websiteNodeId}`);
      throw new Error("Website node not found");
    }

    console.log(`[Website] Scraping URL: ${node.url}`);

    // Update status to processing
    await ctx.runMutation(internal.canvas.website.updateWebsiteNodeInternal, {
      websiteNodeId: args.websiteNodeId,
      status: "processing",
    });

    try {
      // Initialize Firecrawl client
      const firecrawl = new Firecrawl({
        apiKey: process.env.FIRECRAWL_API_KEY!,
      });

      console.log(`[Website] Firecrawl client initialized, scraping with screenshot...`);

      // Scrape with markdown + screenshot
      const result = await firecrawl.scrape(node.url, {
        formats: ['markdown'],
        actions: [
          {
            type: 'screenshot',
            fullPage: false,
            quality: 80,
          }
        ],
        onlyMainContent: true,
      });

      console.log(`[Website] Scrape completed, processing results...`);

      // Extract data from result
      const resultData = result as any;
      const markdown = resultData.data?.markdown || resultData.markdown || '';
      const title = resultData.data?.metadata?.title || resultData.metadata?.title || node.url;

      // Get screenshot URL from actions
      const screenshotUrl = resultData.data?.actions?.screenshots?.[0] || resultData.actions?.screenshots?.[0];

      let screenshotStorageId: string | undefined;

      if (screenshotUrl) {
        console.log(`[Website] Screenshot available, uploading to Convex storage...`);

        // Fetch screenshot blob
        const screenshotResponse = await fetch(screenshotUrl);
        const screenshotBlob = await screenshotResponse.blob();

        // Store in Convex storage
        screenshotStorageId = await ctx.storage.store(screenshotBlob);
        console.log(`[Website] Screenshot stored with ID: ${screenshotStorageId}`);
      } else {
        console.warn(`[Website] No screenshot available in result`);
      }

      // Check if markdown is available
      if (!markdown || markdown.length === 0) {
        console.warn(`[Website] No markdown content scraped from: ${node.url}`);
      }

      console.log(`[Website] Markdown length: ${markdown.length} characters`);

      // Save scraped data and update to completed
      await ctx.runMutation(internal.canvas.website.updateWebsiteNodeInternal, {
        websiteNodeId: args.websiteNodeId,
        title,
        markdown,
        screenshotStorageId,
        status: "completed",
      });

      console.log(`[Website] Scrape saved successfully for: ${node.url}`);
    } catch (error: any) {
      console.error(`[Website] Error scraping ${node.url}:`, error);
      console.error(`[Website] Error message: ${error?.message}`);

      let errorMessage = error?.message || "Failed to scrape website";

      // Update to failed with error message
      await ctx.runMutation(internal.canvas.website.updateWebsiteNodeInternal, {
        websiteNodeId: args.websiteNodeId,
        status: "failed",
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal query to get website node (for background action)
 */
export const getWebsiteNodeInternal = internalQuery({
  args: {
    websiteNodeId: v.id("website_nodes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.websiteNodeId);
  },
});

/**
 * Internal mutation to update website node (for background action)
 */
export const updateWebsiteNodeInternal = internalMutation({
  args: {
    websiteNodeId: v.id("website_nodes"),
    title: v.optional(v.string()),
    markdown: v.optional(v.string()),
    screenshotStorageId: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.markdown !== undefined) updates.markdown = args.markdown;
    if (args.screenshotStorageId !== undefined) updates.screenshotStorageId = args.screenshotStorageId;
    if (args.status !== undefined) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.websiteNodeId, updates);
  },
});
