// The sales funnels an offer has NOT stated yet, and what the fleet paid for each.
//
// An offer's Sales funnels table lists only the funnels the customer already declared,
// so the ways they are not selling are invisible: a reader cannot tell whether the
// catalogue holds one more path or three, nor whether any of them pays. This module
// answers both halves — which funnels are missing, and the fleet's own price for each —
// and nothing else. It renders nothing and it writes nothing: declaring a funnel is
// Offer Settings' job and there is exactly one writer of it.
//
// Only relative, alias-free imports live here (vitest does not resolve `@`), so this
// module carries REAL unit tests. Keep it that way.

import {
  SALES_FUNNELS,
  normalizeSalesFunnelKey,
  type SalesFunnelDef,
  type SalesFunnelKey,
  type SalesFunnelKeyWire,
} from "./sales-funnels";
import type { ChannelFunnelEconomicsPair } from "./funnel-leg-price";

/**
 * What each funnel IS, in one line.
 *
 * New copy for this surface, deliberately not in the catalogue: the funnel's NAME and
 * its STEPS are what it is and what it does, and both already come from `SALES_FUNNELS`
 * so nothing here restates them. This says who does what, for a reader deciding whether
 * a path they have never sold through is one they could.
 */
export const FUNNEL_BLURB: Record<SalesFunnelKey, string> = {
  reply_meeting:
    "Someone answers a cold email, books a slot, shows up and buys. Nothing has to happen on your website.",
  visit_meeting:
    "Someone lands on your site, books a slot, shows up and buys. The page they arrive on does the convincing.",
  visit_signup:
    "Someone lands on your site and buys there. No call, no slot to hold.",
  visit_form:
    "Someone lands on your site and leaves their details. Your team takes it from there.",
};

/**
 * The catalogue funnels this offer has NOT stated, in catalogue order.
 *
 * Declared means PRESENT in the offer's own set, whether or not it is switched on: a
 * funnel the customer priced and then paused is one they have answered about, and
 * offering it here as something they have never tried would be false. Offer Settings
 * already lists those under its own heading.
 *
 * A key the catalogue cannot name is IGNORED rather than thrown on: this is a display
 * list, and a vocabulary drift upstream must not take the section down. It fails in the
 * safe direction — an unnameable declared key is not subtracted, so at worst a card is
 * offered for a funnel already declared, never the reverse.
 */
export function undeclaredFunnels(declaredKeys: readonly string[]): SalesFunnelDef[] {
  const declared = new Set<SalesFunnelKey>();
  for (const raw of declaredKeys) {
    try {
      declared.add(normalizeSalesFunnelKey(raw as SalesFunnelKeyWire));
    } catch {
      // Not a funnel this app can name. Nothing to subtract.
    }
  }
  return SALES_FUNNELS.filter((f) => !declared.has(f.key));
}

/** The fleet's answer for one funnel, taken from ONE pair so a card cannot mix sources. */
export interface FleetFunnelEconomics {
  /** The channel that produced these figures. Its price and its return are one row. */
  channelSlug: string;
  /** Cross-client return per dollar, served verbatim. Never divided here. */
  returnPerDollar: number;
  /** What a paid client cost through that channel, or null when the producer could not price one. */
  costPerSaleUsd: number | null;
  /** How many brands the figures rest on, or null when the producer states none. */
  brandCount: number | null;
}

/**
 * What a card states about the fleet.
 *
 * Four answers, and the last three are genuinely different statements. `unread` is a
 * failed price list: we have no opinion, so the card says nothing rather than claiming
 * the fleet never measured this. `unmeasured` is the fleet's own answer. `null` means a
 * read has not settled, so the card draws a skeleton instead of stating a verdict it
 * would replace a moment later.
 */
export type FleetFunnelState =
  | { kind: "unread" }
  | { kind: "unmeasured" }
  | ({ kind: "measured" } & FleetFunnelEconomics);

/**
 * The BEST channel for a funnel, never a pooled average across channels.
 *
 * Cross-org and best, which is the fleet rule everywhere in this app: an average over
 * channels describes no channel anybody can buy, and the figure a card offers has to be
 * one a customer could actually get. Both figures come off the SAME pair, so the return
 * and the price it rests on can never describe two different channels.
 *
 * A pair can be `measured` and still carry no return (the producer priced the steps and
 * not the sale). Such a pair cannot lead the card, so it is skipped — but its presence
 * still means the fleet HAS measured this funnel, which is why `fleetFunnelState` below
 * asks that question separately.
 */
export function bestFleetEconomics(
  pairs: readonly ChannelFunnelEconomicsPair[],
  funnelKey: SalesFunnelKey,
): FleetFunnelEconomics | null {
  let best: FleetFunnelEconomics | null = null;
  for (const pair of pairsForFunnel(pairs, funnelKey)) {
    if (!pair.result.measured) continue;
    const economics = pair.result.economics;
    const roi = economics?.returnPerDollar;
    if (roi == null || !Number.isFinite(roi)) continue;
    if (best !== null && roi <= best.returnPerDollar) continue;
    best = {
      channelSlug: pair.channelSlug,
      returnPerDollar: roi,
      costPerSaleUsd: economics?.costPerSaleUsd ?? null,
      brandCount: economics?.evidence?.brandCount ?? null,
    };
  }
  return best;
}

/** The pairs describing one funnel, matched on the key under either wire spelling. */
function pairsForFunnel(
  pairs: readonly ChannelFunnelEconomicsPair[],
  funnelKey: SalesFunnelKey,
): ChannelFunnelEconomicsPair[] {
  return pairs.filter((pair) => {
    try {
      return normalizeSalesFunnelKey(pair.funnelKey as SalesFunnelKeyWire) === funnelKey;
    } catch {
      return false;
    }
  });
}

/**
 * What one card says about the fleet, given the read's own state.
 *
 * `settled` and `errored` are kept apart on purpose: reveal-on-settle means an errored
 * read must not hold the card in a skeleton forever, and it must not be reported as the
 * fleet having no measurement either. Those are different things and the card renders
 * them differently.
 */
export function fleetFunnelState({
  pairs,
  funnelKey,
  settled,
  errored,
}: {
  pairs: readonly ChannelFunnelEconomicsPair[] | undefined;
  funnelKey: SalesFunnelKey;
  settled: boolean;
  errored: boolean;
}): FleetFunnelState | null {
  if (errored) return { kind: "unread" };
  if (!settled || pairs === undefined) return null;
  const best = bestFleetEconomics(pairs, funnelKey);
  if (best === null) return { kind: "unmeasured" };
  return { kind: "measured", ...best };
}
