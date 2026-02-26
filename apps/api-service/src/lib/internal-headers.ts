import { AuthenticatedRequest } from "../middleware/auth.js";

/**
 * Build headers for internal service-to-service calls
 * Convention:
 * - x-org-id: Always required
 * - x-user-id: Optional (provided if available)
 */
export function buildInternalHeaders(req: AuthenticatedRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "x-org-id": req.orgId!,
  };
  if (req.userId) {
    headers["x-user-id"] = req.userId;
  }
  return headers;
}
