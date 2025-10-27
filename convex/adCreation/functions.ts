// convex/ad-creation/functions.ts
// Re-export all queries and mutations from this module

export {
  getCreatedAds,
  getCreatedAdById,
  getAdDocuments,
  getAdConcepts,
  getAdAngles,
  getAdStyles,
  getAdHooks,
  getDocumentTemplate,
} from "./queries";

export {
  createAd,
  updatePipelineStage,
  deleteAd,
  seedAdConcepts,
  seedAdAngles,
  seedAdStyles,
  seedAdHooks,
  seedDocumentTemplates,
} from "./mutations";

export {
  getAdThread,
  sendAdMessage,
} from "./actions";
