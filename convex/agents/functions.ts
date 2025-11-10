// convex/agents/functions.ts
import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { autumn } from "../autumn";

// Hardcoded default agents available to all organizations
const DEFAULT_AGENTS = [
  {
    id: "default",
    name: "Default",
    systemPrompt: "You are a helpful assistant.",
    isDefault: true,
    isCustom: false,
  },
  {
    id: "ideation",
    name: "Ideation Bot",
    systemPrompt: "You are a creative brainstorming assistant. Help users generate innovative ideas, explore possibilities, and think outside the box. When given context, build upon it to suggest new angles and creative directions.",
    isDefault: false,
    isCustom: false,
  },
];

/**
 * List all available agents (default + org's custom agents)
 */
export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Fetch org's custom agents
    const customAgents = await ctx.db
      .query("custom_agents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    // Map custom agents to include isCustom flag
    const mappedCustomAgents = customAgents.map((a) => ({
      id: a._id,
      name: a.name,
      systemPrompt: a.systemPrompt,
      isDefault: a.isDefault,
      isCustom: true,
    }));

    // Combine and return
    return [...DEFAULT_AGENTS, ...mappedCustomAgents];
  },
});

/**
 * Get a specific agent by ID (internal query for message generation)
 */
export const getAgent = internalQuery({
  args: {
    agentId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if default agent (hardcoded)
    const defaultAgent = DEFAULT_AGENTS.find((a) => a.id === args.agentId);
    if (defaultAgent) {
      return {
        name: defaultAgent.name,
        systemPrompt: defaultAgent.systemPrompt,
      };
    }

    // Fetch custom agent
    try {
      const agent = await ctx.db.get(args.agentId as Id<"custom_agents">);
      if (!agent || agent.organizationId !== args.organizationId) {
        return null;
      }

      return {
        name: agent.name,
        systemPrompt: agent.systemPrompt,
      };
    } catch (error) {
      // Invalid ID format or not found
      return null;
    }
  },
});

/**
 * Get the default agent for the current organization
 */
export const getDefaultAgent = query({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Check for org's custom default agent
    const customDefault = await ctx.db
      .query("custom_agents")
      .withIndex("by_org_default", (q) =>
        q.eq("organizationId", organizationId).eq("isDefault", true)
      )
      .first();

    if (customDefault) {
      return customDefault._id;
    }

    // Fallback to system default
    return "default";
  },
});

/**
 * Create a new custom agent (Action - handles Autumn check)
 */
export const createCustomAgent = action({
  args: {
    name: v.string(),
    systemPrompt: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ agentId: Id<"custom_agents"> }> => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // ========== PRO TIER CHECK ==========
    const { data, error } = await autumn.check(ctx, {
      featureId: "custom_agents",
    });

    if (error || !data?.allowed) {
      throw new Error(
        "Custom agents are a PRO feature. Please upgrade your plan to create custom agents."
      );
    }

    // Validate inputs
    if (!args.name.trim()) {
      throw new Error("Agent name is required");
    }
    if (!args.systemPrompt.trim()) {
      throw new Error("System prompt is required");
    }

    // Call internal mutation to create the agent
    const result = await ctx.runMutation(internal.agents.functions.createCustomAgentMutation, {
      organizationId,
      userId,
      name: args.name,
      systemPrompt: args.systemPrompt,
      isDefault: args.isDefault ?? false,
    });

    return result;
  },
});

/**
 * Internal mutation to create custom agent (DB operations only)
 */
export const createCustomAgentMutation = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    name: v.string(),
    systemPrompt: v.string(),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    // If setting as default, unset other org defaults
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("custom_agents")
        .withIndex("by_org_default", (q) =>
          q.eq("organizationId", args.organizationId).eq("isDefault", true)
        )
        .collect();

      for (const agent of existingDefaults) {
        await ctx.db.patch(agent._id, { isDefault: false });
      }
    }

    // Create agent
    const agentId = await ctx.db.insert("custom_agents", {
      organizationId: args.organizationId,
      name: args.name,
      systemPrompt: args.systemPrompt,
      isDefault: args.isDefault,
      createdBy: args.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { agentId };
  },
});

/**
 * Update an existing custom agent
 */
export const updateCustomAgent = mutation({
  args: {
    agentId: v.id("custom_agents"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get agent and verify ownership
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    if (agent.organizationId !== organizationId) {
      throw new Error("Agent does not belong to your organization");
    }

    // Validate inputs if provided
    if (args.name !== undefined && !args.name.trim()) {
      throw new Error("Agent name cannot be empty");
    }
    if (args.systemPrompt !== undefined && !args.systemPrompt.trim()) {
      throw new Error("System prompt cannot be empty");
    }

    // If setting as default, unset other org defaults
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("custom_agents")
        .withIndex("by_org_default", (q) =>
          q.eq("organizationId", organizationId).eq("isDefault", true)
        )
        .collect();

      for (const existingAgent of existingDefaults) {
        if (existingAgent._id !== args.agentId) {
          await ctx.db.patch(existingAgent._id, { isDefault: false });
        }
      }
    }

    // Build update object
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.systemPrompt !== undefined) {
      updates.systemPrompt = args.systemPrompt;
    }
    if (args.isDefault !== undefined) {
      updates.isDefault = args.isDefault;
    }

    // Update agent
    await ctx.db.patch(args.agentId, updates);

    return { success: true };
  },
});

/**
 * Delete a custom agent
 */
export const deleteCustomAgent = mutation({
  args: {
    agentId: v.id("custom_agents"),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const organizationId = identity.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new Error("No organization selected. Please select an organization to continue.");
    }

    // Get agent and verify ownership
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    if (agent.organizationId !== organizationId) {
      throw new Error("Agent does not belong to your organization");
    }

    // Delete agent
    await ctx.db.delete(args.agentId);

    return { success: true };
  },
});
