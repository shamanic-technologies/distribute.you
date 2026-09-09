import { z } from "zod";
import { SERVICE_IDENTITY } from "./service-identity";
import {
  conversionRowsForOrg,
  conversionRowsForSignUpPageViews,
  conversionRowsToCsv,
  type AttributedOrg,
  type ConversionRow,
  type PaidTopUp,
  type SignUpPageView,
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
const DEFAULT_POSTHOG_API_HOST = "https://eu.posthog.com";
const PAGE_LIMIT = 100;
const ORG_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 60_000;

export interface FeedConfig {
  apiUrl: string;
  adminApiKey: string;
  clerkSecretKey: string;
  feedToken: string;
  posthogApiHost: string;
  posthogProjectId: string;
  posthogPersonalApiKey: string;
}

export type FeedFetch = typeof fetch;

export function adsConversionFeedConfigFromEnv(): FeedConfig {
  return {
    apiUrl: requireEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL").replace(/\/$/, ""),
    adminApiKey: requireEnv("ADMIN_DISTRIBUTE_API_KEY"),
    clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
    feedToken: requireEnv("ADS_CONVERSION_FEED_TOKEN"),
    // The ingestion host the browser posts to is a first-party proxy
    // (`e.distribute.you`) and the personal-API host is not the same thing, so
    // the API host is its own var rather than derived from NEXT_PUBLIC_POSTHOG_HOST.
    posthogApiHost: normalizePostHogHost(process.env.POSTHOG_API_HOST || DEFAULT_POSTHOG_API_HOST),
    posthogProjectId: requireEnv("POSTHOG_PROJECT_ID"),
    posthogPersonalApiKey: requireEnv("POSTHOG_PERSONAL_API_KEY"),
  };
}

function normalizePostHogHost(host: string): string {
  return host.replace("https://eu.i.posthog.com", "https://eu.posthog.com").replace(/\/$/, "");
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
  /** Orgs whose payments read failed; their signup row still ships. */
  failedOrgs: number;
  /** Sessions that reached /sign-up carrying a gclid, i.e. micro-conversions. */
  signUpPageViews: number;
  rows: ConversionRow[];
  csv: string;
}

export async function buildAdsConversionFeed(
  config: FeedConfig,
  since: Date,
  fetchFn: FeedFetch = fetch,
): Promise<FeedResult> {
  // FAIL LOUD, deliberately not per-source like the per-org payments read below:
  // a PostHog outage that degraded to an empty set would hand the Ads Script a
  // file that reads as "nobody reached the sign-up page", which Google cannot
  // tell apart from a real zero. A 500 makes the Script skip the upload instead.
  const pageViews = await listSignUpPageViews(config, since, fetchFn);
  const orgs = await listAttributedOrgs(config, fetchFn);
  const rows: ConversionRow[] = conversionRowsForSignUpPageViews(pageViews, since);
  let failedOrgs = 0;
  for (let i = 0; i < orgs.length; i += ORG_CONCURRENCY) {
    const batch = orgs.slice(i, i + ORG_CONCURRENCY);
    const perOrg = await Promise.all(
      batch.map(async (org) => {
        // One org's payments read failing must not empty the whole feed: an org
        // that never reached checkout has no billing account, and api-service
        // answers that with a 5xx. Loud (the failure is named, and the count
        // rides the response) but per-org — the signup row for THIS org is
        // already correct, and every other org's is untouched. Aborting here
        // would hand Google an empty CSV over one org's missing account.
        let payments: PaidTopUp[] = [];
        try {
          payments = await listPaidTopUps(config, fetchFn, org.orgId);
        } catch (err) {
          failedOrgs += 1;
          console.error(`[dashboard-ads-feed] org=${org.orgId} payments unavailable, purchases omitted:`, err);
        }
        return conversionRowsForOrg(org, payments, since);
      }),
    );
    for (const r of perOrg) rows.push(...r);
  }
  rows.sort((a, b) => a.conversionTime.getTime() - b.conversionTime.getTime());
  return {
    attributedOrgs: orgs.length,
    failedOrgs,
    signUpPageViews: pageViews.length,
    rows,
    csv: conversionRowsToCsv(rows),
  };
}

const PostHogQueryResponseSchema = z.object({
  results: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});

/**
 * Every session that reached `/sign-up` carrying a Google click, read out of
 * PostHog with HogQL.
 *
 * The join is the one that works against the live data: a `$pageview` on
 * `/sign-up`, and a `$pageview` on the SAME `$session_id` whose `$current_url`
 * carries a `gclid` (the landing entry). One scan, grouped by session, rather
 * than a self-join on `events` — `argMinIf` takes the FIRST gclid of the
 * session (first touch, matching how the org-level attribution is recorded) and
 * `minIf` the first sign-up view.
 *
 * A session with no gclid, or with no sign-up view, is filtered by the HAVING;
 * a null session id is excluded in the WHERE, because grouping on it would fold
 * unrelated events into one bogus row.
 */
async function listSignUpPageViews(
  config: FeedConfig,
  since: Date,
  fetchFn: FeedFetch,
): Promise<SignUpPageView[]> {
  const query = `
    SELECT
      properties.$session_id AS sid,
      argMinIf(
        extractURLParameter(properties.$current_url, 'gclid'),
        timestamp,
        coalesce(extractURLParameter(properties.$current_url, 'gclid'), '') != ''
      ) AS gclid,
      minIf(timestamp, properties.$pathname LIKE '%sign-up%') AS signup_at
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= toDateTime('${formatClickHouseTime(since)}')
      AND properties.$session_id IS NOT NULL
    GROUP BY sid
    HAVING coalesce(gclid, '') != '' AND countIf(properties.$pathname LIKE '%sign-up%') > 0
    ORDER BY signup_at ASC
    LIMIT 10000
  `;
  const data = await fetchJson(
    `${config.posthogApiHost}/api/projects/${config.posthogProjectId}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.posthogPersonalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    },
    fetchFn,
    PostHogQueryResponseSchema,
    "signUpPageViews",
  );
  const out: SignUpPageView[] = [];
  for (const row of data.results) {
    const [sessionId, gclid, viewedAt] = row;
    if (typeof sessionId !== "string" || typeof gclid !== "string" || typeof viewedAt !== "string") {
      console.error("[dashboard-ads-feed] signUpPageViews row shape mismatch", { row });
      continue;
    }
    // PostHog returns a naive `YYYY-MM-DDTHH:mm:ss.SSS` in the project's own
    // timezone marker-free form; it is UTC, so state it rather than letting the
    // server's local zone decide.
    const at = new Date(viewedAt.endsWith("Z") ? viewedAt : `${viewedAt}Z`);
    if (Number.isNaN(at.getTime())) {
      console.error(`[dashboard-ads-feed] signUpPageViews unparseable timestamp: ${viewedAt}`);
      continue;
    }
    out.push({ sessionId, gclid, viewedAt: at });
  }
  return out;
}

/** `YYYY-MM-DD HH:mm:ss`, UTC — what ClickHouse `toDateTime()` reads. */
function formatClickHouseTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
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
