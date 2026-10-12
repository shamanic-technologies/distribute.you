import { z } from "zod";
import { isStaffEmail } from "./owner-ping";
import {
  firmographicLines,
  RETURNING_LOOKBACK_DAYS,
  visitClerkUserId,
  visitPerson,
  visitRecap,
  type ReturningVisit,
  type VisitAccount,
  type VisitEvent,
} from "./visit-recap";

/**
 * Every 5 minutes, finds the visits that ended 30 to 40 minutes ago (PostHog
 * closes a session after 30 idle minutes) and either reached onboarding or came
 * from someone who had visited before (another session of the same PostHog
 * person in the last 90 days, on any surface), and sends the owner one Telegram
 * recap per visit (`visit-recap.ts` builds the text).
 *
 * Humans only: PostHog runs in the browser, so a scanner that runs no JavaScript
 * never appears, and the visits the morning brief already treats as machines or
 * as us are dropped here with the same rules (staff emails, a headless browser
 * whose window equals its screen, the known scanner fingerprint).
 *
 * The 10-minute window is read twice per visit (5-minute tick), so a set of
 * sent visits stops the second send. It lives in memory: a restart in the middle
 * can drop or repeat one recap, which is fine for a message only the owner reads.
 */

const DEFAULT_POSTHOG_API_HOST = "https://eu.posthog.com";
const TICK_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_VISITS_PER_TICK = 20;

const EMAIL = "lower(coalesce(person.properties.email, ''))";
// The owner never gets a recap of himself (owner 2026-10-07), by email or by name.
const INTERNAL = `(${EMAIL} in ('kevin.lourd@gmail.com', 'kevin@pressbeat.io') or ${EMAIL} like '%@distribute.you' or ${EMAIL} like 'kevin.lourd+%' or lower(coalesce(person.properties.name, '')) = 'kevin lourd')`;
const HEADLESS =
  "(properties.$os in ('Windows', 'Mac OS X', 'Linux', 'Chrome OS') and properties.$screen_width = properties.$viewport_width and properties.$screen_height = properties.$viewport_height)";
const SCANNER =
  `(empty(${EMAIL}) and properties.$os = 'Mac OS X' and properties.$browser = 'Chrome' and properties.$screen_width = 1680)`;

// One row per ended human visit: its id, how many earlier visits the same person
// made, when the last one ended. A visit with no earlier one is sent only when it
// reached onboarding; one whose last visit ended under 30 minutes earlier is the
// same sitting (a second tab), not a return. A visit made before logging in carries
// no email at the time, so a person who was staff in ANY of their sessions is dropped.
export const ENDED_VISITS_SQL = `
select e.sid,
  countIf(p.sid != e.sid and p.started < e.started) as prior_visits,
  maxIf(p.ended_at, p.sid != e.sid and p.started < e.started) as last_seen,
  any(e.onboarding) as onboarding,
  any(e.ended_at) as ended,
  any(e.started) as visit_started
from (
  select $session_id as sid, any(person_id) as pid, min(timestamp) as started, max(timestamp) as ended_at,
    countIf(event = '$pageview' and properties.$host = 'dashboard.distribute.you' and properties.$pathname in ('/get-started', '/onboarding')) as onboarding
  from events
  where timestamp > now() - interval 1 day and $session_id != ''
  group by sid
  having ended_at between now() - interval 40 minute and now() - interval 30 minute
    and countIf(${INTERNAL} or ${HEADLESS} or ${SCANNER}) = 0
) as e
left join (
  select person_id as pid, $session_id as sid, min(timestamp) as started, max(timestamp) as ended_at,
    countIf(${INTERNAL}) as staff
  from events
  where timestamp > now() - interval ${RETURNING_LOOKBACK_DAYS} day and $session_id != ''
  group by pid, sid
) as p on p.pid = e.pid
group by e.sid
having sum(p.staff) = 0
  and (onboarding > 0 or (prior_visits > 0 and last_seen < visit_started - interval 30 minute))
order by ended
limit ${MAX_VISITS_PER_TICK}`;

