"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import {
  listCampaignsByBrand,
  getBrandFunnelBudgets,
  getFeatureRevenueByCampaign,
  type Campaign,
  type CampaignRevenueGroup,
} from "@/lib/api";
import { campaignBudgetCents, fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { formatUsdAdaptive } from "@/lib/format-number";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { channelSlugLabel } from "@/lib/campaign-title";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { Skeleton } from "@/components/skeleton";

/**
 * The brand's campaigns, one line each, ordered by return.
 *
 * ONE table, rendered on the Campaigns page and again under the brand Overview's
 * chart. It is a component rather than a second copy because both surfaces answer the
 * same question with the same numbers, and two copies is how a campaign comes to read
 * one way on one page and another way on the next.
 *
 * Every displayed number is a READY features-service field. The only non-formatting
 * client work is joining the campaign row (channel / funnel / status from
 * campaign-service) to its revenue group by campaignId — a display arrangement of wire
 * data, never a derived metric.
 */

export function fmtUsd(usd: number | null | undefined): string {
  return usd == null ? "—" : formatUsdAdaptive(usd);
}
function fmtRoi(multiple: number | null | undefined): string {
  return multiple == null ? "—" : `${multiple.toFixed(1)}×`;
}
export function fmtPct(pct: number | null | undefined): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

/**
 * What each number column means, in the words a reader needs to trust it.
 *
 * The first three are PROJECTIONS, and saying so is the point: the revenue is what
 * the outcomes so far are expected to be worth, not money collected, and ROI and
 * % CAC are computed from it. A column that reads as banked revenue when it is a
 * forecast is the same statement under two meanings.
 *
 * `$ Invested` is the one figure here that already happened, which is exactly why it
 * sits beside them and says so: it is COMMITTED spend, billed plus the holds open on
 * sends this campaign has already queued, and it is byte the same number ROI and % CAC
 * divide by. A reader who assumes one basis will try to multiply `$ Invested x ROI`,
 * so the tip states the difference outright.
 *
 * Committed, not billed-only, and the two are NOT interchangeable: features-service
 * serves exactly one spend basis and this is it. Reading the billed-only sibling here
 * would put a smaller number under the same label the ROI was computed from, which is
 * the contradiction that made a brand read $202 on its Overview beside $191 here.
 */
export const COLUMN_INFO = {
  roi: "What a customer is worth over their lifetime, divided by what it costs to win one. 11.7x means every $1 spent is projected to return $11.70. Based on the conversion rates and lifetime revenue set in Brand Settings.",
  cacPct:
    "What winning a customer costs, as a share of what that customer is worth over their lifetime. 9% means $9 spent for every $100 earned. Lower is better, and it is the inverse of ROI.",
  revenue:
    "Expected pipeline revenue: the outcomes this campaign has produced so far, valued with the conversion rates and customer lifetime revenue you set in Brand Settings. It is a projection of what this pipeline is worth, not money already collected.",
  invested:
    "What this campaign has cost so far, net of any discount: money already billed plus money reserved for emails it has queued. It is the same figure the ROI and % CAC beside it are calculated from. Those two are projections of what it is worth going forward, so this is not a multiplier of them.",
  budget:
    "The most this campaign may spend in a day. It is a ceiling you set, not money spent, so nothing is charged against it until the campaign sends. Zero means it is stopped, and you change it in Campaign Settings.",
} as const;

/** A right-aligned numeric header with its (i) sitting after the label. */
export function NumericHead({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {label}
      <InfoTooltip tip={tip} />
    </span>
  );
}

/**
 * The headline number of the row. It carries the table's own size — weight and
 * colour are what set it apart, not a second type scale inside one row.
 *
 * A return above 1x means the campaign is making money back, and that reads
 * GREEN. Below 1x it stays the ordinary text colour rather than turning red: an
 * early campaign is under 1x by construction, and painting that red calls a
 * campaign that has not finished learning a failure.
 */
export function RoiCell({ multiple }: { multiple: number | null | undefined }) {
  const good = multiple != null && multiple > 1;
  return (
    <span className={`font-semibold tabular-nums ${good ? "text-green-600" : "text-gray-900"}`}>
      {fmtRoi(multiple)}
    </span>
  );
}

/**
 * A campaign is RUNNING when campaign-service reports one of these words. The
 * column is free text there (`schema.ts` stores `status` as `text` defaulting to
 * `ongoing`, and only `ongoing` / `stopped` are written today), so the set is
 * spelled out rather than narrowed to an enum the wire does not promise.
 *
 * ONE set drives BOTH the green pill and the table's first sort key. A row the
 * eye reads as running must also be ranked as running: two lists of the same
 * words would let the colour and the order drift into disagreeing about which
 * campaigns are live.
 */
const ACTIVE_STATUSES = new Set(["active", "running", "ongoing", "live"]);
export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status.toLowerCase());
}

