import { stepPlural } from "./v2/crews";

/**
 * An offer's CAMPAIGNS on the Sales path page (owner 2026-10-04): every (channel x leg)
 * its sales paths use, with its type, its ROI and an on/off status.
 *
 *  - No money on the page: billing gives the plan to the ONE proactive campaign that is on
 *    (campaign-service keeps one per offer) and a max to each reactive one.
 *  - On/off is campaign-service's campaign status; billing reads it, never stores it.
 *  - The name and face are features-service's `campaignName` (one word per channel x leg).
 *
 * Alias-free so it carries real unit tests.
 */

/** One campaign the offer's sales paths use, as the page lists it. */
export interface OfferCampaign {
  featureSlug: string;
  legKey: string;
  /** features-service `campaignName`; null when the producer names none. */
  name: string | null;
  channelName: string;
  /** We run this channel today (false = recorded, charged only at launch). */
  managed: boolean | undefined;
  /** Out of a step a lead reached: a MAX budget. */
  reactive: boolean;
  fromKey: string | null;
  fromLabel: string | null;
  toLabel: string;
  /** features-service's ROI of this campaign; null = not measurable (see roiUnavailable). */
  roi: number | null;
  /** Why there is no ROI, in the producer's words; null when there is one. */
  roiUnavailable: string | null;
}

/** The tag over a campaign's budget: when it works ("Daily Proactive", "Reactive on positive replies"). */
export function campaignTag(c: Pick<OfferCampaign, "reactive" | "fromKey" | "fromLabel">): string {
  if (!c.reactive || !c.fromKey) return "Daily Proactive";
  return `Reactive on ${stepPlural(c.fromKey, c.fromLabel ?? c.fromKey).toLowerCase()}`;
}

type PathLegLike = { legKey: string; fromStep: { key: string; label: string } | null; toStep: { label: string } };
type ServedCampaign = {
  channelSlug: string;
  channelName: string;
  legKey: string;
  campaignName: string | null;
  reactive: boolean;
  managed: boolean;
  operatedBy: string;
  selectedPathCount: number;
  roi: number | null;
  roiUnavailableReason: string | null;
};

/**
 * The campaigns features-service serves, kept to those a TICKED path uses (owner
 * 2026-10-05) and run by a channel (the customer's own team is not a campaign of ours).
 * Step labels are looked up on the paths' legs (a display join, nothing computed).
 */
export function campaignsOfOffer(
  served: readonly ServedCampaign[],
  paths: ReadonlyArray<{ legs: readonly PathLegLike[] }>,
  roiLabel: (reason: string | null) => string | null,
): OfferCampaign[] {
  const legs = new Map<string, PathLegLike>();
  for (const p of paths) for (const l of p.legs) if (!legs.has(l.legKey)) legs.set(l.legKey, l);
  const out: OfferCampaign[] = [];
  for (const c of served) {
    if (c.selectedPathCount <= 0 || c.operatedBy === "customer") continue;
    const leg = legs.get(c.legKey);
    if (!leg) {
      console.error("[offer-campaigns] a served campaign names a leg no listed path has", c);
      continue;
    }
    out.push({
      featureSlug: c.channelSlug,
      legKey: c.legKey,
      name: c.campaignName,
      channelName: c.channelName,
      managed: c.managed,
      reactive: c.reactive,
      fromKey: leg.fromStep?.key ?? null,
      fromLabel: leg.fromStep?.label ?? null,
      toLabel: leg.toStep.label,
      roi: c.roi,
      roiUnavailable: roiLabel(c.roiUnavailableReason),
    });
  }
  return out;
}

/** The identity billing and campaign-service share for one campaign of an offer. */
export function campaignKey(featureSlug: string, legKey: string): string {
  return `${featureSlug}:${legKey}`;
}

/**
 * The table's order (owner 2026-10-05): campaigns that are on first, then proactive before
 * reactive, then ROI high to low (an unmeasured ROI last). Orders served figures; computes none.
 */
export function sortCampaigns(campaigns: readonly OfferCampaign[], on: (c: OfferCampaign) => boolean): OfferCampaign[] {
  const roi = (c: OfferCampaign) => (c.roi == null || !Number.isFinite(c.roi) ? -Infinity : c.roi);
  return [...campaigns].sort(
    (a, b) => Number(on(b)) - Number(on(a)) || Number(a.reactive) - Number(b.reactive) || roi(b) - roi(a),
  );
}
