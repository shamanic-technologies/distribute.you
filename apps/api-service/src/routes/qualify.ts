import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { QualifyRequestSchema } from "../schemas.js";
import { fetchKeySource } from "../lib/billing.js";

const router = Router();

/**
 * POST /v1/qualify
 * Qualify an email reply using AI
 */
router.post("/qualify", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = QualifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const {
      sourceService,
      sourceOrgId,
      sourceRefId,
      fromEmail,
      toEmail,
      subject,
      bodyText,
      bodyHtml,
      byokApiKey,
    } = parsed.data;

    // Use orgId from auth if not provided
    const orgId = sourceOrgId || req.orgId;

    // Resolve keySource from billing-service (default to "platform" if no orgId)
    const keySource = orgId ? await fetchKeySource(orgId) : "platform";

    const result = await callExternalService(
      externalServices.replyQualification,
      "/qualify",
      {
        method: "POST",
        body: {
          sourceService,
          sourceOrgId: orgId,
          sourceRefId,
          fromEmail,
          toEmail,
          subject,
          bodyText,
          bodyHtml,
          appId: "mcpfactory",
          userId: req.userId,
          keySource,
          byokApiKey,
        },
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error("Qualify error:", error);
    res.status(500).json({ error: error.message || "Failed to qualify reply" });
  }
});

export default router;
