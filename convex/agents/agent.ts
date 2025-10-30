// convex/agents/agent.ts
import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { setDocumentText } from "./tools";

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
- Always respond to the user's message in the chat BEFORE and AFTER calling the setDocumentText tool
- Always use bold formatting to differentiate headings from regular text

Remember: You're helping the user create and refine documents through natural conversation.`,

  languageModel:'xai/grok-4-fast-non-reasoning',

  tools: {
    setDocumentText,
  },
  maxSteps: 10,

  // Configuration for tool usage
  callSettings: {
    maxRetries: 2,
    temperature: 0.7,
  },
});
