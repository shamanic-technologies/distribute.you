import { z } from "zod";

/**
 * Verified-bot traffic on distribute.you, read from cloudflare-service's
 * staff-only `GET /internal/bot-traffic/daily` (Cloudflare verified-bot
 * analytics, captured daily into bronze/silver/gold on that service).
 *
 * Read SERVER-side on the compose network with cloudflare-service's own key,
 * the same way `client-service-acquisitions.ts` reads client-service. The admin
 * app is edge-gated to the staff allowlist, so this never reaches a customer.
 *
 * Every figure the page states is a total cloudflare-service served for the
 * exact window asked (one read per window), never a sum taken here. The daily
 * series is only drawn.
 *
 * Alias-free on purpose so the pure helpers carry real unit tests.
 */

/** The three AI categories, in the order the page states them. */
export const AI_CATEGORIES = ["AI Assistant", "AI Search", "AI Crawler"] as const;
export type AiCategory = (typeof AI_CATEGORIES)[number];

/** What each category means, in plain words, for the page. */
export const AI_CATEGORY_MEANING: Record<AiCategory, string> = {
  "AI Assistant":
    "An assistant such as ChatGPT, Claude, Perplexity or DuckAssist opened a page live to answer somebody's question. This is the closest signal that AI answers are using us.",
  "AI Search": "An AI search engine visited to add our pages to its index, so it can cite them later.",
  "AI Crawler": "A model company collected pages to train future models. Nobody asked about us at that moment.",
};

const BotSchema = z.object({ botName: z.string(), requests: z.number() });

// Category names are the producer's vocabulary (Cloudflare's), read as plain
// strings: a category Cloudflare adds must not throw the whole read.
export const BotTrafficSchema = z.object({
  host: z.string(),
  from: z.string(),
  to: z.string(),
  categories: z.array(z.string()),
  days: z.array(
    z.object({
      date: z.string(),
      captured: z.boolean(),
      // null = the day was not captured (before capture began, or not final yet), never 0.
      requests: z.record(z.string(), z.number()).nullable(),
    }),
  ),
  totals: z.array(
    z.object({
      category: z.string(),
      requests: z.number(),
      topBots: z.array(BotSchema),
    }),
  ),
});
export type BotTraffic = z.infer<typeof BotTrafficSchema>;

export async function fetchBotTraffic(params: { from: string; to: string; topBots?: number }): Promise<BotTraffic> {
  const base = process.env.CLOUDFLARE_SERVICE_URL;
  const key = process.env.CLOUDFLARE_SERVICE_API_KEY;
  if (!base || !key) throw new Error("[bot-traffic] CLOUDFLARE_SERVICE_URL / CLOUDFLARE_SERVICE_API_KEY not set");
  const qs = new URLSearchParams({ from: params.from, to: params.to, topBots: String(params.topBots ?? 0) });
  const res = await fetch(`${base}/internal/bot-traffic/daily?${qs.toString()}`, {
    headers: { "x-api-key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`[bot-traffic] cloudflare-service answered ${res.status}`);
  const parsed = BotTrafficSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`[bot-traffic] response shape mismatch: ${parsed.error.message}`);
  return parsed.data;
}

/** YYYY-MM-DD shifted by n days, in UTC. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The windows the card asks for. The last day is YESTERDAY in UTC, the
 * producer's own default: today's traffic is not final yet.
 */
export function botTrafficWindows(now: Date): {
  last7: { from: string; to: string };
  prior7: { from: string; to: string };
  history: { from: string; to: string };
} {
  const to = addDays(now.toISOString().slice(0, 10), -1);
  return {
    last7: { from: addDays(to, -6), to },
    prior7: { from: addDays(to, -13), to: addDays(to, -7) },
    history: { from: addDays(to, -89), to },
  };
}

/** The served total for one category, or 0 when the producer listed none. */
export function categoryTotal(data: BotTraffic, category: string): number {
  return data.totals.find((t) => t.category === category)?.requests ?? 0;
}

/** How many days of the window were actually captured. */
export function capturedDays(data: BotTraffic): number {
  return data.days.filter((d) => d.captured).length;
}

/**
 * Change from the previous window, or null when it cannot be stated honestly:
 * either window is not fully captured (a partial week compared against a full
 * one is a wrong number), or the previous window read zero.
 */
export function windowChangePct(current: BotTraffic, previous: BotTraffic, category: string): number | null {
  if (capturedDays(current) < current.days.length || capturedDays(previous) < previous.days.length) return null;
  const before = categoryTotal(previous, category);
  if (before === 0) return null;
  return ((categoryTotal(current, category) - before) / before) * 100;
}

export interface BotTrafficPoint {
  date: string;
  "AI Assistant": number | null;
  "AI Search": number | null;
  "AI Crawler": number | null;
}

/**
 * The daily series to draw. The axis starts at the first captured day; a day
 * not captured after that stays on the axis with null values, so it draws as a
 * GAP, never as a zero.
 */
export function aiSeries(data: BotTraffic): BotTrafficPoint[] {
  const first = data.days.findIndex((d) => d.captured);
  if (first === -1) return [];
  return data.days.slice(first).map((d) => {
    const r = d.captured ? d.requests : null;
    return {
      date: d.date,
      "AI Assistant": r ? (r["AI Assistant"] ?? 0) : null,
      "AI Search": r ? (r["AI Search"] ?? 0) : null,
      "AI Crawler": r ? (r["AI Crawler"] ?? 0) : null,
    };
  });
}
