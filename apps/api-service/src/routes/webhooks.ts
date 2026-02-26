import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import { callExternalService, externalServices, callService, services } from "../lib/service-client.js";

const router = Router();

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

/**
 * POST /webhooks/clerk
 * Public route — no auth middleware. Verified via svix signature.
 * Handles Clerk events: user.created, session.created
 */
router.post("/webhooks/clerk", async (req: Request, res: Response) => {
  if (!CLERK_WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  // Verify webhook signature
  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Missing svix headers" });
    return;
  }

  let event: any;
  try {
    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    event = wh.verify(JSON.stringify(req.body), {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const eventType = event.type as string;

  try {
    if (eventType === "user.created") {
      const clerkUserId = event.data.id as string;

      // Resolve Clerk user ID to internal UUID
      const userResult = await callService<{ user: { id: string } }>(
        services.client, `/users/by-clerk/${clerkUserId}`
      ).catch(() => null);
      const userId = userResult?.user?.id;

      if (!userId) {
        console.warn(`[webhooks/clerk] Could not resolve clerkUserId=${clerkUserId} to internal ID, skipping lifecycle emails`);
      } else {
        // Fire welcome email + signup notification in parallel
        await Promise.allSettled([
          callExternalService(externalServices.lifecycle, "/send", {
            method: "POST",
            body: {
              appId: "mcpfactory",
              eventType: "welcome",
              userId,
            },
          }),
          callExternalService(externalServices.lifecycle, "/send", {
            method: "POST",
            body: {
              appId: "mcpfactory",
              eventType: "signup_notification",
              userId,
            },
          }),
        ]);
      }
    }

    if (eventType === "session.created") {
      const clerkUserId = event.data.user_id as string;

      // Resolve Clerk user ID to internal UUID
      const userResult = await callService<{ user: { id: string } }>(
        services.client, `/users/by-clerk/${clerkUserId}`
      ).catch(() => null);
      const userId = userResult?.user?.id;

      if (userId) {
        callExternalService(externalServices.lifecycle, "/send", {
          method: "POST",
          body: {
            appId: "mcpfactory",
            eventType: "signin_notification",
            userId,
          },
        }).catch((err) => console.warn("[webhooks/clerk] signin_notification failed:", err.message));
      }
    }
  } catch (err: any) {
    console.error(`[webhooks/clerk] Failed to process ${eventType}:`, err.message);
  }

  // Always return 200 to Clerk so it doesn't retry
  res.json({ received: true });
});

export default router;
