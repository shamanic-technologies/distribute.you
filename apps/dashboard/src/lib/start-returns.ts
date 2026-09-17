// WHAT A DOLLAR CAME BACK AS, for the channels and funnels a visitor just picked.
//
// This is the screen that carries the signup CTA, so what it may state is worth
// being strict about: every figure here is READ from features-service, at the
// scope the producer computed it, and nothing is blended, interpolated or
// derived. Two scopes are published and they answer different questions:
//
//   PAIR    (channel x funnel) — the tightest answer, and the one the visitor
//           actually asked for. Production measures 2 of 124 pairs today.
//   CHANNEL (a channel across every funnel it sells) — wider, and measured far
//           more often because it pools more brands: cold email is measured
//           over 10 brands at channel scope against 3 at pair scope.
//
// So a row states the pair figure when there is one, falls back to the channel
// figure when there is not, and says plainly when neither is measured — CARRYING
// ITS OWN SCOPE either way. A reader must never be left to assume a channel-wide
// median describes the one funnel they picked, which is exactly what dropping
// the label would do.
//
// NEVER fabricate the missing case. `not_enough_brands` is the producer refusing
// to state a figure it cannot stand behind, and a screen that fills that gap
// with an average of its own is publishing a number nobody measured.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

/** One (channel x funnel) row as features-service publishes it. */
export interface PairReturn {
  channelSlug: string;
  channelName: string;
  funnelKey: string;
  funnelName: string;
  measured: boolean;
  /** The producer's own word for why it cannot state a figure. */
  reason: string | null;
  brandCount: number;
  medianReturnPerDollar: number | null;
  p25ReturnPerDollar: number | null;
  p75ReturnPerDollar: number | null;
  medianCostPerPaidClientUsd: number | null;
}

/** One channel across every funnel it sells, as features-service publishes it. */
export interface ChannelReturn {
  featureSlug: string;
  measured: boolean;
  reason: string | null;
  brandCount: number;
  medianReturnPerDollar: number | null;
  p25ReturnPerDollar: number | null;
  p75ReturnPerDollar: number | null;
}

/** Which population a figure was taken over. Rendered beside it, always. */
export type ReturnScope = "pair" | "channel";

export interface ReturnRow {
  channelSlug: string;
  channelName: string;
  funnelKey: string;
  /** Null when neither scope is measured — the row then states the reason. */
  scope: ReturnScope | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  /** How many brands the figure was taken over. Published so the reader can
   *  weigh it: a median over 3 brands and one over 10 are different claims. */
  brandCount: number;
  /** The producer's own reason, when nothing is measured. */
  reason: string | null;
  /** Only ever stated at pair scope: a channel-wide median is not a cost per
   *  paid client for the one funnel the visitor picked. */
  costPerPaidClientUsd: number | null;
}

/**
 * The rows for one funnel: every channel the visitor kept that sells it.
 *
 * Measured rows first and by median descending, so the strongest evidence reads
 * first; unmeasured rows keep the channel order they arrived in rather than
 * being ranked on a figure they do not have. Sorting unmeasured rows by
 * anything would present the tie-break as merit.
 */
export function returnRowsForFunnel(
  funnelKey: string,
  channelSlugs: string[],
  pairs: PairReturn[],
  channelReturns: ChannelReturn[],
): ReturnRow[] {
  const byChannel = new Map(channelReturns.map((c) => [c.featureSlug, c]));
  const rows: ReturnRow[] = [];

  for (const slug of channelSlugs) {
    const pair = pairs.find((p) => p.channelSlug === slug && p.funnelKey === funnelKey);
    // A pair the producer does not list at all is a pair it does not sell, so
    // there is no row to state — as opposed to one it lists and cannot measure.
    if (!pair) continue;

    if (pair.measured && pair.medianReturnPerDollar != null) {
      rows.push({
        channelSlug: slug,
        channelName: pair.channelName,
        funnelKey,
        scope: "pair",
        median: pair.medianReturnPerDollar,
        p25: pair.p25ReturnPerDollar,
        p75: pair.p75ReturnPerDollar,
        brandCount: pair.brandCount,
        reason: null,
        costPerPaidClientUsd: pair.medianCostPerPaidClientUsd,
      });
      continue;
    }

    const channel = byChannel.get(slug);
    if (channel && channel.measured && channel.medianReturnPerDollar != null) {
      rows.push({
        channelSlug: slug,
        channelName: pair.channelName,
        funnelKey,
        scope: "channel",
        median: channel.medianReturnPerDollar,
        p25: channel.p25ReturnPerDollar,
        p75: channel.p75ReturnPerDollar,
        brandCount: channel.brandCount,
        reason: null,
        // Deliberately absent: the producer states a cost per paid client per
        // PAIR, and lending the channel's row the pair's figure would put a
        // number under a label it was not computed for.
        costPerPaidClientUsd: null,
      });
      continue;
    }

    rows.push({
      channelSlug: slug,
      channelName: pair.channelName,
      funnelKey,
      scope: null,
      median: null,
      p25: null,
      p75: null,
      // The pair's own count, which is the honest one: it is what the producer
      // measured this pair over, and it is why it will not state a figure.
      brandCount: pair.brandCount,
      // Prefer the pair's reason: it is the scope the visitor asked about.
      reason: pair.reason ?? channel?.reason ?? null,
      costPerPaidClientUsd: null,
    });
  }

  const measured = rows.filter((r) => r.scope !== null);
  const unmeasured = rows.filter((r) => r.scope === null);
  measured.sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
  return [...measured, ...unmeasured];
}

/** Whether a funnel has anything at all to show. A funnel where nothing is
 *  measured still renders — it says so — but the screen uses this to decide
 *  what leads. */
export function funnelHasMeasuredReturn(rows: ReturnRow[]): boolean {
  return rows.some((r) => r.scope !== null);
}

/**
 * Plain wording for the producer's own reason token.
 *
 * An unknown token renders VERBATIM rather than as a default sentence: the
 * producer is free to add a reason, and a consumer that swallows one it does not
 * recognise would state the wrong cause with total confidence.
 */
export function returnReasonLabel(reason: string | null): string {
  switch (reason) {
    case "not_enough_brands":
      return "Not enough clients have run this yet for us to state a figure.";
    case "no_snapshot_yet":
      return "We have not measured this one yet.";
    case null:
      return "We have not measured this one yet.";
    default:
      return reason;
  }
}
