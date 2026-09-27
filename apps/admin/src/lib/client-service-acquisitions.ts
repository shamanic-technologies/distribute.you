import { AcquisitionListSchema, type AcquisitionList } from "./acquisition-breakdown";

/**
 * Reads client-service's first-touch list SERVER-side, on the compose network
 * (`http://client-service:8080`), with client-service's own key — the same way
 * the dashboard's server reaches it. Staff-only by construction: this runs in
 * the admin app, which is edge-gated to the allowlist.
 *
 * Fails loud: a missing key or a refused read throws, and the card states it.
 */
export async function fetchOrgAcquisitions(createdAfter: string): Promise<AcquisitionList> {
  const base = process.env.CLIENT_SERVICE_URL;
  const key = process.env.CLIENT_SERVICE_API_KEY;
  if (!base || !key) throw new Error("[acquisitions] CLIENT_SERVICE_URL / CLIENT_SERVICE_API_KEY not set");
  const res = await fetch(`${base}/internal/acquisitions?createdAfter=${encodeURIComponent(createdAfter)}`, {
    headers: { "x-api-key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`[acquisitions] client-service answered ${res.status}`);
  const parsed = AcquisitionListSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`[acquisitions] response shape mismatch: ${parsed.error.message}`);
  return parsed.data;
}
