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
	],
});

export default {
	features: [canvases],
	products: [free, pro],
};
