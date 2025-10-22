// convex/agents/canvas.ts
import { components } from "../_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({});

// Export the prosemirrorSync instance for use in other files (tools, etc.)
export { prosemirrorSync };
