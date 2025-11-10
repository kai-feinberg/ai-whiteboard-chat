// AI Credits Pricing Utilities
// 4000 credits = $1 USD (or 1 credit = $0.00025)
// Vercel AI Gateway provides actual cost in USD via providerMetadata.gateway.cost

/**
 * Convert USD cost to credits
 * @param usdCost - Cost in USD (can be string like "0.0001545" or number)
 * @returns Credits (rounded to 2 decimal places)
 */
export function convertUsdToCredits(usdCost: string | number): number {
  const usd = typeof usdCost === 'string' ? parseFloat(usdCost) : usdCost;

  // Convert USD to credits (4000 credits = $1)
  // Example: $0.0001545 * 4000 = 0.618 credits
  const credits = usd * 4000;

  // Round to 2 decimal places for cleaner display
  return Math.round(credits * 100) / 100;
}

/**
 * Estimate cost for pre-flight check (rough approximation)
 * @param prompt - User's message text
 * @returns Estimated credits needed
 */
export function estimateCost(prompt: string): number {
  // Rough estimate for pre-flight check
  // Average: 1 token ~= 4 chars, typical cost ~$0.0002 per 1k tokens
  const estimatedTokens = Math.ceil(prompt.length / 4);
  const estimatedUsd = (estimatedTokens / 1000) * 0.0002 * 2; // 2x for completion

  return convertUsdToCredits(estimatedUsd);
}
