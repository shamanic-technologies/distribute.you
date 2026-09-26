"use client";

import { ScopePaymentDeclinedBand } from "@/components/billing/scope-payment-declined-band";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, getBrandRevenue, keepLastGoodFeatureRevenue } from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { pollOptions } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { formatCentsAsUsdAdaptive, formatCount } from "@/lib/format-number";
import { isLearning } from "@/lib/learning-threshold";
import { cumulativeWindow, dailyWindow, utcDay } from "@/lib/v2/series";
import { MaturityBadge } from "@/components/maturity-badge";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { LearningToneProvider } from "@/components/learning-tag";
import { PerformanceCard } from "@/components/v2/performance-card";
import { MissionsTable } from "@/components/v2/missions-table";
import { LastReplies } from "@/components/v2/last-replies";
import { useMissions } from "@/components/v2/use-missions";

const SPARK_DAYS = 30;

/**
 * Dashboard v2 (beta) — Explee's dashboard in Keel's frame.
 *
 * Every figure is a served field off the SAME reads v1's brand Overview makes, on the
 * same keys (`["brandRevenue", brandId]`, `["campaigns", brandId]`, the Leads page's
 * first page), so the two dashboards state one number one way and the second one
 * opened paints from the cache the first filled. Nothing is summed or divided here:
 * a card's figure is the producer's total, and its spark is the producer's per-day
 * series with the days it omits filled as the zeros they are.
 *
 * Absent on purpose, because nothing serves them yet: a delivery rate, and per-mission
 * sends and reply rates.
 */
export default function V2DashboardPage() {
  const params = useParams<{ orgId: string; brandId: string }>();
  const orgId = params.orgId;
  const brandId = params.brandId;
  const crewFilter = useSearchParams().get("crew");
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug);

  const { data: brandData } = useAuthQuery(["brand", brandId], () => getBrand(brandId), pollOptions);
  const brand = brandData?.brand ?? null;

  const revenueQ = useAuthQuery(["brandRevenue", brandId], () => getBrandRevenue(brandId), {
    enabled,
    ...pollOptions,
    structuralSharing: (prev, next) =>
      keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
  });
  const data = revenueQ.data;
  // Reveal on SETTLE: a failed read shows its dashes, never an eternal skeleton.
  const revenuePending = revenueQ.data === undefined && !revenueQ.isError;

  const { missions, settled: missionsSettled } = useMissions(orgId, brandId);
  const shownMissions = useMemo(
    () => (crewFilter ? missions.filter((m) => m.crew.key === crewFilter) : missions),
    [missions, crewFilter],
  );
  const filteredCrew = crewFilter ? missions.find((m) => m.crew.key === crewFilter)?.crew ?? null : null;
  const runningCount = missions.filter((m) => m.running).length;

  const today = utcDay(new Date());
  const sent = data?.sequences ?? data?.outreachContacted;
  const spend = data?.spend ?? null;

  const cards = [
    {
      label: "Sent",
      context: "all time",
      value: sent ? formatCount(sent.total) : "—",
      sub: "emails in sequences",
      spark: sent ? dailyWindow(sent.daily, SPARK_DAYS, today) : null,
      tone: "text-gray-700",
    },
    {
      label: "Website visits",
      context: "all time",
      value: data?.clicked ? formatCount(data.clicked.total) : "—",
      // A cost per outcome under ten outcomes is decided by whichever one landed, so it
      // is stated only past the same bar every v1 cost uses.
      sub:
        spend?.cpcCents != null && !isLearning(data?.clicked?.total)
          ? `${formatCentsAsUsdAdaptive(spend.cpcCents)} per visit`
          : null,
      spark: data?.clicked ? dailyWindow(data.clicked.daily, SPARK_DAYS, today) : null,
      tone: "text-sky-600",
    },
    {
      label: "Positive replies",
      context: "all time",
      value: data?.repliedPositive ? formatCount(data.repliedPositive.total) : "—",
      sub:
        spend?.cpprCents != null && !isLearning(data?.repliedPositive?.total)
          ? `${formatCentsAsUsdAdaptive(spend.cpprCents)} per reply`
          : null,
      spark: data?.repliedPositive ? dailyWindow(data.repliedPositive.daily, SPARK_DAYS, today) : null,
      tone: "text-green-600",
    },
    {
      label: "Spent",
      context: "cumulative",
      value: spend ? formatCentsAsUsdAdaptive(spend.totalSpentCents) : "—",
      sub:
        spend?.totalSpentTodayCents != null
          ? `${formatCentsAsUsdAdaptive(spend.totalSpentTodayCents)} today`
          : null,
      spark: data?.roiHistory
        ? cumulativeWindow(
            data.roiHistory.daily.map((p) => ({ date: p.date, value: p.cumulativeSpendUsd })),
            SPARK_DAYS,
            today,
          )
        : null,
      tone: "text-violet-600",
    },
  ];

  return (
    <LearningToneProvider tone="primary">
      <div className="sticky top-0 z-10 hidden h-12 items-center gap-2 border-b border-gray-100 bg-white/90 px-6 backdrop-blur md:flex">
        <span className="text-sm font-medium text-gray-900">Dashboard</span>
        <MaturityBadge level="beta" />
        <div className="ml-auto">
          <CampaignControlsTrigger brandId={brandId} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-8">
        <ScopePaymentDeclinedBand brandId={brandId} />
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[28px] leading-9 tracking-tight text-gray-900">
              {brand?.name ?? brand?.domain ?? " "}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {missionsSettled
                ? `${runningCount} of ${missions.length} mission${missions.length === 1 ? "" : "s"} running`
                : " "}
            </p>
          </div>
          <div className="md:hidden">
            <CampaignControlsTrigger brandId={brandId} />
          </div>
        </header>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.06em] text-gray-500">Performance</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <PerformanceCard key={c.label} {...c} pending={revenuePending} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-gray-500">
              Missions
              {missionsSettled && <span className="ml-1.5 text-gray-400">{shownMissions.length}</span>}
            </h2>
            {filteredCrew && (
              <Link
                href={`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}`}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                {filteredCrew.name} only · show all
              </Link>
            )}
          </div>
          <MissionsTable brandId={brandId} missions={shownMissions} settled={missionsSettled} />
        </section>

        <LastReplies orgId={orgId} brandId={brandId} />
      </div>
    </LearningToneProvider>
  );
}
