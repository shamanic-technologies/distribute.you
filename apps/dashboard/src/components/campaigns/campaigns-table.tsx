"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import {
  listCampaignsByBrand,
  getBrandCampaignBudgets,
  getFeatureRevenueByCampaign,
  type Campaign,
  type CampaignRevenueGroup,
} from "@/lib/api";
import { pairIsLearning } from "@/lib/maturity";
import { campaignBudgetCents } from "@/lib/campaign-budget";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";

/**
 * The brand's campaigns as rows (`useCampaignRows`), read by the v2 missions.
 *
 * Every number on a row is a READY features-service field. The only non-formatting
 * client work is joining the campaign row (channel / leg / status from
 * campaign-service) to its revenue group by campaignId — a display arrangement of wire
 * data, never a derived metric.
 */

/**
 * A campaign is RUNNING when campaign-service reports one of these words. The
 * column is free text there (`schema.ts` stores `status` as `text` defaulting to
 * `ongoing`, and only `ongoing` / `stopped` are written today), so the set is
 * spelled out rather than narrowed to an enum the wire does not promise.
 *
 * ONE set drives every reading of "running" (the rows' first sort key, the v2
 * missions): two lists of the same words would drift into disagreeing about which
 * campaigns are live.
 */
const ACTIVE_STATUSES = new Set(["active", "running", "ongoing", "live"]);
export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status.toLowerCase());
}

// One row = a campaign joined to its revenue group and to its own daily ceiling.
export interface CampaignRow {
  campaign: Campaign;
  revenue: CampaignRevenueGroup | null;
  /** billing's ceiling for THIS campaign, in cents. Null = billing had no answer. */
  budgetCents: number | null;
  /**
   * Whether this row's ratios (ROI, % CAC) are still LEARNING: the producer's own verdict
   * on this campaign's mature cohort (`costEconomics.maturity.isMature: false`,
   * lib/maturity.ts). Nothing here counts outcomes against a bar: the duration and the
   * count are the producer's, per leg, and a second judge is how one campaign came to
   * state four different costs per positive reply on four screens.
   *
   * `$ Invested` and `$ Budget` are NEVER gated by it: one is money already spent and the
   * other a ceiling the customer set, and neither is a ratio.
   */
  learning: boolean;
}

/**
 * Every offer's campaigns at once, as `offerId`.
 *
 * A caller that needs ONE answer per offer — the brand Overview's Offers table, which
 * states whether each row's ratios rest on enough evidence — cannot call this hook once
 * per offer: hooks are not loopable. Reading the brand-grain branch instead would be
 * wrong rather than merely coarse, because that branch is pinned to a single channel and
 * an offer is routinely sold through several, so an offer's measured campaign on its
 * second channel would be invisible and the row would read `Learning` for good.
 *
 * So this takes the offer-scoped branch — spans channels, keeps only campaigns that
 * NAME an offer — and simply does not narrow to one of them. Every query key is
 * unchanged, so a page already reading these rows pays nothing for the second question.
 */
export const ALL_OFFERS = "*";

/**
 * The rows both surfaces read, and the ordering they share.
 *
 * A hook rather than a prop drilled from each page: the Campaigns page names its #1
 * channel from the best-ROI row, and if it sorted its own copy the tile and the first
 * row of the table could name two different campaigns. One sort, one source.
 *
 * Both queries key exactly as the Campaigns page always keyed them, so a surface that
 * renders the table beside its own reads shares one cache entry and one poll.
 */
