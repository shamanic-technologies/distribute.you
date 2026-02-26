import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { callService, services, callExternalService, externalServices } from "../lib/service-client.js";

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

      // Resolve Clerk IDs to internal UUIDs via client-service
      const resolved = await resolveClerkIds(clerkUserId, clerkOrgId);
      req.userId = resolved.userId || clerkUserId;
      req.orgId = resolved.orgId || clerkOrgId;
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
 * Falls back to Clerk IDs if client-service is unavailable.
 */
async function resolveClerkIds(
  clerkUserId: string,
  clerkOrgId?: string
): Promise<{ userId: string | null; orgId: string | null }> {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const [userResult, orgResult] = await Promise.all([
      callService<{ user: { id: string } }>(
        services.client,
        `/users/by-clerk/${clerkUserId}`
      ).catch(() => null),
      clerkOrgId
        ? callService<{ org: { id: string } }>(
            services.client,
            `/orgs/by-clerk/${clerkOrgId}`
          ).catch(() => null)
        : null,
    ]);

    if (userResult?.user?.id) userId = userResult.user.id;
    if (orgResult?.org?.id) orgId = orgResult.org.id;
  } catch (error) {
    console.warn("[auth] Failed to resolve Clerk IDs via client-service:", (error as Error).message);
  }

  return { userId, orgId };
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
