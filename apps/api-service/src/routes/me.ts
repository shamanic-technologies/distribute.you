import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import { callService, services } from "../lib/service-client.js";

const router = Router();

/**
 * GET /v1/me
 * Get current user/org info
 */
router.get("/me", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, orgId, authType } = req;

    // Get user info from client-service
    let user = null;
    if (userId) {
      try {
        const result = await callService<{ user: any }>(
          services.client,
          `/users/by-clerk/${userId}`
        );
        user = result.user;
      } catch {
        // User might not exist yet
      }
    }

    // Get org info from client-service
    let org = null;
    if (orgId) {
      try {
        const result = await callService<{ org: any }>(
          services.client,
          `/orgs/by-clerk/${orgId}`
        );
        org = result.org;
      } catch {
        // Org might not exist yet
      }
    }

    res.json({
      userId,
      orgId,
      authType,
      user,
      org,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

export default router;
