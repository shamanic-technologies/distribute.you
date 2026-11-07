/**
 * Whether a costs-service price series refreshed (PRICE-REFRESH-RED-1107). The daily refresh failed every day from
 * 2026-10-16 to 2026-11-07 (one Twilio error blocked every vendor); the pages showed it amber "Not refreshed today"
 * for three weeks and nobody saw it. Owner rule: a broken monitor is RED on Monitoring, never an email; red ONLY when
 * broken, a normal "not yet" keeps normal colours.
 *
 * Broken = a vendor the producer skipped (served `vendorFailures`), a refresh the producer says failed, or a series
 * whose served `asOf` is more than one day behind today (UTC). Not refreshed yet today = "due", normal colours.
 * Everything here reads served fields; the only arithmetic is the day count between two served/clock dates.
 * Alias-free on purpose: real unit tests in tests/price-refresh.test.ts.
 */

export type VendorFailureLike = { provider: string; input: string; error: string };
export type RefreshLike = { status: string; error: string | null; vendorFailures?: VendorFailureLike[] } | null;
export type PriceSeriesLike = { stale: boolean; asOf: string; lastRefresh?: RefreshLike; vendorFailures?: VendorFailureLike[] };

export type RefreshState = "fresh" | "due" | "broken";
export type RefreshProblem = { key: string; text: string };

const DAY_MS = 86_400_000;

/** Today's UTC day, `YYYY-MM-DD` (costs-service days are UTC). */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Whole UTC days from `asOf` to `today` (0 = same day). */
export function daysBehind(asOf: string, today: string): number {
  return Math.round((Date.parse(`${today.slice(0, 10)}T00:00:00Z`) - Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
}

/** A vendor's display name (pure lookup, unknown keys capitalised). */
const VENDOR_NAMES: Record<string, string> = { openai: "OpenAI", deepseek: "DeepSeek", treg: "treg", "google-cloud": "Google Cloud" };
export function vendorName(provider: string): string {
  return VENDOR_NAMES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

const dayWords = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * A served error in plain words: when it embeds the vendor's own JSON body (`HTTP 401 {"message": "..."}`), that
 * body's `message` alone; otherwise the served text as is. A deterministic cleanup, the same for every vendor.
 */
export function plainError(error: string): string {
  const at = error.indexOf("{");
  if (at < 0) return error;
  try {
    const body: unknown = JSON.parse(error.slice(at, error.lastIndexOf("}") + 1));
    const message = body && typeof body === "object" ? (body as { message?: unknown }).message : undefined;
    return typeof message === "string" && message.trim() ? message.trim() : error;
  } catch {
    // Not a JSON body: the served text is already the plain error.
    return error;
  }
}

/** The served vendor failures: top level first, the last refresh's own list otherwise. */
export function vendorFailuresOf(s: PriceSeriesLike): VendorFailureLike[] {
  if (s.vendorFailures && s.vendorFailures.length) return s.vendorFailures;
  return s.lastRefresh?.vendorFailures ?? [];
}

/**
 * Every reason this series is broken, one plain line each, vendors first. `what` names the series ("Real costs").
 * Empty = not broken (fresh, or simply not refreshed yet today).
 */
export function refreshProblems(s: PriceSeriesLike, what: string, today: string): RefreshProblem[] {
  const out: RefreshProblem[] = [];
  const vendors = vendorFailuresOf(s);
  for (const v of vendors) out.push({ key: `vendor:${v.provider}:${v.input}`, text: `${vendorName(v.provider)} prices not refreshed: ${plainError(v.error)}` });
  if (!vendors.length && s.lastRefresh?.status === "failed") {
    out.push({ key: "refresh-failed", text: `${what} not refreshed: ${s.lastRefresh.error ? plainError(s.lastRefresh.error) : "the last refresh failed"}` });
  }
  const behind = daysBehind(s.asOf, today);
  if (behind > 1) out.push({ key: "behind", text: `${what} not refreshed for ${behind} days, last prices of ${dayWords(s.asOf)}` });
  return out;
}

export function refreshState(s: PriceSeriesLike, today: string): RefreshState {
  if (refreshProblems(s, "", today).length) return "broken";
  return s.stale || daysBehind(s.asOf, today) > 0 ? "due" : "fresh";
}

/** The one status line beside a page's day: red when broken, amber while today's refresh has not run, teal when done. */
export function refreshWords(s: PriceSeriesLike, today: string): { state: RefreshState; words: string } {
  const state = refreshState(s, today);
  const behind = daysBehind(s.asOf, today);
  if (state === "broken") return { state, words: behind > 1 ? `Not refreshed for ${behind} days` : "Refresh broken" };
  return { state, words: state === "due" ? "Not refreshed today" : "Refreshed today" };
}
