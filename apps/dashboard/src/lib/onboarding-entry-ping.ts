/**
 * The owner gets a Telegram message each time someone reaches the first page of
 * onboarding (owner 2026-10-01), whatever homepage arm sent them and whichever
 * onboarding they land on (`/get-started` = v2, `/onboarding` = v1).
 *
 * The page pings `/api/public/onboarding-entry` once per browser session from the
 * browser (so a scanner that runs no JavaScript never counts), and the route sends
 * the message with the same bot and chat as the landing's site chat
 * (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID`).
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export type OnboardingFlow = "v1" | "v2";

export const ENTRY_PING_STORAGE_KEY = "distribute_onboarding_entry_pinged";

/**
 * Whether this page load is someone ENTERING onboarding, from its query string.
 * Not an entry: adding a brand from inside the dashboard (`from=add`), coming back
 * from the claim or the Google sign-in (`claimed`, `resume`), resuming a brand
 * already built (`brandId`), or returning from Stripe (`checkout`, `session_id`).
 */
export function isOnboardingEntry(search: string): boolean {
  const params = new URLSearchParams(search);
  if (params.get("from") === "add") return false;
  for (const key of ["claimed", "resume", "brandId", "checkout", "session_id"]) {
    if (params.has(key)) return false;
  }
  return true;
}

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|node-fetch|go-http/i;

/** A user agent that is a machine (no UA at all counts as one). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_UA.test(userAgent);
}

/** One cookie's value off a raw Cookie header, or null. */
export function cookieFrom(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return null;
}

/** The website the visitor typed on the landing, as a bare host, or null. */
export function websiteHost(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return value.slice(0, 80);
  }
}

export interface EntryFacts {
  flow: OnboardingFlow;
  /** Homepage A/B arm from the `lp_variant` cookie, null when the visitor never saw the landing. */
  variant: string | null;
  website: string | null;
  /** First-touch channel (`cold_email`, `organic_search`, ...), null when unknown. */
  channel: string | null;
  utmSource: string | null;
  referrer: string | null;
  /** Two-letter country from Cloudflare (`cf-ipcountry`), null when absent. */
  country: string | null;
  signedIn: boolean;
}

/** The Telegram message, one line per fact present. */
export function entryMessage(facts: EntryFacts): string {
  const lines = [`🚪 New visitor on onboarding ${facts.flow}`];
  lines.push(`Landing arm: ${facts.variant ?? "none (direct to onboarding)"}`);
  if (facts.website) lines.push(`Website: ${facts.website}`);
  const source = [facts.channel, facts.utmSource && `utm ${facts.utmSource}`, facts.referrer && `from ${facts.referrer}`]
    .filter(Boolean)
    .join(" · ");
  if (source) lines.push(`Source: ${source}`);
  if (facts.country && facts.country !== "XX") lines.push(`Country: ${facts.country}`);
  if (facts.signedIn) lines.push("Signed in");
  return lines.join("\n");
}

/**
 * A per-IP cap, in memory (one Next process on the box): the route is public, so a
 * loop hammering it must not flood the owner's phone. Returns true when allowed.
 */
export function createRateLimiter(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxPerWindow) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}
