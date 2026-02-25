import { Router } from "express";
import { authenticate, requireOrg, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { GenerateWorkflowRequestSchema } from "../schemas.js";

const router = Router();

/**
 * GET /v1/workflows
 * List workflows for the authenticated org from workflow-service
 */
router.get("/workflows", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const appId = (req.query.appId as string) || "mcpfactory";
    const params = new URLSearchParams();
    params.set("orgId", appId);
    params.set("appId", appId);

    if (req.query.category) params.set("category", req.query.category as string);
    if (req.query.channel) params.set("channel", req.query.channel as string);
    if (req.query.audienceType) params.set("audienceType", req.query.audienceType as string);

    const result = await callExternalService(
      externalServices.workflow,
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
      externalServices.workflow,
      `/workflows/${req.params.id}`
    );

    res.json(workflow);
  } catch (error: any) {
    console.error("Get workflow error:", error.message);
    res.status(500).json({ error: error.message || "Failed to get workflow" });
  }
});

/**
 * POST /v1/workflows/generate
 * Generate a workflow DAG from natural language via workflow-service
 */
router.post("/workflows/generate", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = GenerateWorkflowRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    const { description, hints } = parsed.data;

    const result = await callExternalService(
      externalServices.workflow,
      "/workflows/generate",
      {
        method: "POST",
        body: {
          appId: "mcpfactory",
          orgId: req.orgId,
          description,
          hints,
        },
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error("Generate workflow error:", error.message);
    const status = error.message?.includes("422") ? 422 : 500;
    res.status(status).json({ error: error.message || "Failed to generate workflow" });
  }
});

export default router;
