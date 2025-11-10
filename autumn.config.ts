import {
	feature,
	product,
	featureItem,
	priceItem,
} from "atmn";

// ==================== FEATURES ====================

// Canvas limit feature (continuous_use = always active, like seats)
export const canvases = feature({
	id: "canvases",
	name: "Canvases",
	type: "continuous_use",
});

// AI Credits feature (single_use = consumed when used)
// 4000 credits = $1 USD
export const aiCredits = feature({
	id: "ai_credits",
	name: "AI Credits",
	type: "single_use",
});

// Custom Agents feature (boolean = feature flag for PRO only)
export const customAgents = feature({
	id: "custom_agents",
	name: "Custom Agents",
	type: "boolean",
});

// ==================== PRODUCTS ====================

// Free tier
export const free = product({
	id: "free",
	name: "Free",
	items: [
		// 3 canvases
		featureItem({
			feature_id: canvases.id,
			included_usage: 3,
		}),
		// 8,000 AI credits/month ($2 value)
		featureItem({
			feature_id: aiCredits.id,
			included_usage: 8000,
			interval: "month",
		}),
		// No custom agents on free tier (omit the featureItem entirely)
	],
});

// Pro tier (Monthly) - Starting simple with just Pro Monthly
export const pro = product({
	id: "pro",
	name: "Pro",
	items: [
		// $30/month flat fee
		priceItem({
			price: 30,
			interval: "month",
		}),
		// Unlimited canvases
		featureItem({
			feature_id: canvases.id,
			included_usage: 999999, // Effectively unlimited
		}),
		// 60,000 AI credits/month ($15 value)
		featureItem({
			feature_id: aiCredits.id,
			included_usage: 60000,
			interval: "month",
		}),
		// Custom agents enabled for Pro (boolean feature)
		featureItem({
			feature_id: customAgents.id,
		}),
	],
});

export default {
	features: [canvases, aiCredits, customAgents],
	products: [free, pro],
};
