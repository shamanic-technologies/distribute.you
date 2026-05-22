import { URLS } from "@distribute/content";

export interface PlatformPrice {
  name: string;
  pricePerUnitInUsdCents: string;
  provider: string;
  providerDomain: string | null;
  type: string;
  unit: string;
  effectiveFrom: string;
}

export interface ProviderGroup {
  provider: string;
  providerDomain: string | null;
  rows: PlatformPrice[];
}

function resolveApiUrl(hostname: string): string {
  if (process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL) {
    return process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL;
  }
  if (hostname.includes("staging")) {
    return URLS.api.replace("://api.", "://api-staging.");
  }
  return URLS.api;
}

/**
 * Fetch live unit costs from api-service. No fallback — caller renders error UI on throw.
 */
export async function fetchPlatformPrices(hostname: string): Promise<PlatformPrice[]> {
  const baseUrl = resolveApiUrl(hostname);
  const url = `${baseUrl}/v1/costs/platform-prices`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[landing] /v1/costs/platform-prices returned ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Group rows by provider, sort providers alphabetically, sort rows within group by type.
 * Provider name is used as group key; providerDomain is taken from the first row in the group.
 */
export function groupByProvider(rows: PlatformPrice[]): ProviderGroup[] {
  const map = new Map<string, ProviderGroup>();
  for (const row of rows) {
    const existing = map.get(row.provider);
    if (existing) {
      existing.rows.push(row);
    } else {
      map.set(row.provider, {
        provider: row.provider,
        providerDomain: row.providerDomain,
        rows: [row],
      });
    }
  }
  const groups = Array.from(map.values()).sort((a, b) => a.provider.localeCompare(b.provider));
  for (const group of groups) {
    group.rows.sort((a, b) => a.type.localeCompare(b.type));
  }
  return groups;
}

/**
 * Format pricePerUnitInUsdCents (decimal-string cents) as a readable dollar string.
 * Always uses $ notation — never cents — because users misread "0.0006 ¢" as "$0.0006".
 * $1+: 2 decimals. $0.01–$1: 4 decimals. Below $0.01: 6 decimals.
 */
export function formatPrice(pricePerUnitInUsdCents: string): string {
  const cents = parseFloat(pricePerUnitInUsdCents);
  if (!Number.isFinite(cents)) {
    throw new Error(`[landing] formatPrice: non-numeric pricePerUnitInUsdCents "${pricePerUnitInUsdCents}"`);
  }
  if (cents === 0) return "$0";
  const dollars = cents / 100;
  if (dollars >= 1) {
    return `$${dollars.toFixed(2)}`;
  }
  if (dollars >= 0.01) {
    return `$${dollars.toFixed(4)}`;
  }
  return `$${dollars.toFixed(6)}`;
}
