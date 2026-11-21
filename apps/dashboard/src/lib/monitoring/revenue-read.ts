import {
  ActiveUsersByUserSchema,
  BillingStatsSchema,
  FleetRevenueSchema,
  buildRevenueBoard,
  type FirstSeenMonthRow,
  type Part,
  type RevenueBoard,
} from "./revenue-series";
import type { z } from "zod";

/**
 * SERVER ONLY. The reads behind Monitoring > Revenue, made by the staff route
 * `/api/monitoring/revenue` (same pattern as Research's `live-file.ts`):
 *  - features-service through the api-service gateway (staff gate: admin key + the signed-in staff
 *    `x-email`): `/v1/features/audit/revenue`, `/v1/features/audit/active-users-by-user`;
 *  - billing-service's public cash totals `/public/stats/billing` (no key);
 *  - PostHog (personal key, server env): people bucketed by the month they were FIRST seen.
 * Each read settles on its own; a failure is stated on its block, never a zero.
 */
const API_URL = (process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you").replace(/\/$/, "");
const REVENUE_MONTHS_MAX = 36;
const REVENUE_WEEKS_MAX = 104;
const TIMEOUT_MS = 60_000;

async function settle<T>(name: string, run: () => Promise<T>): Promise<Part<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[monitoring/revenue] ${name} failed: ${message}`);
    return { ok: false, error: message };
  }
}

async function readJson<T>(name: string, url: string, schema: z.ZodType<T>, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${name} answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    console.error(`[monitoring/revenue] ${name}: response shape mismatch`, parsed.error.issues);
    throw new Error(`${name}: response shape mismatch`);
  }
  return parsed.data;
}

function staffHeaders(staffEmail: string): Record<string, string> {
  const key = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!key) throw new Error("ADMIN_DISTRIBUTE_API_KEY is not set");
  return { "X-API-Key": key, "x-email": staffEmail };
}

/**
 * Humans only, the same rule the admin metrics used: a visitor is dropped when any pageview carries
 * a headless fingerprint (desktop OS, viewport equal to the screen) or an internal identity.
 */
const HUMAN_VISITOR = `distinct_id NOT IN (
        SELECT distinct_id FROM events
        WHERE event = '$pageview'
          AND (
            (properties.$os IN ('Windows', 'Mac OS X', 'Linux', 'Chrome OS')
              AND properties.$screen_width = properties.$viewport_width
              AND properties.$screen_height = properties.$viewport_height)
            OR person.properties.email IN ('kevin.lourd@gmail.com', 'kevin@pressbeat.io')
            OR person.properties.email LIKE '%@distribute.you'
            OR person.properties.email LIKE 'kevin.lourd+%'
          )
      )`;

/** Each visitor in the month of their FIRST session (one month per person, never once per visit). */
const VISITOR_FIRST_SEEN_SQL = `
    SELECT month, count() AS visitors
    FROM (
      SELECT distinct_id, formatDateTime(min(\`$start_timestamp\`), '%Y-%m') AS month
      FROM sessions
      WHERE \`$entry_hostname\` = 'distribute.you'
      AND ${HUMAN_VISITOR}
      GROUP BY distinct_id
    )
    GROUP BY month
    ORDER BY month ASC
    LIMIT 500`;

/** Each person in the month they FIRST completed signup. */
const SIGNUP_FIRST_SEEN_SQL = `
    SELECT month, count() AS signups
    FROM (
      SELECT
        if(notEmpty(properties['$user_id']), properties['$user_id'], distinct_id) AS person,
        formatDateTime(min(timestamp), '%Y-%m') AS month
      FROM events
      WHERE event = 'signup_completed'
      GROUP BY person
    )
    GROUP BY month
    ORDER BY month ASC
    LIMIT 500`;

async function posthogMonths(sql: string): Promise<FirstSeenMonthRow[]> {
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  if (!projectId || !apiKey) throw new Error("POSTHOG_PROJECT_ID or POSTHOG_PERSONAL_API_KEY is not set");
  const host = (process.env.POSTHOG_API_HOST || "https://eu.posthog.com").replace("https://eu.i.posthog.com", "https://eu.posthog.com").replace(/\/$/, "");
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`PostHog query answered ${res.status}`);
  const body = (await res.json()) as { results?: unknown };
  if (!Array.isArray(body.results)) throw new Error("PostHog query answered no results array");
  return body.results.map((row) => {
    if (!Array.isArray(row) || typeof row[0] !== "string" || typeof row[1] !== "number") throw new Error("PostHog row is not [month, count]");
    return [row[0], row[1]];
  });
}

export async function readRevenueBoard(staffEmail: string): Promise<RevenueBoard> {
  const [revenue, activeUsers, billing, visitorFirstSeen, signupFirstSeen] = await Promise.all([
    settle("features /audit/revenue", () =>
      readJson("features /audit/revenue", `${API_URL}/v1/features/audit/revenue?months=${REVENUE_MONTHS_MAX}&weeks=${REVENUE_WEEKS_MAX}`, FleetRevenueSchema, staffHeaders(staffEmail)),
    ),
    settle("features /audit/active-users-by-user", () =>
      readJson("features /audit/active-users-by-user", `${API_URL}/v1/features/audit/active-users-by-user`, ActiveUsersByUserSchema, staffHeaders(staffEmail)),
    ),
    settle("billing /public/stats/billing", () => readJson("billing /public/stats/billing", `${API_URL}/public/stats/billing`, BillingStatsSchema, {})),
    settle("PostHog visitors first seen", () => posthogMonths(VISITOR_FIRST_SEEN_SQL)),
    settle("PostHog signups first seen", () => posthogMonths(SIGNUP_FIRST_SEEN_SQL)),
  ]);
  return buildRevenueBoard({ revenue, activeUsers, billing, visitorFirstSeen, signupFirstSeen }, new Date().toISOString());
}
