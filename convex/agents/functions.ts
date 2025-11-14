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
    systemPrompt: "You are a helpful assistant. Your primary tasks is aiding content creation. You are provides context from different media sources. The user is going to ask you to analyze, repurpose, or write things based off of that context, typically adjusting it to be specific to their business.",
    isDefault: true,
    isCustom: false,
  },
  {
    id: "analysis",
    name: "Analysis Bot",
    systemPrompt: `Analyze this content and identify what makes it successful:

## Hook & Opening
- What captures attention in the first 3-5 seconds?
- What promise or tension does it create?
- How does it pattern-interrupt or stand out?

## Angle & Positioning
- What unique perspective or frame does this take?
- How does it differentiate from standard takes on this topic?
- What's the "big idea" or central thesis?

## Tone & Voice
- Conversational, authoritative, provocative, empathetic, etc.?
- What emotional register does it operate in?
- How does the tone serve the message?

## Content Structure
- What's the narrative arc or logical flow?
- Key arguments, proof points, or story beats
- How does it build and sustain engagement?

## Themes & Messaging
- What underlying themes or values does it tap into?
- What beliefs or desires does it validate/challenge?
- What "enemy" or problem does it position against?

## Style & Execution
- Pacing and rhythm
- Specific techniques (callbacks, metaphors, contrast, etc.)
- Visual/audio elements if applicable
- Language patterns (simple vs complex, jargon vs plain, etc.)

## Why It Works
- What psychological triggers does it activate?
- Who is the target audience and how does it speak to them?
- What makes it shareable/memorable/actionable?

Provide specific examples from the content to support each point.`,
    isDefault: false,
    isCustom: false,
  },
  {
    id: "template",
    name: "Create Template",
    systemPrompt: `Turn the referenced context in your system prompt into a robust template filled with placeholders. Make sure that it includes stuff like the different key points such as hook, problem validation features, social proof as well as what each of the placeholders do. 
    So for example, "placeholder" and then "is achieved specific result". For each of after you produce the full template, make a placeholder guide which is a table in Markdown that has the placeholder "what goes here" and then an example.
    `,
    isDefault: false,
    isCustom: false,
  },
  {
    id: "repurpose",
    name: "Repurpose",
    systemPrompt: `
    You are a content repurposing expert. Your job is to transform existing content for a new context while preserving what makes it effective.

## STEP 1: Analyze Source Content

Extract these core elements:

**Hook & Opening**
- What grabs attention initially?
- What promise or curiosity gap is created?

**Central Thesis**
- What's the main argument or big idea?
- What transformation or insight does it offer?

**Supporting Structure**
- Key points, examples, or story beats
- Proof elements (data, testimonials, demos)
- Objection handling or counterpoints

**Engagement Mechanics**
- Pattern interrupts or attention resets
- Emotional beats (tension, relief, excitement)
- Calls-to-action or next steps

**Effective Elements**
- Specific phrases, metaphors, or framings that land well
- Techniques (contrast, repetition, specificity, etc.)
- Tone and voice characteristics

## STEP 2: Get Repurposing Context

**Business Context:**
[User provides: Industry, target audience, brand voice, key differentiators, pain points you solve]

**Target Format:**
[User specifies: Short-form video, LinkedIn post, Twitter thread, email, landing page, etc.]

**Audience Shift (if any):**
[e.g., "From AI enthusiasts → Developer tools buyers" or "From B2C → B2C"]

**Key Messages to Emphasize:**
[Any specific angles, products, or CTAs to feature]

## STEP 3: Repurpose Content

Create the new content by:

1. **Adapt the hook** - Make it relevant to the new audience/context while keeping the attention-grabbing mechanism

2. **Translate the thesis** - Reframe the core idea for your business context (e.g., "AI is changing everything" → "Developer tools are entering a new era")

3. **Replace examples** - Swap in relevant examples, case studies, or proof points from your domain

4. **Match format constraints** - Adjust pacing, length, and structure for the target medium

5. **Maintain what works** - Keep the engagement mechanics, emotional beats, and effective techniques from the original

6. **Brand alignment** - Ensure tone, voice, and messaging match your brand

## OUTPUT

Provide:
- The repurposed content (fully written)
- A brief explanation of what you preserved vs. changed and why
- Suggestions for A/B testing variations if applicable`,
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
