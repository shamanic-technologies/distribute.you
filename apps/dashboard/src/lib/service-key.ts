/**
 * Service-to-service auth for the dashboard's `/api/internal/*` routes: a backend service on the
 * box (social-service today) sends `x-api-key: <DASHBOARD_APP_API_KEY>`, the fleet convention
 * (`<SERVICE>_API_KEY`, the dashboard's compose service being `dashboard-app`). These routes
 * carry no Clerk session, so this check is their only boundary.
 *
 * Fails LOUD when the key is not configured (a thrown error, the route answers 500), never an
 * open route. Constant-time comparison. Alias-free so it carries real unit tests.
 */
import { timingSafeEqual } from "node:crypto";

export const SERVICE_KEY_ENV = "DASHBOARD_APP_API_KEY";

export function verifyServiceKey(req: Request): boolean {
  const expected = process.env[SERVICE_KEY_ENV];
  if (!expected || expected.trim() === "") throw new Error(`[dashboard] ${SERVICE_KEY_ENV} is required`);
  const got = req.headers.get("x-api-key");
  if (!got) return false;
  const a = Buffer.from(got.trim());
  const b = Buffer.from(expected.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}
