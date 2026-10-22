import { GS_ARMS, GS_ARM_WEIGHTS, adaptiveGsArmWeights, asGsArm, type GsArm, type GsArmStats } from "./get-started-arm";

/**
 * The get-started A/B split new visitors are drawn with (owner 2026-10-22), refreshed at most
 * once an hour from PostHog: per arm, the human visitors who walked it since the test began and
 * how many of them saved a card. The page reads the cached split and never waits on PostHog; a
 * stale cache starts a refresh in the background. Until a refresh succeeds, or when PostHog
 * fails, the split is 50 / 50 and the failure is logged.
 *
 * Kept on globalThis: the page bundle and any other bundle in the same Node process share it.
 */

const REFRESH_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_POSTHOG_API_HOST = "https://eu.posthog.com";

const EMAIL = "lower(coalesce(person.properties.email, ''))";
// Same machine and staff rules as the visit recap (lib/visit-recap-job.ts) and the morning brief.
const INTERNAL = `(${EMAIL} in ('kevin.lourd@gmail.com', 'kevin@pressbeat.io') or ${EMAIL} like '%@distribute.you' or ${EMAIL} like 'kevin.lourd+%' or lower(coalesce(person.properties.name, '')) = 'kevin lourd')`;
const HEADLESS =
  "(properties.$os in ('Windows', 'Mac OS X', 'Linux', 'Chrome OS') and properties.$screen_width = properties.$viewport_width and properties.$screen_height = properties.$viewport_height)";
const SCANNER = `(empty(${EMAIL}) and properties.$os = 'Mac OS X' and properties.$browser = 'Chrome' and properties.$screen_width = 1680)`;

/** One row per arm: visitors, visitors who saved a card. A person is counted in the first arm they saw. */
export const GS_ARM_STATS_SQL = `
select arm, count(), countIf(cards > 0) from (
  select person_id, argMin(properties.gs_arm, timestamp) as arm,
    countIf(event = 'get_started_card_saved') as cards,
    countIf(${INTERNAL} or ${HEADLESS} or ${SCANNER}) as machine_or_staff
  from events
  where timestamp >= toDateTime('2026-10-17') and properties.gs_arm in ('emails', 'leads')
  group by person_id
  having machine_or_staff = 0
)
group by arm`;

export function rowsToGsArmStats(rows: unknown[][]): GsArmStats {
  const stats: GsArmStats = { emails: { visitors: 0, cards: 0 }, leads: { visitors: 0, cards: 0 } };
  for (const row of rows) {
    const arm = asGsArm(typeof row[0] === "string" ? row[0] : null);
    if (!arm) throw new Error(`unknown arm in PostHog row: ${JSON.stringify(row)}`);
    stats[arm] = { visitors: Number(row[1]), cards: Number(row[2]) };
  }
  return stats;
}

type SplitState = { weights: Record<GsArm, number>; refreshedAt: number; refreshing: boolean };
const KEY = "__distributeGsArmSplit";
const g = globalThis as typeof globalThis & { [KEY]?: SplitState };

function state(): SplitState {
  g[KEY] ??= { weights: { ...GS_ARM_WEIGHTS }, refreshedAt: 0, refreshing: false };
  return g[KEY];
}

async function refresh(s: SplitState): Promise<void> {
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  if (!projectId || !apiKey) throw new Error("missing env POSTHOG_PROJECT_ID or POSTHOG_PERSONAL_API_KEY");
  const host = (process.env.POSTHOG_API_HOST || DEFAULT_POSTHOG_API_HOST)
    .replace("https://eu.i.posthog.com", "https://eu.posthog.com")
    .replace(/\/$/, "");
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: GS_ARM_STATS_SQL } }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`PostHog query ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { results?: unknown[][] };
  if (!Array.isArray(body.results)) throw new Error("PostHog query answered no results array");
  const stats = rowsToGsArmStats(body.results);
  s.weights = adaptiveGsArmWeights(stats);
  console.log(
    `[dashboard/gs-arm] split ${GS_ARMS.map((a) => `${a} ${Math.round(s.weights[a] * 100)}%`).join(" / ")} ` +
      `(cards saved: ${GS_ARMS.map((a) => `${a} ${stats[a].cards}/${stats[a].visitors}`).join(", ")})`,
  );
}

/** The split to draw a new visitor with; starts a background refresh when the cache is over an hour old. */
export function gsArmWeights(now = Date.now()): Record<GsArm, number> {
  const s = state();
  if (!s.refreshing && now - s.refreshedAt >= REFRESH_MS) {
    s.refreshing = true;
    s.refreshedAt = now;
    refresh(s)
      .catch((err) => {
        s.weights = { ...GS_ARM_WEIGHTS };
        console.error(`[dashboard/gs-arm] split refresh failed, drawing 50 / 50 until the next hour: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        s.refreshing = false;
      });
  }
  return s.weights;
}
