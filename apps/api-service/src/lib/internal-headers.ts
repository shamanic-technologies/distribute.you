import { AuthenticatedRequest } from "../middleware/auth.js";

/**
 * Build headers for internal service-to-service calls
 * Convention:
 * - x-org-id: Always required (internal UUID from client-service)
 * - x-user-id: Optional (provided if available)
 */
export function buildInternalHeaders(req: AuthenticatedRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "x-org-id": req.orgId!,
  };
  if (req.userId) {
    headers["x-user-id"] = req.userId;
  }
  if (req.appId) {
    headers["x-app-id"] = req.appId;
  }
  return headers;
}
