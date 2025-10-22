// convex/agents/agent.ts
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { setDocumentText } from "./tools";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Create OpenRouter provider instance
const openrouter = createOpenRouter({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
});

// Create the language model using OpenRouter
// We'll use Claude 3.5 Sonnet via OpenRouter
const languageModel = openrouter("anthropic/claude-3.5-sonnet");

/**
 * AI Canvas Assistant Agent
 * Helps users collaborate on documents through chat
 */
export const canvasAgent = new Agent(components.agent, {
  name: "Canvas Assistant",
  instructions: `You are a helpful AI assistant that can help users write and edit documents collaboratively.

You have access to a collaborative document that you can read and edit. When users ask you to write something,
create content, or make changes, use the setDocumentText tool to update the document.

Guidelines:
- Be helpful and creative when generating content
- When asked to write something, generate complete, well-structured content
- You can write articles, essays, code, lists, stories, or any other content the user requests
- Always confirm what you've written after using the tool
- If the user wants to edit existing content, ask them what changes they'd like
- Be conversational and engaging

Remember: You're helping the user create and refine documents through natural conversation.`,

  languageModel,

  tools: {
    setDocumentText,
  },

  // Configuration for tool usage
  callSettings: {
    maxRetries: 2,
    temperature: 0.7,
  },
});
