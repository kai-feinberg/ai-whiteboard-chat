// convex/convex.config.ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import autumn from "@useautumn/convex/convex.config";

const app = defineApp();
app.use(agent);
app.use(workflow);
app.use(autumn);

export default app;