"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import {
  listCampaignsByBrand,
  getFeatureRevenueByCampaign,
  type Campaign,
  type CampaignRevenueGroup,
} from "@/lib/api";
import { formatUsdAdaptive } from "@/lib/format-number";
import { acquisitionChannelForWorkflowSlug } from "@/lib/acquisition-channels";
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
function fmtPct(pct: number | null | undefined): string {
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
const COLUMN_INFO = {
  roi: "What a customer is worth over their lifetime, divided by what it costs to win one. 11.7x means every $1 spent is projected to return $11.70. Based on the conversion rates and lifetime revenue set in Brand Settings.",
  cacPct:
    "What winning a customer costs, as a share of what that customer is worth over their lifetime. 9% means $9 spent for every $100 earned. Lower is better, and it is the inverse of ROI.",
  revenue:
    "Expected pipeline revenue: the outcomes this campaign has produced so far, valued with the conversion rates and customer lifetime revenue you set in Brand Settings. It is a projection of what this pipeline is worth, not money already collected.",
  invested:
    "What this campaign has cost so far, net of any discount: money already billed plus money reserved for emails it has queued. It is the same figure the ROI and % CAC beside it are calculated from. Those two are projections of what it is worth going forward, so this is not a multiplier of them.",
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
export function useCampaignRows(brandId: string, featureSlug: string) {
  const revenueEnabled = isRevenueFeature(featureSlug);

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
  const featureCampaigns = useMemo(
    () => campaigns.filter((c) => c.featureSlug === featureSlug),
    [campaigns, featureSlug],
  );
  const liveCampaigns = useMemo(
    () => featureCampaigns.filter((c) => isActiveStatus(c.status)),
    [featureCampaigns],
  );
  const groupsById = useMemo(() => {
    const m = new Map<string, CampaignRevenueGroup>();
    for (const g of groupsQ.data ?? []) m.set(g.campaignId, g);
    return m;
  }, [groupsQ.data]);

  // Ordered by ROI DESC. Every row is running by construction (the live filter above), so
  // there is no status term — the order is the ROI column the table leads with, because a
  // table that displays one order and sorts by another reads as unordered. A campaign with
  // no ROI yet has nothing to rank on, so it sits last rather than at zero.
  const rows = useMemo<CampaignRow[]>(() => {
    const joined = liveCampaigns.map((c) => ({ campaign: c, revenue: groupsById.get(c.id) ?? null }));
    return joined.sort((a, b) => (b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1));
  }, [liveCampaigns, groupsById]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed gate
  // query (CLAUDE.md: reveal-on-settle).
  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (groupsQ.data !== undefined || groupsQ.isError);

  return { rows, settled, featureCampaigns };
}

export function CampaignsTable({
  brandId,
  featureSlug,
  basePath,
}: {
  brandId: string;
  featureSlug: string;
  /** `/orgs/:orgId/brands/:brandId` — a row opens that campaign underneath it. */
  basePath: string;
}) {
  const router = useRouter();
  const { rows, settled, featureCampaigns } = useCampaignRows(brandId, featureSlug);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          {/* Return first: the table is sorted by ROI, so it leads with the
              column that decides the order.
              Header chrome byte-equal to the Leads table (`engaged-leads-page`),
              which is the dashboard's reference entity table: a heavier,
              differently-tracked header reads as a different product. */}
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 text-right"><NumericHead label="ROI" tip={COLUMN_INFO.roi} /></th>
            <th className="px-4 py-3 text-right"><NumericHead label="% CAC" tip={COLUMN_INFO.cacPct} /></th>
            <th className="px-4 py-3 text-right"><NumericHead label="$ Revenue" tip={COLUMN_INFO.revenue} /></th>
            <th className="px-4 py-3 text-right"><NumericHead label="$ Invested" tip={COLUMN_INFO.invested} /></th>
            <th className="px-4 py-3">Sales funnel</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Status</th>
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
            rows.map(({ campaign, revenue }) => (
              <tr
                key={campaign.id}
                onClick={() => router.push(`${basePath}/campaigns/${campaign.id}`)}
                className="cursor-pointer transition hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-right"><RoiCell multiple={revenue?.roiMultiple} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtPct(revenue?.costOfAcquisitionPct)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUsd(revenue?.totalPipelineUsd)}</td>
                {/* `costEconomics.committedCostUsd`, read verbatim off the same
                    `pricing=net` group — the exact number the ROI and %CAC beside it
                    divide by, so a row cannot contradict its own return. A row with no
                    group at all reads `—` rather than $0 — "we have no figure" and "it
                    cost nothing" differ. */}
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUsd(revenue?.committedCostUsd)}</td>
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
  );
}
