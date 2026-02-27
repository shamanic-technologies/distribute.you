import { Router } from "express";
import { authenticate, requireOrg, requireUser, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { AddByokKeyRequestSchema, CreateApiKeyRequestSchema } from "../schemas.js";

const router = Router();

/**
 * GET /v1/keys
 * List BYOK keys for the organization
 */
router.get("/keys", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.key,
      `/internal/keys?orgId=${req.orgId}`
    );
    res.json(result);
  } catch (error: any) {
    console.error("List keys error:", error);
    res.status(500).json({ error: error.message || "Failed to list keys" });
  }
});

/**
 * POST /v1/keys
 * Add a provider key. Supports:
 * - scope: "app" → app-scoped key (requires app key auth, no org/user needed)
 * - no scope → BYOK org-scoped key (requires org + user context)
 */
router.post("/keys", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = AddByokKeyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { provider, apiKey, scope } = parsed.data;

    if (scope === "app") {
      if (!req.appId) {
        return res.status(403).json({ error: "App-scoped keys require app key authentication" });
      }

      const result = await callExternalService(
        externalServices.key,
        "/internal/app-keys",
        {
          method: "POST",
          body: { appId: req.appId, provider, apiKey },
        }
      );
      return res.json(result);
    }

    // Default: BYOK key (requires org + user)
    if (!req.orgId) {
      return res.status(400).json({ error: "Organization context required" });
    }
    if (!req.userId) {
      return res.status(401).json({ error: "User identity required" });
    }

    const result = await callExternalService(
      externalServices.key,
      "/internal/keys",
      {
        method: "POST",
        body: { orgId: req.orgId, provider, apiKey },
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Add key error:", error);
    res.status(500).json({ error: error.message || "Failed to add key" });
  }
});

/**
 * DELETE /v1/keys/:provider
 * Remove a BYOK key
 */
router.delete("/keys/:provider", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { provider } = req.params;

    const result = await callExternalService(
      externalServices.key,
      `/internal/keys/${provider}?orgId=${req.orgId}`,
      { method: "DELETE" }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Delete key error:", error);
    res.status(500).json({ error: error.message || "Failed to delete key" });
  }
});

/**
 * GET /internal/keys/:provider/decrypt
 * Get decrypted BYOK key (for internal service-to-service use)
 * Requires X-API-Key header for service auth
 */
router.get("/internal/keys/:provider/decrypt", async (req, res) => {
  try {
    const { provider } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId required" });
    }

    const result = await callExternalService(
      externalServices.key,
      `/internal/keys/${provider}/decrypt?orgId=${orgId}`
    );
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes("404")) {
      return res.status(404).json({ error: `${req.params.provider} key not configured` });
    }
    console.error("Decrypt key error:", error);
    res.status(500).json({ error: error.message || "Failed to decrypt key" });
  }
});

/**
 * POST /v1/api-keys/session
 * Get or create a session API key for Foxy chat
 */
router.post("/api-keys/session", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.key,
      "/internal/api-keys/session",
      {
        method: "POST",
        body: { orgId: req.orgId },
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Session API key error:", error);
    res.status(500).json({ error: error.message || "Failed to get session API key" });
  }
});

/**
 * POST /v1/api-keys
 * Generate a new API key for the organization
 */
router.post("/api-keys", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = CreateApiKeyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { name } = parsed.data;

    const result = await callExternalService(
      externalServices.key,
      "/internal/api-keys",
      {
        method: "POST",
        body: { orgId: req.orgId, name },
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Create API key error:", error);
    res.status(500).json({ error: error.message || "Failed to create API key" });
  }
});

/**
 * GET /v1/api-keys
 * List API keys for the organization
 */
router.get("/api-keys", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.key,
      `/internal/api-keys?orgId=${req.orgId}`
    );
    res.json(result);
  } catch (error: any) {
    console.error("List API keys error:", error);
    res.status(500).json({ error: error.message || "Failed to list API keys" });
  }
});

/**
 * DELETE /v1/api-keys/:id
 * Revoke an API key
 */
router.delete("/api-keys/:id", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.key,
      `/internal/api-keys/${id}`,
      {
        method: "DELETE",
        body: { orgId: req.orgId },
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Delete API key error:", error);
    res.status(500).json({ error: error.message || "Failed to delete API key" });
  }
});

export default router;