/** An ended visit, and its earlier visits when the visitor is coming back. */
export function rowToVisit(row: unknown[]): { sessionId: string; returning: ReturningVisit | null } {
  const priorVisits = Number(row[1]);
  if (!Number.isFinite(priorVisits)) throw new Error(`ended visit row has no prior visit count: ${JSON.stringify(row)}`);
  if (priorVisits === 0) return { sessionId: String(row[0]), returning: null };
  if (typeof row[2] !== "string" || Number.isNaN(Date.parse(row[2]))) {
    throw new Error(`returning visit row has no last-seen time: ${JSON.stringify(row)}`);
  }
  return { sessionId: String(row[0]), returning: { priorVisits, lastSeenAt: row[2] } };
}

function visitEventsSql(sessionIds: string[]): string {
  const ids = sessionIds.map((id) => `'${id.replace(/[^A-Za-z0-9-]/g, "")}'`).join(", ");
  return `
select $session_id, timestamp, event, properties.$host, properties.$pathname, properties.$current_url,
  properties.$el_text, properties.title, properties.$geoip_country_code, properties.$referring_domain,
  properties.utm_source, properties.utm_medium, properties.utm_term, properties.gclid,
  coalesce(properties.website, properties.domain), person.properties.email, person.properties.name,
  properties.topup_usd, distinct_id
from events
where timestamp > now() - interval 1 day and $session_id in (${ids})
  and event not in ('$web_vitals', '$exception', '$set', '$identify', 'landing_variant_viewed')
order by timestamp
limit 10000`;
}

interface Config {
  apolloServiceUrl: string;
  apolloServiceApiKey: string;
  clientServiceUrl: string;
  clientServiceApiKey: string;
  brandServiceUrl: string;
  brandServiceApiKey: string;
  posthogApiHost: string;
  posthogProjectId: string;
  posthogPersonalApiKey: string;
  telegramToken: string;
  telegramChatId: string;
}

function configFromEnv(): Config | null {
  const env = {
    apolloServiceUrl: process.env.APOLLO_SERVICE_URL?.trim(),
    apolloServiceApiKey: process.env.APOLLO_SERVICE_API_KEY?.trim(),
    clientServiceUrl: process.env.CLIENT_SERVICE_URL?.trim(),
    clientServiceApiKey: process.env.CLIENT_SERVICE_API_KEY?.trim(),
    brandServiceUrl: process.env.BRAND_SERVICE_URL?.trim(),
    brandServiceApiKey: process.env.BRAND_SERVICE_API_KEY?.trim(),
    posthogProjectId: process.env.POSTHOG_PROJECT_ID?.trim(),
    posthogPersonalApiKey: process.env.POSTHOG_PERSONAL_API_KEY?.trim(),
    telegramToken: process.env.TELEGRAM_BOT_TOKEN?.trim(),
    telegramChatId: process.env.TELEGRAM_OWNER_CHAT_ID?.trim(),
  };
  const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`[dashboard/visit-recap] not started, missing env: ${missing.join(", ")}`);
    return null;
  }
  return {
    apolloServiceUrl: env.apolloServiceUrl!.replace(/\/$/, ""),
    apolloServiceApiKey: env.apolloServiceApiKey!,
    clientServiceUrl: env.clientServiceUrl!.replace(/\/$/, ""),
    clientServiceApiKey: env.clientServiceApiKey!,
    brandServiceUrl: env.brandServiceUrl!.replace(/\/$/, ""),
    brandServiceApiKey: env.brandServiceApiKey!,
    posthogApiHost: (process.env.POSTHOG_API_HOST || DEFAULT_POSTHOG_API_HOST)
      .replace("https://eu.i.posthog.com", "https://eu.posthog.com")
      .replace(/\/$/, ""),
    posthogProjectId: env.posthogProjectId!,
    posthogPersonalApiKey: env.posthogPersonalApiKey!,
    telegramToken: env.telegramToken!,
    telegramChatId: env.telegramChatId!,
  };
}

