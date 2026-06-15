"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getFeatureOutcomes,
  getBrandCostBreakdown,
  fetchFeatureStats,
  listBrandLeads,
} from "@/lib/api";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { ScoreCard } from "@/components/visibility/score-card";
import { MaturityBadge } from "@/components/maturity-badge";
import { PersonaStatsCard } from "@/components/revenue/persona-stats-card";
import { ConversionsTabs } from "@/components/revenue/conversions-tabs";
import { PersonaConversionsTable } from "@/components/revenue/conversions-table";
import { RunCampaignModal } from "@/components/campaign/run-campaign-modal";
import { DEFAULT_BUDGET, formatBudget, type BudgetSelection } from "@/lib/mock-campaign-budget";
import { buildSignupRevenueSeries } from "@/lib/signups-revenue-series";

const formatCount = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US");
const formatUsd = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const formatUsdFromCents = (cents: number | null | undefined): string =>
  cents === null || cents === undefined
    ? "—"
    : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

/**
 * Signups page — mirrors the brand OVERVIEW (pipeline-revenue chart + cost
 * summary + top campaigns + Organizations/Leads tabs) but fed the SIGNUPS-lensed
 * revenue (`getFeatureOutcomes(..., "signups")`), so every section is filtered
 * to signups. The stat row shows only signups-relevant metrics (Clicks · Signups
 * · Cost per signup · Signup revenue) — no booked-meetings stats. Adds a
 * "Stats by Customer Persona" section (mock) and the Run Campaign modal.
 *
 * Beta-gated (Kevin + Adam). The other two lenses (booked-meetings / sales)
 * keep the plainer `OutcomePage`.
 */
