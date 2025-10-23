// convex/convex.config.ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp();
app.use(agent);
app.use(prosemirrorSync);
app.use(workflow);

export default app;