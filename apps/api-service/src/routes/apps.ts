import { Router } from "express";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { RegisterAppRequestSchema } from "../schemas.js";

const router = Router();

/**
 * POST /v1/apps/register
 * Register a new app and get an API key. Public — no authentication required.
 * Idempotent: returns existing appId if already registered.
 */
router.post("/apps/register", async (req, res) => {
  try {
    const parsed = RegisterAppRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { name } = parsed.data;

    const result = await callExternalService(
      externalServices.key,
      "/internal/apps",
      {
        method: "POST",
        body: { name },
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error("App registration error:", error);
    res.status(500).json({ error: error.message || "Failed to register app" });
  }
});

export default router;
