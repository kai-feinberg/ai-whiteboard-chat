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
	],
});

export default {
	features: [canvases, aiCredits],
	products: [free, pro],
};
