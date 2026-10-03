import { visitRecap, type VisitEvent } from "./visit-recap";

/**
 * Every 5 minutes, finds the visits that reached onboarding and ended 30 to 40
 * minutes ago (PostHog closes a session after 30 idle minutes), and sends the
 * owner one Telegram recap per visit (`visit-recap.ts` builds the text).
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
const INTERNAL = `(${EMAIL} in ('kevin.lourd@gmail.com', 'kevin@pressbeat.io') or ${EMAIL} like '%@distribute.you' or ${EMAIL} like 'kevin.lourd+%')`;
const HEADLESS =
  "(properties.$os in ('Windows', 'Mac OS X', 'Linux', 'Chrome OS') and properties.$screen_width = properties.$viewport_width and properties.$screen_height = properties.$viewport_height)";
const SCANNER =
  `(empty(${EMAIL}) and properties.$os = 'Mac OS X' and properties.$browser = 'Chrome' and properties.$screen_width = 1680)`;

export const ENDED_VISITS_SQL = `
select $session_id
from events
where timestamp > now() - interval 1 day and $session_id != ''
group by $session_id
having max(timestamp) between now() - interval 40 minute and now() - interval 30 minute
  and countIf(event = '$pageview' and properties.$host = 'dashboard.distribute.you' and properties.$pathname in ('/get-started', '/onboarding')) > 0
  and countIf(${INTERNAL} or ${HEADLESS} or ${SCANNER}) = 0
order by max(timestamp)
limit ${MAX_VISITS_PER_TICK}`;

function visitEventsSql(sessionIds: string[]): string {
  const ids = sessionIds.map((id) => `'${id.replace(/[^A-Za-z0-9-]/g, "")}'`).join(", ");
  return `
select $session_id, timestamp, event, properties.$host, properties.$pathname, properties.$current_url,
  properties.$el_text, properties.title, properties.$geoip_country_code, properties.$referring_domain,
  properties.utm_source, properties.utm_medium, properties.utm_term, properties.gclid,
  coalesce(properties.website, properties.domain)
from events
where timestamp > now() - interval 1 day and $session_id in (${ids})
  and event not in ('$web_vitals', '$exception', '$set', '$identify', 'landing_variant_viewed')
order by timestamp
limit 10000`;
}

interface Config {
  posthogApiHost: string;
  posthogProjectId: string;
  posthogPersonalApiKey: string;
  telegramToken: string;
  telegramChatId: string;
}

function configFromEnv(): Config | null {
  const env = {
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
    },
  };
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

    const ids = (await hogql(config, ENDED_VISITS_SQL)).map((r) => String(r[0])).filter((id) => !sent.has(id));
    if (!ids.length) return;

    const bySession = new Map<string, VisitEvent[]>();
    for (const row of await hogql(config, visitEventsSql(ids))) {
      const { sessionId, event } = rowToEvent(row);
      bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), event]);
    }
    for (const id of ids) {
      const events = bySession.get(id);
      if (!events?.length) {
        console.error(`[dashboard/visit-recap] visit listed as ended but its events came back empty`);
        continue;
      }
      await sendTelegram(config, visitRecap(events));
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
