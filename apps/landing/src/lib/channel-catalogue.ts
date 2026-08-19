import { URLS } from "@distribute/content";

// The acquisition-channel catalogue, as the marketing site reads it.
//
// Every figure on the channel pages comes from features-service. Nothing here
// invents a price, a return or a delay, and nothing here COMPUTES one either:
// a public number the site prints must be a number the fleet already serves,
// or the two drift and the site starts advertising a price we do not charge.
// The helpers below shape and order what was served; they never derive a stat.
//
// What a customer buys is a PAIR — one sales funnel worked through one
// acquisition channel. The same chain costs wildly different amounts depending
// on the channel it is worked through (measured: cold email returns 7.9x
// through Form Magnet and 0.76x through the conversation chain), so a
// channel-level or funnel-level average would answer a question nobody asked.
// Hence a page per pair.
//
// The only runtime import is the shared content package, for the same API-URL
// fallback `static-html.ts` uses. Keep it that way: a second copy of the API
// base is a drift source, and the alias is what the tests import through.

/**
 * The step vocabulary. Published by the producer so a consumer never hardcodes
 * it — and these values are read off what the service ACTUALLY SERVES, not off
 * its OpenAPI, which currently declares `platform_form_submission` and
 * `platform_booked_meeting` for the two in-ad steps while the payload carries
 * `in_ad_form_submission` and `in_ad_booked_meeting`. Trusting the doc would
 * have produced a union that silently matches nothing on exactly the two steps
 * the paid channels exist to produce. Live beats the doc; the doc is a
 * features-service bug.
 */
export type ProducibleStepKey =
  | "conversation"
  | "website_visit"
  | "in_ad_form_submission"
  | "in_ad_booked_meeting";

export interface ProducibleStep {
  key: ProducibleStepKey;
  label: string;
  description: string;
}

/** How we go about it. The site groups the catalogue by this. */
export type ChannelFamily = "outbound_one_to_one" | "paid_reach" | "earned";

export interface ChannelTerms {
  /**
   * What operating the channel costs for a day whatever the volume, in whole
   * cents. A commercial figure the producer sets, never a measured one.
   */
  dailyOperatingCostCents: number;
  /** The shortest booking we sell. */
  minimumCommitmentDays: number;
  /** UPPER BOUND on days from booking to first production. A promise. */
  maxDaysToFirstProduction: number;
}

export interface ChannelFunnel {
  key: string;
  name: string;
  steps: string[];
}

export interface Channel {
  /** A channel IS a feature slug in this fleet. There is no separate entity. */
  slug: string;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
  family: ChannelFamily;
  terms: ChannelTerms;
  producibleSteps: ProducibleStep[];
  /**
   * DERIVED by the producer from `producibleSteps`, so it can never drift from
   * them. An empty list is a real statement — no deployed chain starts from
   * anything this channel produces — not a gap to paper over.
   */
  salesFunnels: ChannelFunnel[];
}

export interface ChannelCatalogue {
  channels: Channel[];
  producibleSteps: ProducibleStep[];
}

/** Why a pair carries no figure. The producer names the missing ingredient. */
export type NotMeasuredReason =
  | "no_spend_recorded"
  | "no_entry_step_produced"
  | "no_economics_declared";

/** Why one step of a measured pair still carries no price. */
export type UnpricedReason = "rate_not_declared" | "rate_is_zero";

export interface PairStep {
  /** Worded exactly as brand-service words it in the chain. */
  step: string;
  /** True for the step the funnel is NAMED after — its MILESTONE. */
  milestone: boolean;
  /** NULL when it cannot be priced. Never 0, which would read as "free". */
  costPerStepUsd: number | null;
  unpricedReason: UnpricedReason | null;
}

export interface PairEconomics {
  steps: PairStep[];
  costPerSaleUsd: number | null;
  costPerSaleUnpricedReason: UnpricedReason | null;
  returnPerDollar: number | null;
  lifetimeRevenueUsd: number | null;
  evidence: {
    totalSpentUsd: number;
    conversationsProduced: number;
    websiteVisitsProduced: number;
    brandCount: number;
  };
}

export type PairResult =
  | { measured: true; economics: PairEconomics }
  | { measured: false; reason: NotMeasuredReason };

