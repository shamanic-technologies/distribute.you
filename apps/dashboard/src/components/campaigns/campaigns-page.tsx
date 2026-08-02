"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import {
  listCampaignsByBrand,
  getFeatureRevenue,
  getFeatureRevenueByCampaign,
  keepLastGoodFeatureRevenue,
  type Campaign,
  type CampaignRevenueGroup,
} from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { formatUsdAdaptive } from "@/lib/format-number";
import { acquisitionChannelForWorkflowSlug } from "@/lib/acquisition-channels";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { channelSlugLabel } from "@/lib/campaign-title";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { Skeleton } from "@/components/skeleton";

// Every displayed number here is a READY features-service field. The only
// non-formatting client work is (a) joining the campaign row (channel/name from
// campaign-service) to its revenue group by campaignId, and (b) picking the #1
// channel = argmax of already-fetched per-campaign ROI. Both are display
// arrangements of wire data, never a derived metric (CLAUDE.md: a displayed stat
// is features-service-owned, never computed in the browser).

// The outreach "channel" is the campaign's workflow, and naming it lives in
// `campaign-title.ts`, beside the helper that composes a campaign's title out of
// the same halves. One home, so a campaign cannot read as one thing in this
// table and another in the heading of the page the row opens.

function fmtUsd(usd: number | null | undefined): string {
  return usd == null ? "—" : formatUsdAdaptive(usd);
}
function fmtRoi(multiple: number | null | undefined): string {
  return multiple == null ? "—" : `${multiple.toFixed(1)}×`;
}
function fmtPct(pct: number | null | undefined): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

/**
 * What each number column means, in the words a reader needs to trust it.
 *
 * All three are PROJECTIONS, and saying so is the point: the revenue is what the
 * outcomes so far are expected to be worth, not money collected, and ROI and
 * % CAC are computed from it. A column that reads as banked revenue when it is a
 * forecast is the same statement under two meanings.
 */
const COLUMN_INFO = {
  roi: "What a customer is worth over their lifetime, divided by what it costs to win one. 11.7x means every $1 spent is projected to return $11.70. Based on the conversion rates and lifetime revenue set in Brand Settings.",
  cacPct:
    "What winning a customer costs, as a share of what that customer is worth over their lifetime. 9% means $9 spent for every $100 earned. Lower is better, and it is the inverse of ROI.",
  revenue:
    "Expected pipeline revenue: the outcomes this campaign has produced so far, valued with the conversion rates and customer lifetime revenue you set in Brand Settings. It is a projection of what this pipeline is worth, not money already collected.",
} as const;

