import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";

const router = Router();

/**
 * GET /v1/me
 * Get current user/org info
 */
router.get("/me", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, orgId, authType } = req;

    let user = null;
    if (userId) {
      try {
        const result = await callExternalService<{ user: any }>(
          externalServices.client,
          `/users/${userId}`
        );
        user = result.user;
      } catch {
        // User not found
      }
    }

    let org = null;
    if (orgId) {
      try {
        const result = await callExternalService<{ org: any }>(
          externalServices.client,
          `/orgs/${orgId}`
        );
        org = result.org;
      } catch {
        // Org not found
      }
    }

    res.json({ userId, orgId, authType, user, org });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

export default router;
