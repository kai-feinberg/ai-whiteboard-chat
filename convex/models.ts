// convex/models.ts
import { action } from "./_generated/server";
import { gateway } from "@ai-sdk/gateway";

/**
 * Fetch available language models from AI Gateway
 * Returns models with their name, description, and provider info
 */
export const getAvailableModels = action({
  args: {},
  handler: async () => {
    const { models } = await gateway.getAvailableModels();
    const languageModels = models.filter((m) => m.modelType === "language");

    return languageModels.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description || null,
      pricing: model.pricing
        ? {
            input: model.pricing.input,
            output: model.pricing.output,
            cachedInputTokens: model.pricing.cachedInputTokens || null,
            cacheCreationInputTokens: model.pricing.cacheCreationInputTokens || null,
          }
        : null,
    }));
  },
});
