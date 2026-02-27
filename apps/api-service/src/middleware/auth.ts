import { Request, Response, NextFunction } from "express";
import { callExternalService, externalServices } from "../lib/service-client.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  orgId?: string;
  appId?: string;
  authType?: "app_key" | "user_key";
}

/**
 * Authenticate via API key (app key or user key)
 * - App key (mcpf_app_*): resolved via key-service → appId, then external IDs
 *   from x-org-id/x-user-id headers resolved to internal UUIDs via client-service
 * - User key (mcpf_*): resolved via key-service → orgId (internal UUID directly)
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authentication" });
    }

    const key = authHeader.slice(7);

    // Validate key with key-service
    const validation = await validateKey(key);
    if (!validation) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // App key: set appId, optionally resolve external IDs
    if (validation.type === "app") {
      req.appId = validation.appId;
      req.authType = "app_key";

      const externalOrgId = req.headers["x-org-id"] as string | undefined;
      const externalUserId = req.headers["x-user-id"] as string | undefined;

      if (externalOrgId && externalUserId) {
        const resolved = await resolveExternalIds(
          validation.appId!,
          externalOrgId,
          externalUserId,
        );

        if (!resolved) {
          return res.status(502).json({ error: "Identity resolution failed" });
        }

        req.orgId = resolved.orgId;
        req.userId = resolved.userId;
      }

      return next();
    }

    // User key: orgId is already an internal UUID
    req.orgId = validation.orgId;
    req.authType = "user_key";
    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Invalid authentication" });
  }
}

/**
 * Validate API key against key-service /validate
 */
async function validateKey(apiKey: string): Promise<{
  type: "app" | "user";
  appId?: string;
  orgId?: string;
} | null> {
  try {
    const result = await callExternalService<{
      valid: boolean;
      type: "app" | "user";
      appId?: string;
      orgId?: string;
    }>(
      externalServices.key,
      "/validate",
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!result.valid) return null;
    return result;
  } catch (error) {
    console.error("API key validation error:", error);
    return null;
  }
}

/**
 * Resolve external org/user IDs to internal UUIDs via client-service POST /resolve
 */
async function resolveExternalIds(
  appId: string,
  externalOrgId: string,
  externalUserId: string,
): Promise<{ orgId: string; userId: string } | null> {
  try {
    const result = await callExternalService<{
      orgId: string;
      userId: string;
    }>(
      externalServices.client,
      "/resolve",
      {
        method: "POST",
        body: { appId, externalOrgId, externalUserId },
      }
    );
    return result;
  } catch (error) {
    console.error("[auth] Failed to resolve external IDs:", (error as Error).message);
    return null;
  }
}

/**
 * Require organization context
 */
export function requireOrg(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.orgId) {
    return res.status(400).json({ error: "Organization context required" });
  }
  next();
}

/**
 * Require user context — must be used after authenticate.
 * Returns 401 if userId was not resolved during authentication.
 */
export function requireUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) {
    return res.status(401).json({ error: "User identity required" });
  }
  next();
}
