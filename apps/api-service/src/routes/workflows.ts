import { Router } from "express";
import { authenticate, requireOrg, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";

const router = Router();

/**
 * GET /v1/workflows
 * List workflows for the authenticated org from workflow-service
 */
router.get("/workflows", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const params = new URLSearchParams();
    params.set("orgId", req.orgId!);
    params.set("appId", (req.query.appId as string) || "mcpfactory");

    if (req.query.category) params.set("category", req.query.category as string);
    if (req.query.channel) params.set("channel", req.query.channel as string);
    if (req.query.audienceType) params.set("audienceType", req.query.audienceType as string);

    const result = await callExternalService(
      externalServices.windmill,
      `/workflows?${params.toString()}`
    );

    res.json(result);
  } catch (error: any) {
    console.error("List workflows error:", error.message);
    res.status(500).json({ error: error.message || "Failed to list workflows" });
  }
});

/**
 * GET /v1/workflows/:id
 * Get a single workflow with full DAG from workflow-service
 */
router.get("/workflows/:id", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const workflow = await callExternalService(
      externalServices.windmill,
      `/workflows/${req.params.id}`
    );

    res.json(workflow);
  } catch (error: any) {
    console.error("Get workflow error:", error.message);
    res.status(500).json({ error: error.message || "Failed to get workflow" });
  }
});

export default router;
