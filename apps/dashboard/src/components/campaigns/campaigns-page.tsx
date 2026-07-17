"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useIsAdminUser } from "@/lib/use-admin-user";
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
import { MaturityBadge } from "@/components/maturity-badge";
import { NewCampaignModal } from "@/components/campaigns/new-campaign-modal";
import { Skeleton } from "@/components/skeleton";

// Every displayed number here is a READY features-service field. The only
// non-formatting client work is (a) joining the campaign row (channel/name from
// campaign-service) to its revenue group by campaignId, and (b) picking the #1
// channel = argmax of already-fetched per-campaign pipeline. Both are display
// arrangements of wire data, never a derived metric (CLAUDE.md: a displayed stat
// is features-service-owned, never computed in the browser).

// Cold-email product → the "acquisition channel" is the campaign's workflow.
// Prettify the slug for display (e.g. "sales-cold-email-outreach" → "Sales cold
// email outreach"); until a friendlier server-owned label exists this is a pure
// display lookup.
function channelLabel(workflowSlug: string | null): string {
  if (!workflowSlug) return "—";
  return workflowSlug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function fmtUsd(usd: number | null | undefined): string {
  return usd == null ? "—" : formatUsdAdaptive(usd);
}
function fmtRoi(multiple: number | null | undefined): string {
  return multiple == null ? "—" : `${multiple.toFixed(1)}×`;
}
function fmtPct(pct: number | null | undefined): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  running: "bg-green-50 text-green-700 border-green-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  stopped: "bg-gray-100 text-gray-500 border-gray-200",
  completed: "bg-gray-100 text-gray-500 border-gray-200",
};
function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status.toLowerCase()] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {status}
    </span>
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
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
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
  const isAdmin = useIsAdminUser();
  const featureSlug = useSoleFeatureSlug();
  const revenueEnabled = isRevenueFeature(featureSlug);
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const [newOpen, setNewOpen] = useState(false);

  // Campaign rows (name / status / channel / budget) — campaign-service.
  const campaignsQ = useAuthQuery(
    ["campaigns", brandId],
    () => listCampaignsByBrand(brandId),
    { enabled: isAdmin, refetchInterval: POLL_INTERVAL },
  );

  // Per-campaign stats (pipeline / $CAC / ROI / %CAC) — features-service, one call.
  const groupsQ = useAuthQuery(
    ["featureRevenueByCampaign", brandId, featureSlug],
    () => getFeatureRevenueByCampaign(featureSlug, brandId),
    { enabled: isAdmin && revenueEnabled, refetchInterval: POLL_INTERVAL },
  );

  // Brand-level (ungrouped) revenue — the global header's blended pipeline + $CAC.
  // Read straight off features-service (never a client sum/average of the groups).
  const brandRevenueQ = useAuthQuery(
    ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId),
    {
      enabled: isAdmin && revenueEnabled,
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

  // Rows sorted by pipeline DESC (biggest first); nulls last.
  const rows = useMemo<CampaignRow[]>(() => {
    const joined = campaigns.map((c) => ({ campaign: c, revenue: groupsById.get(c.id) ?? null }));
    return joined.sort((a, b) => (b.revenue?.totalPipelineUsd ?? -1) - (a.revenue?.totalPipelineUsd ?? -1));
  }, [campaigns, groupsById]);

  // #1 acquisition channel = the channel of the top-pipeline campaign (display
  // argmax over already-fetched rows, not a hidden metric).
  const topChannel = useMemo(() => {
    const top = rows.find((r) => (r.revenue?.totalPipelineUsd ?? 0) > 0);
    return top ? channelLabel(top.campaign.workflowSlug) : "—";
  }, [rows]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed
  // gate query (CLAUDE.md: reveal-on-settle). The header waits on the brand-level
  // revenue; the table waits on campaigns + groups.
  const headerSettled = brandRevenueQ.data !== undefined || brandRevenueQ.isError;
  const tableSettled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (groupsQ.data !== undefined || groupsQ.isError);

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-md mx-auto mt-16 bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h1 className="font-display font-bold text-lg text-gray-800 mb-2">Not available</h1>
          <p className="text-gray-600 text-sm">This preview is staff-only.</p>
        </div>
      </div>
    );
  }

  const globalPipeline = brandRevenueQ.data?.totalPipelineUsd ?? null;
  const globalCac = brandRevenueQ.data?.costEconomics.costPerConversionUsd ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full p-4 md:p-8">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-gray-800">Campaigns</h1>
            <MaturityBadge level="beta" />
          </div>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              New campaign
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Campaign-centered view of this brand&apos;s pipeline, cost, and return.
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
              <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3 text-right">Pipeline</th>
                <th className="px-4 py-3 text-right">$ CAC</th>
                <th className="px-4 py-3 text-right">ROI</th>
                <th className="px-4 py-3 text-right">% CAC</th>
              </tr>
            </thead>
            <tbody>
              {!tableSettled ? (
                [0, 1, 2].map((i) => (
                  <tr key={`sk-${i}`} className="border-b border-gray-100">
                    <td className="px-4 py-3" colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>
                    No campaigns yet.
                  </td>
                </tr>
              ) : (
                rows.map(({ campaign, revenue }) => (
                  <tr
                    key={campaign.id}
                    onClick={() => router.push(`${basePath}/campaigns/${campaign.id}`)}
                    className="border-b border-gray-100 cursor-pointer transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{campaign.name}</td>
                    <td className="px-4 py-3"><StatusPill status={campaign.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{channelLabel(campaign.workflowSlug)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">{fmtUsd(revenue?.totalPipelineUsd)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUsd(revenue?.costPerConversionUsd)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtRoi(revenue?.roiMultiple)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtPct(revenue?.costOfAcquisitionPct)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {newOpen && rows[0] && (
        <NewCampaignModal
          template={rows[0].campaign}
          basePath={basePath}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}
