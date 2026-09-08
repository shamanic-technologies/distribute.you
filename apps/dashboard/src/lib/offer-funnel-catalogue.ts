// The sales funnels an offer has NOT stated yet, and what our other clients got from each.
//
// An offer's Sales funnels table lists only the funnels the customer already declared,
// so the ways they are not selling are invisible: a reader cannot tell whether the
// catalogue holds one more path or three, nor whether any of them pays. This module
// answers both halves — which funnels are missing, and the median return our other
// clients got through each — and nothing else. It renders nothing and it writes nothing: declaring a funnel is
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
import type { FleetFunnelReturnPair } from "./api";

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
  /** The producer's own name for that channel, when it states one. */
  channelName: string | null;
  /** The MIDDLE client's return per dollar, served verbatim. Never divided here. */
  medianReturnPerDollar: number;
  /** The middle client's cost per paying client, or null where the producer states none. */
  medianCostPerPaidClientUsd: number | null;
  /** How many clients the RETURN median was taken over, or null when unstated. */
  brandCount: number | null;
}

/**
 * What a card states about the fleet.
 *
 * Four answers, and the last three are genuinely different statements. `unread` is a
 * failed read: we have no opinion, so the card says nothing rather than claiming the
 * fleet never measured this. `thin` is the fleet's OWN answer, covering both of the
 * producer's reasons at once (too few clients past the spend floor, or no snapshot
 * computed yet) — a card cannot act differently on the two, and both mean the same thing
 * to a reader: there is not enough behind this to state a figure. `null` means a read
 * has not settled, so the card draws a skeleton instead of a verdict it would replace a
 * moment later.
 */
export type FleetFunnelState =
  | { kind: "unread" }
  | { kind: "thin" }
  | ({ kind: "measured" } & FleetFunnelEconomics);

/**
 * The BEST channel for a funnel, never a pooled average across channels.
 *
 * Cross-org and best, which is the fleet rule everywhere in this app: an average over
 * channels describes no channel anybody can buy, and the figure a card offers has to be
 * one a customer could actually get. Taking the max of a served field is a display
 * SELECTION and computes nothing; both figures then come off the SAME pair, so the
 * return and the price beside it can never describe two different channels.
 *
 * `measured: false` is the producer's verdict and is skipped outright — a pair below the
 * client floor carries nulls, and reading a null as a zero is how a surface states a
 * return nobody got. A pair can also be measured and carry no cost per paying client
 * (that needs one ingredient the return does not, the client's own lifetime revenue), so
 * the price is allowed to be null while the return leads the card.
 */
export function bestFleetEconomics(
  pairs: readonly FleetFunnelReturnPair[],
  funnelKey: SalesFunnelKey,
): FleetFunnelEconomics | null {
  let best: FleetFunnelEconomics | null = null;
  for (const pair of pairsForFunnel(pairs, funnelKey)) {
    if (!pair.measured) continue;
    const median = pair.medianReturnPerDollar;
    if (median == null || !Number.isFinite(median)) continue;
    if (best !== null && median <= best.medianReturnPerDollar) continue;
    best = {
      channelSlug: pair.channelSlug,
      channelName: pair.channelName ?? null,
      medianReturnPerDollar: median,
      medianCostPerPaidClientUsd: pair.medianCostPerPaidClientUsd ?? null,
      brandCount: pair.brandCount ?? null,
    };
  }
  return best;
}

/** The pairs describing one funnel, matched on the key under either wire spelling. */
function pairsForFunnel(
  pairs: readonly FleetFunnelReturnPair[],
  funnelKey: SalesFunnelKey,
): FleetFunnelReturnPair[] {
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
  pairs: readonly FleetFunnelReturnPair[] | undefined;
  funnelKey: SalesFunnelKey;
  settled: boolean;
  errored: boolean;
}): FleetFunnelState | null {
  if (errored) return { kind: "unread" };
  if (!settled || pairs === undefined) return null;
  const best = bestFleetEconomics(pairs, funnelKey);
  if (best === null) return { kind: "thin" };
  return { kind: "measured", ...best };
}