const RUNNING_STATUS_STYLE = "bg-green-50 text-green-700 border-green-200";
const STATUS_STYLES: Record<string, string> = {
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  stopped: "bg-gray-100 text-gray-500 border-gray-200",
  completed: "bg-gray-100 text-gray-500 border-gray-200",
  ended: "bg-gray-100 text-gray-500 border-gray-200",
};
/**
 * The two words this dashboard uses for a campaign: **Active** and **Paused**.
 *
 * campaign-service stores `ongoing` and `stopped`, which are its own internal
 * spellings and not words anyone outside this fleet says. Printing them verbatim
 * put two words for one concept on screen, so the wire value is translated here
 * and nowhere else.
 *
 * `stopped` reads **Paused** because that is now what it is from the customer's
 * side: the controls modal stops and restarts a campaign through the same status,
 * leaving its ceiling untouched, so a stopped campaign is one waiting to be turned
 * back on rather than one that has ended. It also keeps this pill and the modal's
 * own roll-up saying the SAME word about the same campaign — a row reading
 * "stopped" in the list beside a "Paused" pill on its own page is one campaign
 * described two ways.
 *
 * Only the LABEL moves: `isActiveStatus` remains the single definition of what
 * running MEANS, and it still drives the colour and the table's first sort key.
 * Any other word campaign-service may write is printed as it comes.
 */
function statusLabel(status: string): string {
  if (isActiveStatus(status)) return "Active";
  return status.toLowerCase() === "stopped" ? "Paused" : status;
}

/**
 * The campaign's own status. There is no state invented here: a campaign a brand has
 * been running keeps running when that brand funds its funnels, so the page never has
 * to explain away a live campaign that never gets a turn.
 */
export function StatusPill({ status }: { status: string }) {
  const cls = isActiveStatus(status)
    ? RUNNING_STATUS_STYLE
    : (STATUS_STYLES[status.toLowerCase()] ?? "bg-gray-100 text-gray-600 border-gray-200");
  return (
    <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

/**
 * The channel this campaign runs on, drawn as brand Settings draws it: the
 * platform's own logo (or our duotone mark) beside the catalogue name. A slug we
 * carry no channel for keeps the prettified text and no tile — a mark we cannot
 * source is worse than none.
 *
 * It reads the campaign's OWN feature slug, because a channel IS a feature slug.
 * The workflow slug used to stand in for it, which answered "cold email" for
 * every email workflow whatever its offer — with two cold-email channels that
 * guess cannot tell them apart.
 */
export function ChannelCell({ featureSlug }: { featureSlug: string | null }) {
  const def = acquisitionChannelForFeatureSlug(featureSlug);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {def && <AcquisitionChannelMark def={def} size="sm" />}
      <span className="truncate">{def ? def.name : channelSlugLabel(featureSlug)}</span>
    </div>
  );
}

/**
 * What this campaign is buying, drawn as the funnel brand Settings names.
 *
 * It reads the campaign's OWN funnel key and NOTHING else. There is deliberately
 * no fallback to the goal: the goal is the retired, lossier vocabulary (two
 * funnels answer to `meetingBooked`), so deriving a funnel from it prints a
 * chain the campaign never stated. campaign-service persists the funnel on every
 * campaign, so a missing one is a real gap and reads as one.
 */
export function FunnelCell({ funnelKey }: { funnelKey: Campaign["funnelKey"] }) {
  const def = campaignFunnel(funnelKey);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {def && <SalesFunnelMark def={def} size="sm" />}
      <span className="truncate">{def ? def.name : "—"}</span>
    </div>
  );
}

/**
 * WHICH campaign this row is, in one cell: the funnel it sells, and under it the
 * channel it sells through.
 *
 * A campaign IS (offer x funnel x channel), so naming one without the other names
 * half of it — which is why these were never two independent answers, only two
 * columns. One cell states the pair once, at every width, so there is no width at
 * which a reader sees half the identity and no width at which either value is on
 * screen twice.
 *
 * The funnel LEADS because it is what the campaign is buying; the channel is where
 * it goes to buy it, so it reads quieter and prefixed ("Via"). Same two components
 * and the same two bindings as before — a second reading of either value is how one
 * row comes to say two things.
 *
 * The text block is pinned to the funnel tile's own height (`h-8` = the `sm` mark's
 * 32px) and its two lines are given leadings that add to exactly that (14 + 18), so
 * the row's height is the icon's rather than whatever the two lines happen to need.
 * The channel mark is `xs` (18px), which is why line two carries the 18.
 */
