import { Router } from "express";
import { authenticate, requireOrg, requireUser, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, streamExternalService, externalServices } from "../lib/service-client.js";
import { buildInternalHeaders } from "../lib/internal-headers.js";

const router = Router();

// PUT /v1/chat/config — register app chat config
router.put("/chat/config", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.appId) {
      return res.status(403).json({ error: "App key authentication required for config registration" });
    }

    const result = await callExternalService(
      externalServices.chat,
      `/apps/${req.appId}/config`,
      { method: "PUT", body: req.body, headers: buildInternalHeaders(req) }
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to register chat config" });
  }
});

// POST /v1/chat — stream AI response via SSE
router.post("/chat", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    await streamExternalService(
      externalServices.chat,
      "/chat",
      {
        method: "POST",
        body: {
          ...req.body,
          appId: req.appId || req.body.appId,
        },
        headers: buildInternalHeaders(req),
        expressRes: res,
      }
    );
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Failed to stream chat response" });
    }
  }
});

export default router;