export function useCampaignRows(brandId: string, featureSlug: string, offerId?: string) {
  const revenueEnabled = isRevenueFeature(featureSlug);
  const orgConsistent = useOrgQueryGate();

  const campaignsQ = useAuthQuery(
    ["campaigns", brandId],
    () => listCampaignsByBrand(brandId),
    { refetchInterval: POLL_INTERVAL },
  );

  const groupsQ = useAuthQuery(
    ["featureRevenueByCampaign", brandId, featureSlug],
    () => getFeatureRevenueByCampaign(featureSlug, brandId),
    { enabled: revenueEnabled, refetchInterval: POLL_INTERVAL },
  );

  // What the brand funds each campaign at. The key is byte-equal to the one both
  // Offer Settings and Campaign Settings already read, so a surface rendering the
  // table beside either costs no second request — and the figure a row states is
  // by construction the figure those pages edit.
  const budgetsQ = useAuthQuery(["brandCampaignBudgets", brandId], () =>
    getBrandCampaignBudgets(brandId),
  );

  const campaigns = useMemo(() => campaignsQ.data?.campaigns ?? [], [campaignsQ.data]);
  // The table is the campaigns a brand HAS on THIS feature — one line per campaign,
  // running or paused.
  //
  // Two filters, and both are load-bearing:
  //
  // Feature. `listCampaignsByBrand` answers for the whole brand, so it also returns the
  // brand's PR, AI-visibility and VC campaigns — products that perform no leg and
  // whose figures this table never fetched: `getFeatureRevenueByCampaign` is scoped to
  // `featureSlug`. So those rows arrived with no group and rendered `— / — / —` under
  // columns they can never fill. A table listing one population and pricing
  // another is the incoherence, not merely the clutter.
  //
  // Status is NOT a filter — see `listedCampaigns` below. A campaign a customer
  // paused is still one of their campaigns, and a list that drops it says they
  // have none.
  //
  // Offer. A campaign is (offer x leg x channel), so an offer-scoped surface
  // lists the campaigns that sell THAT proposition. campaign-service carries the
  // offer on the row, so this is a filter on a stored value, never a guess: a
  // campaign that carries no offer belongs to none and is left out rather than
  // folded into whichever offer the reader happens to be looking at.
  //
  // ...and that is why an offer-scoped list spans CHANNELS. One offer is sold
  // through several at once — each its own campaign, its own ceiling, its own
  // measurement — so pinning the list to a single slug shows the reader one of
  // their campaigns and silently drops the rest. It did: a customer funded a second
  // cold-email channel, campaign-service provisioned and ran it, and the offer
  // screen kept showing one line. The feature filter's REASON survives intact — it
  // exists to keep out the brand's PR, AI-visibility and VC campaigns, which perform
  // no leg and can never fill these columns — so the offer-scoped test asks
  // exactly that instead: is this campaign's feature an ACQUISITION CHANNEL? The
  // catalogue answers, so a third channel needs no edit here.
  //
  // The brand-scoped list (no offer) is untouched and stays pinned to its one
  // feature: with no offer to bound it, spanning channels would mix propositions.
  const channels = useAcquisitionChannels();
  const featureCampaigns = useMemo(
    () =>
      campaigns.filter((c) =>
        offerId
          ? (offerId === ALL_OFFERS ? c.offerId != null : c.offerId === offerId) &&
            acquisitionChannelForFeatureSlug(c.featureSlug, channels) !== null
          : c.featureSlug === featureSlug,
      ),
    [campaigns, featureSlug, offerId, channels],
  );

  // One revenue read PER CHANNEL present in the list, because that endpoint prices
  // one channel at a time and a campaign is paced and priced on its own channel's
  // money. The rows are merged by campaign id, never added up: each row shows the
  // figures its own channel's group carries, so this is a display union and not a
  // browser-computed metric.
  //
  // `useQueries` rather than `useAuthQuery`, because the SIZE of this fan-out is
  // decided at render and a hook cannot be called per member. It therefore carries
  // the org gate explicitly (`useOrgQueryGate`) — the one thing `useAuthQuery` would
  // have done for it, and the one that must not be lost.
  //
  // Each key is byte-equal to the single-channel key above, so the channel the page
  // is already reading costs no second request.
  const channelSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const c of featureCampaigns) if (c.featureSlug) slugs.add(c.featureSlug);
    return [...slugs].sort();
  }, [featureCampaigns]);

  // Gated on the channel catalogue, NOT on `isRevenueFeature`: that set decides which
  // features get a revenue PAGE, and this is a data read. A channel performs legs,
  // so it has money to report; if it has none yet the groups come back empty
  // and the row reads `—`, which is the honest answer rather than a withheld one.
  const channelGroupQs = useQueries({
    queries: channelSlugs.map((slug) => ({
      queryKey: ["featureRevenueByCampaign", brandId, slug] as const,
      queryFn: () => getFeatureRevenueByCampaign(slug, brandId),
      enabled: orgConsistent && acquisitionChannelForFeatureSlug(slug, channels) !== null,
      refetchInterval: POLL_INTERVAL,
    })),
  });
  // ONE LINE PER IDENTITY, running or paused.
  //
  // A campaign IS (offer x leg x channel) — the address billing funds and the one
  // features-service totals server-side, so every row's money already includes what
  // that identity's earlier rows spent. campaign-service enforces at most one
  // `ongoing` row per identity (migration 0044) but keeps every superseded one, so
  // the STORED rows are many where the campaign is one: it used to mint a fresh row
  // on each workflow switch. Measured on the brand that surfaced this — 1 ongoing,
  // 1 manually paused, and 45 `stopped` ancestors of the ongoing one.
  //
  // So the old active-only filter was right about the 45 and wrong about the 1: it
  // read as "one line per live campaign" and behaved as "hide the campaign the
  // customer paused", which is the one they most want to see and turn back on.
  // Collapsing on the identity keeps both halves — the ancestors ride on their live
  // row exactly as before, and an identity with no live row states its latest,
  // which is the paused campaign itself.
  //
  // Latest by `updatedAt`, compared as the ISO-8601 UTC strings the wire carries
  // (lexicographic order IS chronological order there, so nothing is parsed).
  const listedCampaigns = useMemo(() => {
    const byIdentity = new Map<string, Campaign>();
    for (const c of featureCampaigns) {
      const key = `${c.offerId ?? ""}|${c.legKey ?? ""}|${c.featureSlug ?? ""}`;
      const held = byIdentity.get(key);
      if (!held) {
        byIdentity.set(key, c);
        continue;
      }
      // A live row wins its identity outright; between two dead ones, the latest.
      if (isActiveStatus(held.status)) continue;
      if (isActiveStatus(c.status) || c.updatedAt > held.updatedAt) byIdentity.set(key, c);
    }
    return [...byIdentity.values()];
  }, [featureCampaigns]);
  // Every channel's groups in one lookup, keyed by campaign. A campaign appears in
  // exactly one channel's answer (it IS a channel), so this merge can never make two
  // sources disagree about one row.
  const channelGroupData = channelGroupQs.map((q) => q.data);
  const groupsById = useMemo(() => {
    const m = new Map<string, CampaignRevenueGroup>();
    for (const g of groupsQ.data ?? []) m.set(g.campaignId, g);
    for (const groups of channelGroupData) {
      for (const g of groups ?? []) m.set(g.campaignId, g);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsQ.data, ...channelGroupData]);

  // Ordered STATUS, then ROI DESC, then last-updated DESC.
  //
  // Status leads because it is the first thing a reader asks of a list that now holds
  // both: what is running goes above what is not, so a paused campaign never sits
  // between two live ones on the strength of a return it is no longer earning.
  // Within a status it is the ROI column the table leads with, because a table that
  // displays one order and sorts by another reads as unordered. A campaign with no
  // ROI yet has nothing to rank on, so it sits last of its group rather than at zero
  // — and last-updated breaks that tie, so the campaigns with no figures are ordered
  // by the only thing left that distinguishes them.
  //
  // Each row's ceiling is read at the campaign's OWN address (offer x leg x channel),
  // so the brand-scoped list and the offer-scoped one state the same number for the
  // same campaign.
  const budgets = budgetsQ.data;
  const rows = useMemo<CampaignRow[]>(() => {
    const joined = listedCampaigns.map((c) => {
      const revenue = groupsById.get(c.id) ?? null;
      return {
        campaign: c,
        revenue,
        budgetCents: campaignBudgetCents(c, budgets, channels),
        // No group, or a producer that cannot judge (`isMature: null`), is not Learning.
        learning: pairIsLearning(revenue?.economicsMaturity),
      };
    });
    return joined.sort((a, b) => {
      const byStatus =
        Number(isActiveStatus(b.campaign.status)) - Number(isActiveStatus(a.campaign.status));
      if (byStatus !== 0) return byStatus;
      // A row that is not stating its return has no rank under it — ordering the table
      // by a number it is deliberately not showing reads as unordered. Learning rows sit
      // below the measured ones of their status and fall through to last-updated.
      const byLearning = Number(a.learning) - Number(b.learning);
      if (byLearning !== 0) return byLearning;
      const byRoi = a.learning
        ? 0
        : (b.revenue?.economicsMaturity?.mature?.roiMultiple ?? -1) -
          (a.revenue?.economicsMaturity?.mature?.roiMultiple ?? -1);
      if (byRoi !== 0) return byRoi;
      return b.campaign.updatedAt.localeCompare(a.campaign.updatedAt);
    });
  }, [listedCampaigns, groupsById, budgets, channels]);

  // The rows that are RUNNING, for the surfaces whose question is about live
  // campaigns rather than about the brand's campaigns: the Campaigns page's "#1
  // acquisition channel" tile, and the legs the Leads tabs are built from. Both
  // read this rather than `rows` — naming a channel or offering a tab off a
  // campaign that stopped months ago describes something the brand no longer sells.
  //
  // Derived from `rows`, not from a second filter over the campaigns: one identity
  // collapse and one ordering, so the two lists can never disagree about which
  // campaign is first.
  const activeRows = useMemo(
    () => rows.filter((r) => isActiveStatus(r.campaign.status)),
    [rows],
  );

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed gate
  // query (CLAUDE.md: reveal-on-settle). The per-channel fan-out is in the gate for
  // the same reason the others are: one channel's read failing must not hold the
  // table, and one still loading must not let it paint half its money.
  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (groupsQ.data !== undefined || groupsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError) &&
    channelGroupQs.every((q) => q.data !== undefined || q.isError);

  return { rows, activeRows, settled };
}

