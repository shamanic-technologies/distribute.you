import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { callExternalService, callService, externalServices, services } from "../lib/service-client.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  orgId?: string;
  authType?: "jwt" | "api_key";
}

/**
 * Authenticate via Clerk JWT or API Key
 * - Bearer token: Clerk JWT (from dashboard) → resolved to internal UUIDs via client-service
 * - X-API-Key: API key (from MCP/external clients) → resolved to internal UUIDs via key-service
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers["x-api-key"] as string | undefined;

    // Try API Key first (for MCP clients)
    if (apiKey) {
      const validation = await validateApiKey(apiKey);
      if (validation) {
        req.userId = validation.userId || undefined;
        req.orgId = validation.orgId;
        req.authType = "api_key";
        return next();
      }
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Try Clerk JWT (for dashboard)
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      const clerkUserId = payload.sub;
      // Handle both JWT v1 (org_id) and v2 (o.id) formats
      const orgClaim = payload.o as { id?: string } | undefined;
      const clerkOrgId = payload.org_id || orgClaim?.id;

      // Resolve Clerk IDs to internal UUIDs via client-service (auto-syncs if not found)
      const resolved = await resolveClerkIds(clerkUserId, clerkOrgId, token);

      if (!resolved.userId && !resolved.orgId) {
        console.error("[auth] Failed to resolve Clerk IDs — client-service unavailable or returned empty");
        return res.status(502).json({ error: "Identity resolution failed" });
      }

      req.userId = resolved.userId || undefined;
      req.orgId = resolved.orgId || undefined;
      req.authType = "jwt";

      return next();
    }

    return res.status(401).json({ error: "Missing authentication" });
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Invalid authentication" });
  }
}

/**
 * Resolve Clerk IDs to internal UUIDs via client-service.
 * Tries lookup first (GET /by-clerk/...), then auto-syncs via POST /users/sync
 * or POST /orgs/sync if the user/org doesn't exist yet.
 */
async function resolveClerkIds(
  clerkUserId: string,
  clerkOrgId?: string,
  clerkJwt?: string
): Promise<{ userId: string | null; orgId: string | null }> {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const [userResult, orgResult] = await Promise.all([
      resolveUser(clerkUserId, clerkJwt),
      clerkOrgId ? resolveOrg(clerkOrgId, clerkJwt) : null,
    ]);

    if (userResult?.user?.id) userId = userResult.user.id;
    if (orgResult?.org?.id) orgId = orgResult.org.id;
  } catch (error) {
    console.error("[auth] Failed to resolve Clerk IDs via client-service:", (error as Error).message);
  }

  return { userId, orgId };
}

/** Lookup user by Clerk ID; on 404, auto-provision via /users/sync */
async function resolveUser(
  clerkUserId: string,
  clerkJwt?: string
): Promise<{ user: { id: string } } | null> {
  try {
    return await callExternalService<{ user: { id: string } }>(
      externalServices.client,
      `/users/by-clerk/${clerkUserId}`
    );
  } catch (lookupErr: any) {
    if (!lookupErr.message?.includes("404") || !clerkJwt) {
      console.error("[auth] Failed to resolve Clerk user:", lookupErr.message);
      return null;
    }
    // User not in client-service yet — auto-sync
    try {
      console.log(`[auth] User ${clerkUserId} not found, auto-syncing via client-service`);
      const syncResult = await callService<{ user: { id: string }; created: boolean }>(
        services.client,
        "/users/sync",
        { method: "POST", headers: { Authorization: `Bearer ${clerkJwt}` } }
      );
      console.log(`[auth] User synced: ${syncResult.user.id} (created=${syncResult.created})`);
      return { user: syncResult.user };
    } catch (syncErr: any) {
      console.error("[auth] User sync failed:", syncErr.message);
      return null;
    }
  }
}

/** Lookup org by Clerk ID; on 404, auto-provision via /orgs/sync */
async function resolveOrg(
  clerkOrgId: string,
  clerkJwt?: string
): Promise<{ org: { id: string } } | null> {
  try {
    return await callExternalService<{ org: { id: string } }>(
      externalServices.client,
      `/orgs/by-clerk/${clerkOrgId}`
    );
  } catch (lookupErr: any) {
    if (!lookupErr.message?.includes("404") || !clerkJwt) {
      console.error("[auth] Failed to resolve Clerk org:", lookupErr.message);
      return null;
    }
    // Org not in client-service yet — auto-sync
    try {
      console.log(`[auth] Org ${clerkOrgId} not found, auto-syncing via client-service`);
      const syncResult = await callService<{ org: { id: string }; created: boolean }>(
        services.client,
        "/orgs/sync",
        { method: "POST", headers: { Authorization: `Bearer ${clerkJwt}` } }
      );
      console.log(`[auth] Org synced: ${syncResult.org.id} (created=${syncResult.created})`);
      return { org: syncResult.org };
    } catch (syncErr: any) {
      console.error("[auth] Org sync failed:", syncErr.message);
      return null;
    }
  }
}

/**
 * Validate API key against keys-service
 * Returns orgId and userId (internal UUIDs from client-service)
 */
async function validateApiKey(apiKey: string): Promise<{ userId: string | null; orgId: string } | null> {
  try {
    const result = await callExternalService<{
      valid: boolean;
      orgId?: string;
      userId?: string | null;
    }>(
      externalServices.key,
      "/validate",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (result.valid && result.orgId) {
      return {
        userId: result.userId || null,
        orgId: result.orgId,
      };
    }
    return null;
  } catch (error) {
    console.error("API key validation error:", error);
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
