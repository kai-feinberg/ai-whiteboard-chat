import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Kie AI webhook callback for image generation
http.route({
  path: "/api/kie-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Extract imageNodeId from URL query params
      const url = new URL(request.url);
      const imageNodeId = url.searchParams.get("imageNodeId");

      if (!imageNodeId) {
        console.error("[Kie Webhook] Missing imageNodeId in query params");
        return new Response("Missing imageNodeId parameter", { status: 400 });
      }

      // Parse Kie AI callback body
      const body = await request.json();
      console.log(`[Kie Webhook] Received callback for image ${imageNodeId}:`, {
        code: body.code,
        state: body.data?.state,
        taskId: body.data?.taskId,
      });

      // Handle success case
      if (body.code === 200 && body.data?.state === "success") {
        const resultJson = JSON.parse(body.data.resultJson);
        const imageUrl = resultJson.resultUrls?.[0];

        if (!imageUrl) {
          console.error("[Kie Webhook] No image URL in success response");
          return new Response("Missing image URL in response", { status: 400 });
        }

        console.log(`[Kie Webhook] Processing success for ${imageNodeId}, downloading from ${imageUrl}`);

        // Trigger internal action to download and store image
        await ctx.runAction(internal.canvas.images.processKieCallback, {
          imageNodeId: imageNodeId as any,
          imageUrl,
          status: "completed",
        });

        return new Response("Success", { status: 200 });
      }

      // Handle failure case
      if (body.code === 501 || body.data?.state === "fail") {
        const errorMsg = body.data?.failMsg || body.msg || "Generation failed";
        console.error(`[Kie Webhook] Task failed for ${imageNodeId}: ${errorMsg}`);

        await ctx.runMutation(internal.canvas.images.updateImageNodeInternal, {
          imageNodeId: imageNodeId as any,
          status: "failed",
          error: errorMsg,
        });

        return new Response("Failure recorded", { status: 200 });
      }

      // Unknown state
      console.warn(`[Kie Webhook] Unknown state for ${imageNodeId}:`, body);
      return new Response("Unknown state", { status: 400 });

    } catch (error) {
      console.error("[Kie Webhook] Error processing webhook:", error);
      return new Response(
        `Webhook processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
        { status: 500 }
      );
    }
  }),
});

export default http;
