import { Router } from "express";
import { authenticate, requireOrg, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";

const router = Router();

/**
 * POST /v1/activity
 * Track user activity — fires a lifecycle email (deduped per user per day)
 */
router.post("/activity", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    callExternalService(externalServices.lifecycle, "/send", {
      method: "POST",
      body: {
        appId: "mcpfactory",
        eventType: "user_active",
        clerkUserId: req.userId,
        clerkOrgId: req.orgId,
      },
    }).catch((err) => console.warn("[activity] Lifecycle email failed:", err.message));

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Activity tracking error:", error);
    res.status(500).json({ error: "Failed to track activity" });
  }
});

export default router;
