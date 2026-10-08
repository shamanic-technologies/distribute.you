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
  /** A SOURCE campaign finds leads ("[Apollo Cold Filters] -> Lead found"); an outreach one works them. */
  kind: "source" | "outreach";
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
  /** Fed by the offer's source campaigns: the step it then starts on ("Lead found"), shown on the Sales path page only. */
  fedByLabel: string | null;
  /** A source campaign's provider domain (its logo.dev mark); null otherwise or no single vendor. */
  providerDomain: string | null;
}

/** The tag over a campaign's budget: when it works ("Daily Proactive", "Reactive on positive replies"). */
export function campaignTag(c: Pick<OfferCampaign, "reactive" | "fromKey" | "fromLabel"> & Partial<Pick<OfferCampaign, "kind">>): string {
  // A source finds leads when the outreach it feeds needs them (owner 2026-10-07: reactive, a max).
  if (c.kind === "source") return "Reactive on outreach";
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
  fedBy?: { step: { key: string; label: string } } | null;
};

type ServedSourceCampaign = {
  channelSlug: string;
  channelName: string;
  legKey: string;
  campaignName: string | null;
  managed: boolean;
  toStep: { key: string; label: string };
  provider: { domain: string } | null;
  live: boolean;
  roi: number | null;
  roiUnavailableReason: string | null;
};

/**
 * The campaigns features-service serves, kept to those a TICKED path uses (owner
 * 2026-10-05) and run by a channel (the customer's own team is not a campaign of ours).
 * `alsoKeep` keeps an unticked one that has history (owner 2026-10-08: the Sales path
 * table lists every campaign the offer has run, so a campaign with results never vanishes).
 * Step labels are looked up on the paths' legs (a display join, nothing computed).
 */
export function campaignsOfOffer(
  served: readonly ServedCampaign[],
  paths: ReadonlyArray<{ legs: readonly PathLegLike[] }>,
  roiLabel: (reason: string | null) => string | null,
  alsoKeep: (key: string) => boolean = () => false,
): OfferCampaign[] {
  const legs = new Map<string, PathLegLike>();
  for (const p of paths) for (const l of p.legs) if (!legs.has(l.legKey)) legs.set(l.legKey, l);
  const out: OfferCampaign[] = [];
  for (const c of served) {
    if (c.operatedBy === "customer") continue;
    if (c.selectedPathCount <= 0 && !alsoKeep(campaignKey(c.channelSlug, c.legKey))) continue;
    const leg = legs.get(c.legKey);
    if (!leg) {
      console.error("[offer-campaigns] a served campaign names a leg no listed path has", c);
      continue;
    }
    out.push({
      kind: "outreach",
      featureSlug: c.channelSlug,
      legKey: c.legKey,
      name: c.campaignName,
      channelName: c.channelName,
      managed: c.managed,
      reactive: c.reactive,
      fromKey: leg.fromStep?.key ?? null,
      fromLabel: leg.fromStep?.label ?? null,
      fedByLabel: c.fedBy?.step.label ?? null,
      toLabel: leg.toStep.label,
      roi: c.roi,
      roiUnavailable: roiLabel(c.roiUnavailableReason),
      providerDomain: null,
    });
  }
  return out;
}

/**
 * The offer's SOURCE campaigns (owner 2026-10-07): one per live origin, "[Apollo Cold
 * Filters] -> Lead found", proactive, each with its own on/off and budget. A retired origin
 * is served only while it holds history and is never offered.
 */
export function sourceCampaignsOfOffer(
  served: readonly ServedSourceCampaign[],
  roiLabel: (reason: string | null) => string | null,
): OfferCampaign[] {
  return served
    .filter((c) => c.live)
    .map((c) => ({
      kind: "source" as const,
      featureSlug: c.channelSlug,
      legKey: c.legKey,
      name: c.campaignName,
      channelName: c.channelName,
      managed: c.managed,
      // Reactive (owner 2026-10-07): it finds leads as its outreach needs them, its budget a max ("Up to $X/day").
      reactive: true,
      fromKey: null,
      fromLabel: null,
      fedByLabel: null,
      toLabel: c.toStep.label,
      roi: c.roi,
      roiUnavailable: roiLabel(c.roiUnavailableReason),
      providerDomain: c.provider?.domain ?? null,
    }));
}

/** The identity billing and campaign-service share for one campaign of an offer. */
export function campaignKey(featureSlug: string, legKey: string): string {
  return `${featureSlug}:${legKey}`;
}

/**
 * The table's order (owner 2026-10-05): campaigns that are on first, then proactive before
 * reactive, then ROI high to low (an unmeasured ROI last). `roiOf` names which served ROI
 * orders it (the Sales path table orders on each campaign's measured return). Orders
 * served figures; computes none.
 */
export function sortCampaigns(
  campaigns: readonly OfferCampaign[],
  on: (c: OfferCampaign) => boolean,
  roiOf: (c: OfferCampaign) => number | null = (c) => c.roi,
): OfferCampaign[] {
  const roi = (c: OfferCampaign) => {
    const v = roiOf(c);
    return v == null || !Number.isFinite(v) ? -Infinity : v;
  };
  return [...campaigns].sort(
    (a, b) => Number(on(b)) - Number(on(a)) || Number(a.reactive) - Number(b.reactive) || roi(b) - roi(a),
  );
}