/** A right-aligned numeric header with its (i) sitting after the label. */
function NumericHead({ label, tip }: { label: string; tip: string }) {
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
function RoiCell({ multiple }: { multiple: number | null | undefined }) {
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
function isActiveStatus(status: string): boolean {
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
 * The word this dashboard uses for a campaign that is running: **Active**, the same
 * word the brand status pill already uses for the same idea.
 *
 * campaign-service stores `ongoing`, which is its own internal spelling and not a
 * word anyone outside this fleet says. Printing it verbatim put two words for one
 * concept on screen — the brand reads "Active" one page up while its campaigns read
 * "ongoing" — so the wire value is translated here and nowhere else. Only the LABEL
 * moves: `isActiveStatus` remains the single definition of what running MEANS, and
 * it still drives the colour and the table's first sort key.
 */
function statusLabel(status: string): string {
  return isActiveStatus(status) ? "Active" : status;
}

/**
 * The campaign's own status. There is no state invented here: a campaign a brand has
 * been running keeps running when that brand funds its funnels, so the page never has
 * to explain away a live campaign that never gets a turn.
 */
function StatusPill({ status }: { status: string }) {
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
 */
function ChannelCell({ workflowSlug }: { workflowSlug: string | null }) {
  const def = acquisitionChannelForWorkflowSlug(workflowSlug);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {def && <AcquisitionChannelMark def={def} size="sm" />}
      <span className="truncate">{def ? def.name : channelSlugLabel(workflowSlug)}</span>
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
function FunnelCell({ funnelKey }: { funnelKey: Campaign["funnelKey"] }) {
  const def = campaignFunnel(funnelKey);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {def && <SalesFunnelMark def={def} size="sm" />}
      <span className="truncate">{def ? def.name : "—"}</span>
    </div>
  );
}

// One row = a campaign joined to its revenue group.
interface CampaignRow {
  campaign: Campaign;
  revenue: CampaignRevenueGroup | null;
}

function StatTile({ label, value, pending }: { label: string; value: string; pending: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Card label in the dashboard's own eyebrow: `text-xs font-medium
          text-gray-400 uppercase tracking-wide`, the same one `top-audiences-card`
          and `revenue-cost-summary` use. */}
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      {pending ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      )}
    </div>
  );
}

export function CampaignsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = String(params.orgId);
  const brandId = String(params.brandId);
  const featureSlug = useSoleFeatureSlug();
  const revenueEnabled = isRevenueFeature(featureSlug);
  const basePath = `/orgs/${orgId}/brands/${brandId}`;

  // Campaign rows (name / status / channel / budget) — campaign-service.
  const campaignsQ = useAuthQuery(
    ["campaigns", brandId],
    () => listCampaignsByBrand(brandId),
    { refetchInterval: POLL_INTERVAL },
  );

  // Per-campaign stats (ROI / %CAC / expected pipeline revenue) — features-service,
  // one call. The group also carries a per-campaign $CAC; the table no longer has
  // a column for it, and the brand-level one still heads the page.
  const groupsQ = useAuthQuery(
    ["featureRevenueByCampaign", brandId, featureSlug],
    () => getFeatureRevenueByCampaign(featureSlug, brandId),
    { enabled: revenueEnabled, refetchInterval: POLL_INTERVAL },
  );

  // Brand-level (ungrouped) revenue — the global header's blended pipeline + $CAC.
  // Read straight off features-service (never a client sum/average of the groups).
  const brandRevenueQ = useAuthQuery(
    ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId),
    {
      enabled: revenueEnabled,
      refetchInterval: POLL_INTERVAL,
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
    },
  );

  const campaigns = useMemo(() => campaignsQ.data?.campaigns ?? [], [campaignsQ.data]);
  const groupsById = useMemo(() => {
    const m = new Map<string, CampaignRevenueGroup>();
    for (const g of groupsQ.data ?? []) m.set(g.campaignId, g);
    return m;
  }, [groupsQ.data]);

  // Rows ordered by STATUS first, then ROI DESC inside each group. A campaign
  // that is not running cannot be acted on today, so it sits under the ones that
  // can, however good its return was — and the status it is ranked on is the one
  // its own pill states (`isActiveStatus`, the single definition above). Within a
  // group the order is the ROI column the table leads with, because a table that
  // displays one order and sorts by another reads as unordered. A campaign with
  // no ROI yet has nothing to rank on, so it sits last in its group rather than
  // at zero.
  const rows = useMemo<CampaignRow[]>(() => {
    const joined = campaigns.map((c) => ({ campaign: c, revenue: groupsById.get(c.id) ?? null }));
    return joined.sort((a, b) => {
      const byStatus = Number(isActiveStatus(b.campaign.status)) - Number(isActiveStatus(a.campaign.status));
      if (byStatus !== 0) return byStatus;
      return (b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1);
    });
  }, [campaigns, groupsById]);

  // #1 acquisition channel = the channel of the best-ROI RUNNING campaign, named
  // as the brand Settings catalogue names it (display argmax over already-fetched
  // rows, not a hidden metric). It reads the SAME ranking the table is sorted by
  // — status first, then ROI — so the tile and the first row cannot name two
  // different campaigns, and the tile names a channel that is actually live
  // rather than one that stopped months ago.
  const topChannel = useMemo(() => {
    const top = rows.find((r) => r.revenue?.roiMultiple != null);
    if (!top) return "—";
    const def = acquisitionChannelForWorkflowSlug(top.campaign.workflowSlug);
    return def ? def.name : channelSlugLabel(top.campaign.workflowSlug);
  }, [rows]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed
  // gate query (CLAUDE.md: reveal-on-settle). The header waits on the brand-level
  // revenue; the table waits on campaigns + groups.
  const headerSettled = brandRevenueQ.data !== undefined || brandRevenueQ.isError;
  const tableSettled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (groupsQ.data !== undefined || groupsQ.isError);

  const globalPipeline = brandRevenueQ.data?.totalPipelineUsd ?? null;
  const globalCac = brandRevenueQ.data?.costEconomics.costPerConversionUsd ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full p-4 md:p-8">
        {/* No create control here: a campaign is set up with us, not spun up from
            a table row, so the page reads this brand's campaigns and nothing more. */}
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-xl font-bold text-gray-800">Campaigns</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Campaign-by-campaign view of this brand&apos;s pipeline, cost, and return.
        </p>

        {/* Global stats header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatTile label="Pipeline generated" value={fmtUsd(globalPipeline)} pending={!headerSettled} />
          <StatTile label="Cost per acquisition" value={fmtUsd(globalCac)} pending={!headerSettled} />
          <StatTile label="#1 acquisition channel" value={topChannel} pending={!tableSettled} />
        </div>

        {/* Campaigns table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              {/* Return first: the table is sorted by ROI, so it leads with the
                  column that decides the order.
                  Header chrome byte-equal to the Leads table (`engaged-leads-page`),
                  which is the dashboard's reference entity table: a heavier,
                  differently-tracked header reads as a different product. */}
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-right"><NumericHead label="ROI" tip={COLUMN_INFO.roi} /></th>
                <th className="px-4 py-3 text-right"><NumericHead label="% CAC" tip={COLUMN_INFO.cacPct} /></th>
                <th className="px-4 py-3 text-right"><NumericHead label="Revenue" tip={COLUMN_INFO.revenue} /></th>
                <th className="px-4 py-3">Sales funnel</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!tableSettled ? (
                [0, 1, 2].map((i) => (
                  <tr key={`sk-${i}`}>
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                    No campaigns yet.
                  </td>
                </tr>
              ) : (
                rows.map(({ campaign, revenue }) => (
                  <tr
                    key={campaign.id}
                    onClick={() => router.push(`${basePath}/campaigns/${campaign.id}`)}
                    className="cursor-pointer transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-right"><RoiCell multiple={revenue?.roiMultiple} /></td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtPct(revenue?.costOfAcquisitionPct)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUsd(revenue?.totalPipelineUsd)}</td>
                    <td className="px-4 py-3 text-gray-800">
                      <FunnelCell funnelKey={campaign.funnelKey} />
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <ChannelCell workflowSlug={campaign.workflowSlug} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={campaign.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