export function SignupsOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = useSoleFeatureSlug();

  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);
  const enabled = isBeta && revenueOk;
  const basePath = `/orgs/${orgId}/brands/${brandId}`;

  // Mock campaign state — once "launched" via the modal, the page shows a green
  // "Campaign active · $X/day" pill instead of the Run Campaign button. Persisted
  // to sessionStorage (per brand) so the demo survives a reload. No real campaign.
  interface CampaignState {
    active: boolean;
    budget: BudgetSelection;
  }
  const storageKey = `signups-campaign:${brandId}`;
  const [campaign, setCampaign] = useState<CampaignState>(() => {
    if (typeof window === "undefined") return { active: false, budget: DEFAULT_BUDGET };
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as CampaignState;
    } catch {
      /* ignore */
    }
    return { active: false, budget: DEFAULT_BUDGET };
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(campaign));
    } catch {
      /* ignore */
    }
  }, [storageKey, campaign]);

  const [modalMode, setModalMode] = useState<null | "create" | "edit">(null);

  const { data: brandData, isPending: brandLoading } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    pollOptions,
  );
  const brand = brandData?.brand ?? null;

  // Signups-lensed revenue — same shape as the overview's getFeatureRevenue but
  // filtered to the signups signal (clicks → site → signup), so chart / CAC-ROI
  // / leads / orgs all become signups-scoped.
  const { data } = useAuthQuery(
    ["featureOutcomes", brandId, featureSlug, "signups"],
    () => getFeatureOutcomes(featureSlug, brandId, "signups"),
    { enabled, ...pollOptionsSlow },
  );

  const { data: costData } = useAuthQuery(
    ["brandCostBreakdown", { brandId, featureSlug }],
    () => getBrandCostBreakdown(brandId, { featureSlug }),
    { enabled, ...pollOptions },
  );

  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureSlug, brandId],
    () => fetchFeatureStats(featureSlug, { brandId }),
    { enabled, ...pollOptions },
  );
  const featureStats = featureStatsData?.stats ?? {};

  // Real brand leads → used to synthesize the expected-revenue chart curve from
  // engaged leads' activity dates (the lensed /revenue has no dated series yet).
  const { data: leadsData } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    { enabled, ...pollOptions },
  );

  const revenueRevealed = useCoordinatedReveal([data !== undefined]);
  const costRevealed = useCoordinatedReveal([costData !== undefined]);
  const statsRevealed = useCoordinatedReveal([featureStatsData !== undefined]);

  // The signups-lensed `/revenue` returns a total but NO dated time-series yet,
  // so the chart read "No dated revenue yet". Synthesize an expected-revenue
  // curve from the engaged leads' dates, scaled to the real total (mockup).
  const nowMs = useMemo(() => Date.now(), []);
  const chartData = useMemo(() => {
    if (!data) return data;
    if (data.timeSeries && data.timeSeries.length > 0) return data;
    const series = buildSignupRevenueSeries(leadsData?.leads ?? [], data.totalPipelineUsd ?? 0, nowMs);
    return series.length ? { ...data, timeSeries: series } : data;
  }, [data, leadsData, nowMs]);

  // Header — always paints (static shell), carries identity + the Run Campaign
  // action even while the body loads.
  const header = (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Signups</h1>
          <MaturityBadge level="beta" />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Track the conversion funnel from clicks to paid signups.
        </p>
      </div>
      {campaign.active ? (
        // Active campaign — green status pill showing the budget; click to edit.
        <button
          type="button"
          onClick={() => setModalMode("edit")}
          title="Edit budget"
          className="group shrink-0 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-300"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Campaign active
          <span className="text-green-300">·</span>
          <span className="font-semibold">{formatBudget(campaign.budget)}</span>
          <svg className="w-3.5 h-3.5 text-green-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setModalMode("create")}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7a14.9 14.9 0 01.06-.312 15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312" />
          </svg>
          Run Campaign
        </button>
      )}
    </div>
  );

  // Create flow → launches a (mock) campaign; Edit flow → budget-only.
  const modals = (
    <>
      <RunCampaignModal
        open={modalMode === "create"}
        mode="create"
        onClose={() => setModalMode(null)}
        brandId={brandId}
        initialBudget={campaign.budget}
        onLaunch={(b) => setCampaign({ active: true, budget: b })}
      />
      <RunCampaignModal
        open={modalMode === "edit"}
        mode="edit"
        onClose={() => setModalMode(null)}
        brandId={brandId}
        initialBudget={campaign.budget}
        onLaunch={(b) => setCampaign((c) => ({ ...c, budget: b }))}
      />
    </>
  );

  if (!enabled) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  if (!brandLoading && !brand) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <p className="text-gray-500 mb-3">Brand not found</p>
        <Link href={`/orgs/${orgId}/brands`} className="text-sm text-brand-600 hover:underline">
          ← Back to brands
        </Link>
      </div>
    );
  }

  // No signup pipeline yet → header + CTA (keeps the Run Campaign action visible).
  if (revenueRevealed && data && data.totalPipelineUsd === null) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {header}
        <RevenueEmptyState setupHref={`${basePath}/campaigns/new`} />
        {modals}
      </div>
    );
  }

  // Signups-only stat row (no booked-meetings). Values from featureStats (real
  // clicks/CPC) + signups-lensed costEconomics + pipeline revenue.
  const signupStatRow = (
    <div className="flex flex-nowrap gap-3 overflow-x-auto mb-6">
      <div className="flex-1 min-w-[120px]">
        <ScoreCard label="Clicks" value={formatCount(featureStats.recipientsClicked ?? null)} pending={!statsRevealed} />
      </div>
      <div className="flex-1 min-w-[120px]">
        <ScoreCard
          label="Cost per click"
          tooltip="Cost per click — total spent divided by link clicks."
          value={formatUsdFromCents(featureStats.costPerRecipientClickCents)}
          pending={!statsRevealed}
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <ScoreCard
          label="Signups"
          badge={<MaturityBadge level="beta" />}
          value={formatCount(data?.costEconomics.expectedConversions)}
          pending={!revenueRevealed}
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <ScoreCard
          label="Cost per signup"
          badge={<MaturityBadge level="beta" />}
          value={formatUsd(data?.costEconomics.costPerConversionUsd)}
          pending={!revenueRevealed}
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <ScoreCard
          label="Signup revenue"
          badge={<MaturityBadge level="beta" />}
          tooltip="Expected pipeline revenue from signups."
          value={formatUsd(data?.totalPipelineUsd)}
          pending={!revenueRevealed}
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {header}
      <div className="space-y-6">
        <RevenueOverviewSection
          data={revenueRevealed ? chartData : undefined}
          revenuePending={!revenueRevealed}
          costPending={!costRevealed}
          newCampaignHref={`${basePath}/campaigns/new`}
          costBreakdown={costData?.costs ?? []}
          brandId={brandId}
          featureSlug={featureSlug}
          basePath={basePath}
          topRow={signupStatRow}
          hideHeader
          conversions={
            // The Overview's Organizations / Leads tabs PLUS a leading "Personas"
            // tab (org × user rows with a mock persona column).
            <ConversionsTabs
              data={chartData}
              pending={!revenueRevealed}
              extraFirstTab={{
                label: "Personas",
                content: <PersonaConversionsTable leads={chartData?.leads ?? []} />,
              }}
            />
          }
        />
        <PersonaStatsCard />
      </div>
      {modals}
    </div>
  );
}