export interface Pair {
  channelSlug: string;
  channelName: string;
  funnelKey: string;
  funnelName: string;
  funnelSteps: string[];
  result: PairResult;
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

/**
 * Reading order on every surface that groups the catalogue. Outbound first
 * because it is what we run today and what every measured figure comes from;
 * earned last because it is the slowest to produce.
 */
export const FAMILY_ORDER: ChannelFamily[] = [
  "outbound_one_to_one",
  "paid_reach",
  "earned",
];

export const FAMILY_LABEL: Record<ChannelFamily, string> = {
  outbound_one_to_one: "We reach them one to one",
  paid_reach: "We buy their attention",
  earned: "We earn their attention",
};

export const FAMILY_BLURB: Record<ChannelFamily, string> = {
  outbound_one_to_one:
    "We contact your buyers directly, from our own domains and numbers, on your behalf.",
  paid_reach:
    "We buy placement where your buyers already are. You pay the platform what the platform charges.",
  earned:
    "We build attention you keep. Slower to start, and it does not stop when the budget does.",
};

export interface FamilyGroup {
  family: ChannelFamily;
  label: string;
  blurb: string;
  channels: Channel[];
}

/**
 * Group the catalogue for display, in reading order, each family's channels in
 * the order the producer set. A family with no channels is dropped rather than
 * rendered empty — an empty heading advertises a gap that is not there.
 */
export function groupChannelsByFamily(channels: Channel[]): FamilyGroup[] {
  return FAMILY_ORDER.flatMap((family) => {
    const members = channels
      .filter((c) => c.family === family)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    if (members.length === 0) return [];
    return [
      {
        family,
        label: FAMILY_LABEL[family],
        blurb: FAMILY_BLURB[family],
        channels: members,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Pairs
// ---------------------------------------------------------------------------

export interface PairRef {
  channel: Channel;
  funnel: ChannelFunnel;
}

/**
 * Every pair the catalogue makes possible: one channel crossed with each sales
 * funnel the producer already derived for it. This is the site's page list, so
 * it is deliberately NOT a cartesian product — a funnel a channel cannot start
 * has no page, because it has no product behind it.
 */
export function allPairs(channels: Channel[]): PairRef[] {
  return channels
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((channel) =>
      channel.salesFunnels.map((funnel) => ({ channel, funnel })),
    );
}

/** The distinct funnels the whole catalogue can sell through, in first-seen order. */
export function allFunnels(channels: Channel[]): ChannelFunnel[] {
  const seen = new Map<string, ChannelFunnel>();
  for (const channel of channels) {
    for (const funnel of channel.salesFunnels) {
      if (!seen.has(funnel.key)) seen.set(funnel.key, funnel);
    }
  }
  return [...seen.values()];
}

/** The channels that can sell a given funnel, in catalogue order. */
export function channelsForFunnel(
  channels: Channel[],
  funnelKey: string,
): Channel[] {
  return channels
    .filter((c) => c.salesFunnels.some((f) => f.key === funnelKey))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Best-returning first, then everything we could not measure.
 *
 * Ranking on RETURN rather than on cost per sale is the same choice the
 * dashboard makes: cost ranks by cheapness, so a pair that converts to nothing
 * would outrank an expensive one that pays. A pair with no return has no
 * position among the ones that do, so it sorts to the end rather than to zero.
 */
export function sortPairsByReturn<T extends { result: PairResult }>(
  pairs: T[],
): T[] {
  const value = (p: T): number | null =>
    p.result.measured ? p.result.economics.returnPerDollar : null;
  return pairs.slice().sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  });
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * Money, adaptive by magnitude: cents matter under ten dollars and are noise
 * above it. Same rule the dashboard uses, so a figure reads identically on the
 * marketing site and inside the product.
 */
export function formatUsd(usd: number | null): string | null {
  if (usd === null || !Number.isFinite(usd)) return null;
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatCentsUsd(cents: number | null): string | null {
  if (cents === null || !Number.isFinite(cents)) return null;
  return formatUsd(cents / 100);
}

/**
 * A return, to ONE decimal, byte-equal with every other return in the fleet.
 * Coarsening above 10x was tried in the product and reverted: at a real 11.7 the
 * headline read 12x two inches under a card reading 11.7x.
 */
export function formatReturn(multiple: number | null): string | null {
  if (multiple === null || !Number.isFinite(multiple)) return null;
  return `${multiple.toFixed(1)}×`;
}

export function formatCommitment(days: number): string {
  return days === 1 ? "1-day minimum" : `${days}-day minimum`;
}

/** An upper bound, phrased as one. It is a promise, not an estimate. */
export function formatStartsWithin(days: number): string {
  return days === 1 ? "Starts within a day" : `Starts within ${days} days`;
}

/**
 * Why a pair carries no figure, said plainly. "We could not measure this" and
 * "it costs nothing" are different statements, and a reader must never have to
 * tell them apart from a blank cell.
 */
export const NOT_MEASURED_COPY: Record<NotMeasuredReason, string> = {
  no_spend_recorded:
    "Nobody has run this pairing yet, so there is nothing measured to show.",
  no_entry_step_produced:
    "This pairing has run, but has not yet produced the step the funnel starts from.",
  no_economics_declared:
    "This pairing has run, but no brand has stated what a customer is worth to them, so there is nothing to divide by.",
};

/** Why one step of an otherwise-measured pair carries no price. */
export const UNPRICED_COPY: Record<UnpricedReason, string> = {
  rate_not_declared: "No brand has stated a conversion rate for this step yet.",
  rate_is_zero: "Every brand that stated a rate for this step stated zero.",
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function channelPath(slug: string): string {
  return `/channels/${slug}`;
}

export function funnelPath(key: string): string {
  return `/funnels/${key}`;
}

export function pairPath(channelSlug: string, funnelKey: string): string {
  return `/channels/${channelSlug}/${funnelKey}`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
//
// Both routes are unauthenticated by design at the producer and forwarded
// unauthenticated by the gateway, so nothing here carries identity: a visitor
// to a marketing page is anonymous, and a read that needed a key could not
// generate a public site.
//
// The paths are the ones the gateway ACTUALLY deploys, read from the registry
// rather than guessed from the sibling convention — the ten public FEATURES
// reads sit under `/v1/public/features/*`, and these two deliberately do not.
// Guessing would have produced a 404 on every page.
//
// Failure is loud. These pages are nothing but served figures, so a page that
// rendered an empty catalogue would advertise that we run no channels at all —
// far worse than a build that stops and says why.

export const CHANNELS_PATH = "/v1/public/channels";
export const PAIR_ECONOMICS_PATH = "/v1/public/channel-funnel-economics";

/** How long a generated page may serve before it re-reads the catalogue. */
export const CATALOGUE_REVALIDATE_SECONDS = 300;

/** Bounded so a cold producer cannot blow the prerender budget of ~100 pages. */
const FETCH_TIMEOUT_MS = 12_000;

/**
 * Byte-equal with `static-html.ts`'s own resolution, and the fallback is
 * load-bearing rather than defensive: `NEXT_PUBLIC_DISTRIBUTE_API_URL` is NOT
 * set on the box, so every landing read today runs on `URLS.api`. Requiring the
 * variable here would have failed the prerender of every generated page in
 * production while passing locally.
 */
function apiBase(apiUrl?: string): string {
  const resolved =
    apiUrl ?? process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL ?? URLS.api;
  return resolved.replace(/\/+$/, "");
}

async function readJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`[landing] ${url} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchChannelCatalogue(
  apiUrl?: string,
): Promise<ChannelCatalogue> {
  return readJson<ChannelCatalogue>(`${apiBase(apiUrl)}${CHANNELS_PATH}`);
}

/**
 * Every pair, or one channel's pairs. An unknown channel slug is a 404 at the
 * producer rather than an empty list, which is what lets a generated page tell
 * "this channel sells nothing" apart from "this channel does not exist".
 */
export async function fetchPairEconomics(
  options: { channelSlug?: string; apiUrl?: string } = {},
): Promise<{ channelSlug: string | null; pairs: Pair[] }> {
  const query = options.channelSlug
    ? `?channelSlug=${encodeURIComponent(options.channelSlug)}`
    : "";
  return readJson(`${apiBase(options.apiUrl)}${PAIR_ECONOMICS_PATH}${query}`);
}
