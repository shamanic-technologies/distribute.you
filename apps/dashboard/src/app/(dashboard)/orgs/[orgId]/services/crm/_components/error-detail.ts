/**
 * Pull a human-readable detail string from an upstream error response body.
 *
 * Surfaces upstream config errors (e.g. "Missing GOOGLE_CLIENT_ID env var" from
 * google-service) so they become visible in the dashboard UI instead of being
 * collapsed into a generic status code.
 */
export function extractErrorDetail(rawBody: string, contentType: string | null): string | null {
  if (!rawBody) return null;
  if (contentType && contentType.includes("application/json")) {
    const parsed = JSON.parse(rawBody) as {
      error?: string;
      detail?: string;
      message?: string;
    };
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
    if (typeof parsed.detail === "string" && parsed.detail) return parsed.detail;
    if (typeof parsed.message === "string" && parsed.message) return parsed.message;
    return null;
  }
  return rawBody.slice(0, 500);
}