async function hogql(config: Config, query: string): Promise<unknown[][]> {
  const res = await fetch(`${config.posthogApiHost}/api/projects/${config.posthogProjectId}/query/`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.posthogPersonalApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`PostHog query ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { results?: unknown[][] };
  if (!Array.isArray(body.results)) throw new Error("PostHog query answered no results array");
  return body.results;
}

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export function rowToEvent(row: unknown[]): { sessionId: string; event: VisitEvent } {
  return {
    sessionId: String(row[0]),
    event: {
      timestamp: String(row[1]),
      event: String(row[2]),
      host: str(row[3]),
      pathname: str(row[4]),
      currentUrl: str(row[5]),
      elText: str(row[6]),
      title: str(row[7]),
      country: str(row[8]),
      referringDomain: str(row[9]),
      utmSource: str(row[10]),
      utmMedium: str(row[11]),
      utmTerm: str(row[12]),
      gclid: str(row[13]),
      website: str(row[14]),
      email: str(row[15]),
      personName: str(row[16]),
      topupUsd: typeof row[17] === "number" && Number.isFinite(row[17]) ? row[17] : null,
      distinctId: str(row[18]),
    },
  };
}

const RangeSchema = z.object({ label: z.string() }).nullable();
const FirmographicsResponseSchema = z.object({
  domain: z.string(),
  company: z
    .object({
      countryCode: z.string().nullable(),
      industry: z.string().nullable(),
      revenueRange: RangeSchema,
      employeeRange: RangeSchema,
      category: z.string().nullable(),
    })
    .nullable(),
  noCompanyReason: z.string().nullable(),
  person: z.object({ title: z.string().nullable() }).nullable(),
});
type FirmographicsResponse = z.infer<typeof FirmographicsResponseSchema>;

/** The company block of a recap, from apollo-service's answer. */
export function companyLines(res: FirmographicsResponse, email: string | null = null): string[] {
  if (!res.company) {
    return res.noCompanyReason === "personal_email_domain" ? [] : [`No company found for ${res.domain}`];
  }
  return firmographicLines({
    hqCountry: res.company.countryCode,
    industry: res.company.industry,
    employeeRange: res.company.employeeRange?.label ?? null,
    revenueRange: res.company.revenueRange?.label ?? null,
    category: res.company.category,
    role: res.person?.title ?? null,
  }, email);
}

/**
 * Who the company behind the visit is (owner 2026-10-04): apollo-service's
 * org-less, platform-billed read, cached per domain and per person. A failed
 * lookup is stated in the recap, never hidden.
 */
async function lookupCompany(config: Config, events: VisitEvent[], account: VisitAccount | null): Promise<string[]> {
  const person = visitPerson(events, account);
  if (!person) return [];
  const body: Record<string, string> = { domain: person.domain };
  if (person.email) body.email = person.email;
  if (person.firstName && person.lastName) {
    body.firstName = person.firstName;
    body.lastName = person.lastName;
  }
  try {
    const res = await fetch(`${config.apolloServiceUrl}/internal/company-firmographics`, {
      method: "POST",
      headers: { "x-api-key": config.apolloServiceApiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`apollo-service ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const parsed = FirmographicsResponseSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error(`apollo-service answered an unexpected shape: ${parsed.error.message}`);
    return companyLines(parsed.data, person.email);
  } catch (err) {
    console.error(`[dashboard/visit-recap] company lookup failed for ${person.domain}:`, err);
    return [`Company lookup failed for ${person.domain}`];
  }
}

const ResolveResponseSchema = z.object({ orgId: z.string() });
const OrgBrandsResponseSchema = z.object({
  brands: z.array(z.object({ name: z.string().nullable(), domain: z.string().nullable() })),
});

