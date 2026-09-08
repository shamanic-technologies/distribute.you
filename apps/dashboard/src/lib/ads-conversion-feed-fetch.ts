import { z } from "zod";
import { SERVICE_IDENTITY } from "./service-identity";
import {
  conversionRowsForOrg,
  conversionRowsToCsv,
  type AttributedOrg,
  type ConversionRow,
  type PaidTopUp,
} from "./ads-conversion-feed";

/**
 * The network half of the offline-conversion feed: every org Clerk holds a gclid
 * for, joined to that org's paid top-ups off api-service's own billing read.
 * The pure row/CSV logic lives in `ads-conversion-feed.ts` (alias-free, unit
 * tested); this module only fetches and hands over.
 *
 * Identity: the payments read goes through the api-service admin path, which
 * upserts a `users` row for whatever `x-external-user-id` it is handed — so the
 * job sends the ONE `system-` principal from `service-identity.ts`, never an id
 * keyed on the org (that shape produced 89 phantom users once).
 */

const CLERK_API_URL = "https://api.clerk.com/v1";
const PAGE_LIMIT = 100;
const ORG_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 60_000;

export interface FeedConfig {
  apiUrl: string;
  adminApiKey: string;
  clerkSecretKey: string;
  feedToken: string;
}

export type FeedFetch = typeof fetch;

export function adsConversionFeedConfigFromEnv(): FeedConfig {
  return {
    apiUrl: requireEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL").replace(/\/$/, ""),
    adminApiKey: requireEnv("ADMIN_DISTRIBUTE_API_KEY"),
    clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
    feedToken: requireEnv("ADS_CONVERSION_FEED_TOKEN"),
  };
}

/** The Ads Script authenticates with a bearer token; nothing else reads this. */
export function verifyFeedRequest(req: Request, config: FeedConfig): boolean {
  return req.headers.get("authorization") === `Bearer ${config.feedToken}`;
}

const ClerkOrganizationsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      public_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    }),
  ),
  total_count: z.number(),
});

const PaymentsResponseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        status: z.string(),
        created: z.coerce.number(),
        amount: z.coerce.number(),
        amount_returned: z.coerce.number(),
      })
      .passthrough(),
  ),
});

export interface FeedResult {
  attributedOrgs: number;
  rows: ConversionRow[];
  csv: string;
}

export async function buildAdsConversionFeed(
  config: FeedConfig,
  since: Date,
  fetchFn: FeedFetch = fetch,
): Promise<FeedResult> {
  const orgs = await listAttributedOrgs(config, fetchFn);
  const rows: ConversionRow[] = [];
  for (let i = 0; i < orgs.length; i += ORG_CONCURRENCY) {
    const batch = orgs.slice(i, i + ORG_CONCURRENCY);
    const perOrg = await Promise.all(
      batch.map(async (org) => conversionRowsForOrg(org, await listPaidTopUps(config, fetchFn, org.orgId), since)),
    );
    for (const r of perOrg) rows.push(...r);
  }
  rows.sort((a, b) => a.conversionTime.getTime() - b.conversionTime.getTime());
  return { attributedOrgs: orgs.length, rows, csv: conversionRowsToCsv(rows) };
}

async function listAttributedOrgs(config: FeedConfig, fetchFn: FeedFetch): Promise<AttributedOrg[]> {
  const out: AttributedOrg[] = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const data = await fetchJson(
      `${CLERK_API_URL}/organizations?limit=${PAGE_LIMIT}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${config.clerkSecretKey}` } },
      fetchFn,
      ClerkOrganizationsResponseSchema,
      "listOrganizations",
    );
    if (data.data.length === 0 && offset < data.total_count) {
      throw new Error("[dashboard-ads-feed] listOrganizations returned an empty non-terminal page");
    }
    for (const o of data.data) {
      const gclid = o.public_metadata?.gclid;
      const gclidAt = o.public_metadata?.gclidAt;
      if (typeof gclid !== "string" || typeof gclidAt !== "string") continue;
      const at = new Date(gclidAt);
      if (Number.isNaN(at.getTime())) {
        console.error(`[dashboard-ads-feed] org=${o.id} carries an unparseable gclidAt: ${gclidAt}`);
        continue;
      }
      out.push({ orgId: o.id, gclid, gclidAt: at });
    }
    if (offset + data.data.length >= data.total_count) break;
  }
  return out;
}

async function listPaidTopUps(config: FeedConfig, fetchFn: FeedFetch, orgId: string): Promise<PaidTopUp[]> {
  const data = await fetchJson(
    `${config.apiUrl}/v1/billing/payments`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.adminApiKey,
        "x-external-org-id": orgId,
        "x-external-user-id": SERVICE_IDENTITY.adsConversionFeed,
      },
    },
    fetchFn,
    PaymentsResponseSchema,
    "listPayments",
  );
  return data.data
    .filter((p) => p.status === "succeeded")
    .map((p) => ({ id: p.id, created: p.created, netCents: p.amount - p.amount_returned }));
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fetchFn: FeedFetch,
  schema: z.ZodSchema<T>,
  label: string,
): Promise<T> {
  const res = await fetchFn(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[dashboard-ads-feed] ${label} ${res.status}: ${body.slice(0, 300)}`);
  }
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    console.error(`[dashboard-ads-feed] ${label} response shape mismatch`, { issues: parsed.error.issues });
    throw new Error(`[dashboard-ads-feed] ${label}: invalid response shape`);
  }
  return parsed.data;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[dashboard-ads-feed] ${name} is required`);
  return value;
}
