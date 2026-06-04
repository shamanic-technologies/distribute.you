"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlower } from "@/lib/query-options";
import {
  getDomainTrafficHistory,
  getDomainDrStatus,
  listVisibilityRuns,
} from "@/lib/api";
import { parseDecimal } from "@/components/visibility/score-card";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { Skeleton } from "@/components/skeleton";

// A line chart needs ≥2 points to show a trend. The AI-mention card only graphs
// once there are ≥3 runs (user spec: "s'il y a au moins 3 data points, sinon tu
// mets la valeur en gros"); fewer → single big number.
const VISITS_MIN_POINTS = 2;
const AI_MIN_POINTS = 3;

interface ChartPoint {
  label: string;
  value: number;
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatPct(rate0to1: number): string {
  return `${Math.round(rate0to1 * 100)}%`;
}

function formatMonth(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function formatDay(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MetricCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-44">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
        {subtitle ? (
          <span className="text-[10px] text-gray-400 whitespace-nowrap">{subtitle}</span>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

function BigStat({ value, caption }: { value: string; caption?: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <span className="text-3xl font-semibold text-gray-900">{value}</span>
      {caption ? <span className="text-xs text-gray-400 mt-1">{caption}</span> : null}
    </div>
  );
}

function NoData({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center">
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

function MiniChart({
  data,
  color,
  fmt,
}: {
  data: ChartPoint[];
  color: string;
  fmt: (v: number) => string;
}) {
  return (
    <div className="flex-1 min-h-0 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9 }}
            interval="preserveStartEnd"
            minTickGap={20}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v) => fmt(typeof v === "number" ? v : 0)}
            labelStyle={{ fontSize: 11 }}
            contentStyle={{ fontSize: 11, padding: "2px 8px" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-44">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="flex-1 w-full" />
    </div>
  );
}

/**
 * Four brand health metrics at the top of the brand overview page:
 *  1. Monthly organic visits  — line over time (Ahrefs traffic history)
 *  2. Domain Rating           — current value, big number (no series exposed)
 *  3. Est. monthly revenue    — current value, big number (Ahrefs traffic value)
 *  4. AI mention rate         — line over time when ≥3 visibility runs, else big number
 *
 * Each source owns its own query; the four cards reveal together as one latched
 * group (useCoordinatedReveal), gated first on the brand domain being known so
 * the barrier never latches an empty group during the first paint.
 */
export function BrandMetricsHeader({
  brandId,
  domain,
}: {
  brandId: string;
  domain: string | null | undefined;
}) {
  const domainReady = !!domain;

  const { data: traffic, isPending: trafficPending } = useAuthQuery(
    ["domainTrafficHistory", domain],
    () => getDomainTrafficHistory(domain as string),
    { ...pollOptionsSlower, enabled: domainReady },
  );

  const { data: dr, isPending: drPending } = useAuthQuery(
    ["domainDrStatus", domain],
    () => getDomainDrStatus(domain as string),
    { ...pollOptionsSlower, enabled: domainReady },
  );

  const { data: visibility, isPending: visibilityPending } = useAuthQuery(
    ["visibilityRuns", { brandId }],
    () => listVisibilityRuns({ brandId, limit: 50 }),
    pollOptionsSlower,
  );

  // Visits series — chronological, dropping months with no captured value.
  const visitsSeries = useMemo<ChartPoint[]>(() => {
    const points = traffic?.monthlyOrganicTraffic ?? [];
    return points
      .filter((p) => p.organicTraffic != null)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((p) => ({ label: formatMonth(p.month), value: p.organicTraffic as number }));
  }, [traffic]);

  // AI mention-rate series — completed runs only, chronological, as a percentage.
  const aiSeries = useMemo<ChartPoint[]>(() => {
    const runs = visibility?.runs ?? [];
    return runs
      .filter((r) => r.completedAt && parseDecimal(r.brandMentionRate) != null)
      .sort(
        (a, b) =>
          new Date(a.completedAt as string).getTime() -
          new Date(b.completedAt as string).getTime(),
      )
      .map((r) => ({
        label: formatDay(r.completedAt as string),
        value: (parseDecimal(r.brandMentionRate) as number) * 100,
      }));
  }, [visibility]);

  const latestAiRate = parseDecimal(visibility?.runs?.[0]?.brandMentionRate ?? null);

  // Reveal the four cards together once every source has SETTLED (success or
  // error). Gating on `!isPending` rather than `data !== undefined` means a query
  // that errors — e.g. the api-service proxy not yet deployed → a 404 — still
  // reveals the group (each card shows its own "No data yet" state) instead of
  // pinning everything in a perpetual skeleton; the 30s poll then auto-fills the
  // cards once the proxy is live. A disabled query stays isPending forever, so its
  // flag is gated behind its own enabled condition; the domain-loaded flag goes
  // first so we never latch an empty group during the first paint.
  const revealed = useCoordinatedReveal([
    domainReady,
    !domainReady || !trafficPending,
    !domainReady || !drPending,
    !visibilityPending,
  ]);

  if (!revealed) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  const drValue = dr?.latestValidDr;
  const revenue = traffic?.trafficValueMonthlyAvg;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {/* 1 — Monthly organic visits */}
      <MetricCard title="Monthly visits" subtitle="organic, Ahrefs">
        {visitsSeries.length >= VISITS_MIN_POINTS ? (
          <MiniChart data={visitsSeries} color="#6366f1" fmt={formatInt} />
        ) : visitsSeries.length === 1 ? (
          <BigStat value={formatInt(visitsSeries[0].value)} caption={visitsSeries[0].label} />
        ) : (
          <NoData label="No traffic data yet" />
        )}
      </MetricCard>

      {/* 2 — Domain Rating (latest only) */}
      <MetricCard
        title="Domain Rating"
        subtitle={dr?.latestValidDrDate ? formatDay(dr.latestValidDrDate) : null}
      >
        {drValue != null ? (
          <BigStat value={String(drValue)} caption="Ahrefs DR" />
        ) : (
          <NoData label="No DR yet" />
        )}
      </MetricCard>

      {/* 3 — Estimated monthly revenue (Ahrefs traffic value, latest only) */}
      <MetricCard title="Est. monthly revenue" subtitle="traffic value, Ahrefs">
        {revenue != null ? (
          <BigStat value={formatUsd(revenue)} caption="/ month" />
        ) : (
          <NoData label="No revenue estimate yet" />
        )}
      </MetricCard>

      {/* 4 — AI mention rate (visibility-score series, else latest) */}
      <MetricCard title="AI mention rate" subtitle="AI Visibility Score">
        {aiSeries.length >= AI_MIN_POINTS ? (
          <MiniChart data={aiSeries} color="#f59e0b" fmt={(v) => `${v.toFixed(1)}%`} />
        ) : latestAiRate != null ? (
          <BigStat value={formatPct(latestAiRate)} caption="brand mention rate" />
        ) : (
          <NoData label="No AI visibility runs yet" />
        )}
      </MetricCard>
    </div>
  );
}