export function CampaignCell({ campaign }: { campaign: Campaign }) {
  const funnel = campaignFunnel(campaign.funnelKey);
  const channel = acquisitionChannelForFeatureSlug(campaign.featureSlug);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {funnel && <SalesFunnelMark def={funnel} size="sm" />}
      <div className="flex h-8 min-w-0 flex-col justify-center">
        <span className="truncate leading-[14px] text-gray-800">
          {funnel ? funnel.name : "—"}
        </span>
        <span className="flex h-[18px] min-w-0 items-center gap-1 text-xs leading-[18px] text-gray-500">
          <span className="shrink-0">Via</span>
          {channel && <AcquisitionChannelMark def={channel} size="xs" />}
          <span className="truncate">
            {channel ? channel.name : channelSlugLabel(campaign.featureSlug)}
          </span>
        </span>
      </div>
    </div>
  );
}

// One row = a campaign joined to its revenue group and to its own daily ceiling.
interface CampaignRow {
  campaign: Campaign;
  revenue: CampaignRevenueGroup | null;
  /** billing's ceiling for THIS campaign, in cents. Null = billing had no answer. */
  budgetCents: number | null;
}


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
  const budgetsQ = useAuthQuery(["brandFunnelBudgets", brandId], () =>
    getBrandFunnelBudgets(brandId),
  );

  const campaigns = useMemo(() => campaignsQ.data?.campaigns ?? [], [campaignsQ.data]);
  // The table is the campaigns a brand RUNS on THIS feature — one line per live campaign.
  //
  // Two filters, and both are load-bearing:
  //
  // Feature. `listCampaignsByBrand` answers for the whole brand, so it also returns the
  // brand's PR, AI-visibility and VC campaigns — products that run no sales funnel and
  // whose figures this table never fetched: `getFeatureRevenueByCampaign` is scoped to
  // `featureSlug`. So those rows arrived with no group and rendered `— / — / —` under a
  // Sales funnel column they can never fill. A table listing one population and pricing
  // another is the incoherence, not merely the clutter.
  //
  // Status. campaign-service enforces at most one `ongoing` campaign per identity —
  // (org, brand, funnel, channel), migration 0044 — so filtering on its own status yields
  // exactly one line per live campaign, and features-service totals each identity
  // server-side (a campaign's stopped ancestors' runs ride on its live campaign's group).
  // A stopped campaign is history, not a line.
  //
  // Offer. A campaign is (offer x funnel x channel), so an offer-scoped surface
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
  // exists to keep out the brand's PR, AI-visibility and VC campaigns, which run no
  // sales funnel and can never fill these columns — so the offer-scoped test asks
  // exactly that instead: is this campaign's feature an ACQUISITION CHANNEL? The
  // catalogue answers, so a third channel needs no edit here.
  //
  // The brand-scoped list (no offer) is untouched and stays pinned to its one
  // feature: with no offer to bound it, spanning channels would mix propositions.
  const featureCampaigns = useMemo(
    () =>
      campaigns.filter((c) =>
        offerId
          ? c.offerId === offerId && acquisitionChannelForFeatureSlug(c.featureSlug) !== null
          : c.featureSlug === featureSlug,
      ),
    [campaigns, featureSlug, offerId],
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
  // features get a revenue PAGE, and this is a data read. A channel sells a sales
  // funnel, so it has money to report; if it has none yet the groups come back empty
  // and the row reads `—`, which is the honest answer rather than a withheld one.
  const channelGroupQs = useQueries({
    queries: channelSlugs.map((slug) => ({
      queryKey: ["featureRevenueByCampaign", brandId, slug] as const,
      queryFn: () => getFeatureRevenueByCampaign(slug, brandId),
      enabled: orgConsistent && acquisitionChannelForFeatureSlug(slug) !== null,
      refetchInterval: POLL_INTERVAL,
    })),
  });
  const liveCampaigns = useMemo(
    () => featureCampaigns.filter((c) => isActiveStatus(c.status)),
    [featureCampaigns],
  );
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

  // Ordered by ROI DESC. Every row is running by construction (the live filter above), so
  // there is no status term — the order is the ROI column the table leads with, because a
  // table that displays one order and sorts by another reads as unordered. A campaign with
  // no ROI yet has nothing to rank on, so it sits last rather than at zero.
  //
  // Each row's ceiling is narrowed by the campaign's OWN `offerId`, not by the
  // surface's: billing's per-pair figure spans every offer selling that pair, so
  // a row that borrowed the pair total would state a sibling offer's money under
  // this campaign's name. Reading the row's own offer makes the brand-scoped list
  // and the offer-scoped one state the same number for the same campaign.
  const budgets = budgetsQ.data;
  const rows = useMemo<CampaignRow[]>(() => {
    const joined = liveCampaigns.map((c) => ({
      campaign: c,
      revenue: groupsById.get(c.id) ?? null,
      budgetCents: campaignBudgetCents(c, c.offerId ?? undefined, budgets),
    }));
    return joined.sort((a, b) => (b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1));
  }, [liveCampaigns, groupsById, budgets]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed gate
  // query (CLAUDE.md: reveal-on-settle). The per-channel fan-out is in the gate for
  // the same reason the others are: one channel's read failing must not hold the
  // table, and one still loading must not let it paint half its money.
  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (groupsQ.data !== undefined || groupsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError) &&
    channelGroupQs.every((q) => q.data !== undefined || q.isError);

  return { rows, settled, featureCampaigns };
}

export function CampaignsTable({
  brandId,
  featureSlug,
  basePath,
  offerId,
}: {
  brandId: string;
  featureSlug: string;
  /** `/orgs/:orgId/brands/:brandId/offers/:offerId` — a row opens that campaign underneath it. */
  basePath: string;
  /** The OFFER whose campaigns to list. Omitted → every campaign of the brand. */
  offerId?: string;
}) {
  const router = useRouter();
  const { rows, settled, featureCampaigns } = useCampaignRows(brandId, featureSlug, offerId);

  return (
    /* Below `md` the row narrows to the two things a reader can act on: what the
       campaign returns, and which campaign it is. Both are columns at EVERY width
       now — `Campaign` states the funnel and the channel together, so the pair
       needs no separate mobile stacking and no width can show half an identity.

       The floor is gated at the breakpoint the money columns come back:
       unconditional, it re-widens the row past a phone's viewport even with five
       columns hidden, so the two that survived get pushed off to the right and
       read as missing. `table-fixed` below `md` is what makes the truncation bite
       — in the default auto layout a column grows to its content, so one long
       funnel name widens the whole row however many `truncate`s it carries. */
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full table-fixed text-sm md:table-auto md:min-w-[760px]">
        <thead>
          {/* Identity first, then the return the table is sorted by.
              Header chrome byte-equal to the Leads table (`engaged-leads-page`),
              which is the dashboard's reference entity table: a heavier,
              differently-tracked header reads as a different product. */}
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            {/* Which campaign, first: the funnel it sells with the channel under
                it. It is the row's identity, so it leads at every width — the two
                columns it replaces stated one thing in two places. */}
            <th className="px-4 py-3 w-[70%] md:w-auto">Campaign</th>
            <th className="px-4 py-3 text-right w-[30%] md:w-auto"><NumericHead label="ROI" tip={COLUMN_INFO.roi} /></th>
            <th className="px-4 py-3 text-right hidden md:table-cell"><NumericHead label="% CAC" tip={COLUMN_INFO.cacPct} /></th>
            <th className="px-4 py-3 text-right hidden md:table-cell"><NumericHead label="$ Revenue" tip={COLUMN_INFO.revenue} /></th>
            <th className="px-4 py-3 text-right hidden md:table-cell"><NumericHead label="$ Invested" tip={COLUMN_INFO.invested} /></th>
            {/* The ceiling sits beside the status because the two answer one
                question together — is this campaign running, and how hard. It is
                deliberately NOT in the money block on the left: those are charges
                and projections of charges, and a budget is neither. */}
            <th className="px-4 py-3 text-right hidden md:table-cell"><NumericHead label="$ Budget" tip={COLUMN_INFO.budget} /></th>
            <th className="px-4 py-3 hidden md:table-cell">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {!settled ? (
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td className="px-4 py-3" colSpan={7}>
                  <Skeleton className="h-5 w-full" />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>
                {featureCampaigns.length === 0 ? "No campaigns yet." : "No active campaigns."}
              </td>
            </tr>
          ) : (
            rows.map(({ campaign, revenue, budgetCents }) => (
              <tr
                key={campaign.id}
                onClick={() => router.push(`${basePath}/campaigns/${campaign.id}`)}
                className="cursor-pointer transition hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-gray-800"><CampaignCell campaign={campaign} /></td>
                <td className="px-4 py-3 text-right"><RoiCell multiple={revenue?.roiMultiple} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">{fmtPct(revenue?.costOfAcquisitionPct)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">{fmtUsd(revenue?.totalPipelineUsd)}</td>
                {/* `costEconomics.committedCostUsd`, read verbatim off the same
                    `pricing=net` group — the exact number the ROI and %CAC beside it
                    divide by, so a row cannot contradict its own return. A row with no
                    group at all reads `—` rather than $0 — "we have no figure" and "it
                    cost nothing" differ. */}
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">{fmtUsd(revenue?.committedCostUsd)}</td>
                {/* Whole dollars, always: a ceiling is a configured whole-dollar
                    value. `$0` is a real answer — the campaign is stopped — and a
                    dash means billing had none, which is a different statement. */}
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden md:table-cell">
                  {fmtDailyBudgetUsd(budgetCents)}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <StatusPill status={campaign.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
