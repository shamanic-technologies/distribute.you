import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

/**
 * GET /v1/me
 * Get current authenticated identity (internal UUIDs)
 */
router.get("/me", authenticate, async (req: AuthenticatedRequest, res) => {
  res.json({
    userId: req.userId || null,
    orgId: req.orgId || null,
    authType: req.authType,
  });
});

export default router;
