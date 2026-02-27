import { Router, Request, Response } from "express";
import {
  callExternalService,
  externalServices,
} from "../lib/service-client.js";
import { ProvisionRequestSchema } from "../schemas.js";

const router = Router();

/**
 * POST /v1/auth/provision
 *
 * Public endpoint (no auth) — provisions an anonymous user + org via
 * client-service, then creates/retrieves a session API key via key-service.
 *
 * Body: { email: string, firstName?: string, lastName?: string, profilePicture?: string }
 * Returns: { apiKey, userId, orgId }
 */
router.post("/auth/provision", async (req: Request, res: Response) => {
  try {
    // 1. Validate request body
    const parsed = ProvisionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    const { email, firstName, lastName, profilePicture } = parsed.data;

    // 2. Create or find anonymous user via client-service
    let clientResult: {
      user: { id: string; email: string };
      org: { id: string };
      created: boolean;
    };

    try {
      clientResult = await callExternalService(
        externalServices.client,
        "/anonymous-users",
        {
          method: "POST",
          body: {
            appId: "mcpfactory",
            email,
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(profilePicture && { metadata: { profilePicture } }),
          },
        },
      );
    } catch (error: any) {
      console.error("[auth/provision] client-service error:", error.message);
      return res
        .status(502)
        .json({ error: "Failed to provision user: client-service unavailable" });
    }

    // 3. Get or create session API key via key-service
    let keyResult: { key: string; id: string };

    try {
      keyResult = await callExternalService(
        externalServices.key,
        "/internal/api-keys/session",
        {
          method: "POST",
          body: { orgId: clientResult.org.id },
        },
      );
    } catch (error: any) {
      console.error("[auth/provision] key-service error:", error.message);
      return res
        .status(502)
        .json({ error: "Failed to provision API key: key-service unavailable" });
    }

    // 4. Return provisioned credentials
    res.json({
      apiKey: keyResult.key,
      userId: clientResult.user.id,
      orgId: clientResult.org.id,
    });
  } catch (error: any) {
    console.error("[auth/provision] unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
