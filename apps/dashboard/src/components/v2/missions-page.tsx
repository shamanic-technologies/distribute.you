"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { formatCentsAsUsdAdaptive, formatCount } from "@/lib/format-number";
import { cumulativeWindow, dailyWindow, utcDay } from "@/lib/v2/series";
import { MissionsTable } from "@/components/v2/missions-table";
import { useMissions } from "@/components/v2/use-missions";
import { useBrandRevenue } from "@/components/v2/data";
import { Figure, SectionTitle, Shimmer, SparkLine, StatTile, TopBar } from "@/components/v2/ui";
import { MaturityBadge } from "@/components/maturity-badge";

const DAYS = 30;

/**
 * Missions (beta): Explee's dashboard — the four performance figures across every
 * mission, then the missions table. Figures are served totals; lines are served
 * per-day series with the absent days read as the zeros they are.
 */
export function MissionsPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const rev = useBrandRevenue(brandId);
  const data = rev.data;
  const { missions, settled } = useMissions(orgId, brandId);
  const today = useMemo(() => utcDay(new Date()), []);
  const sent = data?.sequences ?? data?.outreachContacted;
  const running = missions.filter((m) => m.running).length;

  const cards = [
    { label: "Sent", value: sent ? formatCount(sent.total) : "—", spark: sent ? dailyWindow(sent.daily, DAYS, today) : null },
    { label: "Website visits", value: data?.clicked ? formatCount(data.clicked.total) : "—", spark: data?.clicked ? dailyWindow(data.clicked.daily, DAYS, today) : null },
    {
      label: "Positive replies",
      value: data?.repliedPositive ? formatCount(data.repliedPositive.total) : "—",
      spark: data?.repliedPositive ? dailyWindow(data.repliedPositive.daily, DAYS, today) : null,
    },
    {
      label: "Spent",
      value: data?.spend ? formatCentsAsUsdAdaptive(data.spend.totalSpentCents) : "—",
      spark: data?.roiHistory
        ? cumulativeWindow(data.roiHistory.daily.map((p) => ({ date: p.date, value: p.cumulativeSpendUsd })), DAYS, today)
        : null,
    },
  ];

  return (
    <>
      <TopBar
        crumbs={[{ label: "Missions" }]}
        actions={
          <>
            <MaturityBadge level="beta" />
            {rev.enabled && <CampaignControlsTrigger brandId={brandId} />}
          </>
        }
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
          {settled ? `${running} of ${missions.length} ${missions.length === 1 ? "mission" : "missions"} running` : "Missions"}
        </h1>
        <p className="k-fg2 mt-1 text-[14px]">A mission is one crew working for one of your offers.</p>

        <div className="mt-6">
          <SectionTitle right={<span>All missions · all time · line shows {DAYS} days</span>}>Performance</SectionTitle>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((c) => (
              <StatTile key={c.label} label={c.label} note="all time">
                {rev.pending ? <Shimmer className="h-7 w-20" /> : <Figure value={c.value} />}
                <SparkLine className="mt-auto h-10 pt-2" values={rev.pending ? null : c.spark} />
              </StatTile>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle count={settled ? missions.length : null}>Missions</SectionTitle>
          <MissionsTable brandId={brandId} missions={missions} settled={settled} />
        </div>
      </div>
    </>
  );
}