/**
 * Who a signed-in visitor is and which brands their orgs hold (owner 2026-10-12),
 * from the Clerk user id the visit carries: Clerk for the name, email and orgs,
 * client-service for each org's internal id, brand-service for its brands. Null
 * (and logged) when any hop fails: the recap then says the account was not found.
 */
async function lookupAccount(config: Config, clerkUserId: string): Promise<VisitAccount | null> {
  try {
    // Imported here so the pure helpers of this module load in unit tests without Clerk.
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(clerkUserId);
    const memberships = await clerk.users.getOrganizationMembershipList({ userId: clerkUserId, limit: 20 });
    const brands: VisitAccount["brands"] = [];
    for (const m of memberships.data) {
      const resolved = await fetch(`${config.clientServiceUrl}/internal/resolve`, {
        method: "POST",
        headers: { "x-api-key": config.clientServiceApiKey, "content-type": "application/json" },
        body: JSON.stringify({ externalOrgId: m.organization.id, externalUserId: clerkUserId }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!resolved.ok) throw new Error(`client-service resolve ${resolved.status}: ${(await resolved.text()).slice(0, 300)}`);
      const { orgId } = ResolveResponseSchema.parse(await resolved.json());
      const res = await fetch(`${config.brandServiceUrl}/orgs/brands`, {
        headers: { "x-api-key": config.brandServiceApiKey, "x-org-id": orgId },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`brand-service /orgs/brands ${res.status}: ${(await res.text()).slice(0, 300)}`);
      for (const b of OrgBrandsResponseSchema.parse(await res.json()).brands) {
        if (!brands.some((x) => x.domain === b.domain && x.name === b.name)) brands.push(b);
      }
    }
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
    return { name, email: user.primaryEmailAddress?.emailAddress ?? null, brands };
  } catch (err) {
    console.error(`[dashboard/visit-recap] account lookup failed for ${clerkUserId}:`, err);
    return null;
  }
}

async function sendTelegram(config: Config, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegramChatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const sent = new Map<string, number>();
let running = false;

async function tick(config: Config): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    for (const [id, at] of sent) if (now - at > 2 * 60 * 60 * 1000) sent.delete(id);

    const visits = (await hogql(config, ENDED_VISITS_SQL)).map(rowToVisit).filter((v) => !sent.has(v.sessionId));
    if (!visits.length) return;
    const ids = visits.map((v) => v.sessionId);

    const bySession = new Map<string, VisitEvent[]>();
    for (const row of await hogql(config, visitEventsSql(ids))) {
      const { sessionId, event } = rowToEvent(row);
      bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), event]);
    }
    for (const { sessionId: id, returning } of visits) {
      const events = bySession.get(id);
      if (!events?.length) {
        console.error(`[dashboard/visit-recap] visit listed as ended but its events came back empty`);
        continue;
      }
      const clerkUserId = visitClerkUserId(events);
      const account = clerkUserId ? await lookupAccount(config, clerkUserId) : null;
      // The SQL drops staff by PostHog email, which a signed-in person can lack.
      if (isStaffEmail(account?.email)) {
        sent.set(id, now);
        continue;
      }
      await sendTelegram(config, visitRecap(events, await lookupCompany(config, events, account), returning, account));
      sent.set(id, now);
    }
    console.log(`[dashboard/visit-recap] sent ${ids.length} visit recap(s)`);
  } catch (err) {
    console.error("[dashboard/visit-recap] tick failed:", err);
  } finally {
    running = false;
  }
}

let started = false;

/** Starts the 5-minute loop once per process (called from instrumentation). */
export function startVisitRecaps(): void {
  if (started) return;
  const config = configFromEnv();
  if (!config) return;
  started = true;
  setInterval(() => void tick(config), TICK_MS).unref?.();
  console.log("[dashboard/visit-recap] started, every 5 minutes");
}
