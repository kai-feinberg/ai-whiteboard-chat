// convex/ad-creation/functions.ts
// Re-export all queries and mutations from this module
// NOTE: Actions are NOT re-exported here to avoid circular dependencies
// Access actions via api.adCreation.actions.* instead

export {
  getCreatedAds,
  getCreatedAdById,
  getAdDocuments,
  getAdConcepts,
  getAdAngles,
  getAdStyles,
  getAdHooks,
  getDocumentTemplate,
  getAdThreadId,
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
