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

type PathLegLike = {
  legKey: string;
  workedBy: string;
  reactive?: boolean;
  fromStep: { key: string; label: string } | null;
  toStep: { label: string };
  channel: { slug: string | null; name: string | null; managed?: boolean; operatedBy?: string; campaignName?: string | null } | null;
};

/**
 * Every campaign the paths use, once each, in the order the paths (ROI desc) first meet
 * them. A leg the customer's own team works is not a campaign of ours.
 */
export function campaignsOfPaths(paths: ReadonlyArray<{ legs: readonly PathLegLike[] }>): OfferCampaign[] {
  const seen = new Set<string>();
  const out: OfferCampaign[] = [];
  for (const p of paths) {
    for (const leg of p.legs) {
      const c = leg.channel;
      if (!c?.slug || !c.name || leg.workedBy === "human" || c.operatedBy === "customer") continue;
      const key = campaignKey(c.slug, leg.legKey);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        featureSlug: c.slug,
        legKey: leg.legKey,
        name: c.campaignName ?? null,
        channelName: c.name,
        managed: c.managed,
        reactive: leg.reactive === true,
        roi: null,
        roiUnavailable: "Not served yet",
        fromKey: leg.fromStep?.key ?? null,
        fromLabel: leg.fromStep?.label ?? null,
        toLabel: leg.toStep.label,
      });
    }
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
