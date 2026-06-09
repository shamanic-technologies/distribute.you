"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptionsSlower } from "@/lib/query-options";
import {
  getDomainTrafficHistory,
  getDomainDrStatus,
  getDomainAiVisibility,
  computeDomainTraffic,
  computeDomainDr,
  computeDomainAiVisibility,
} from "@/lib/api";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { Skeleton } from "@/components/skeleton";

// Render a chart only when the backend gives at least 3 historical points on
// distinct calendar days. With fewer points, a big number is clearer than a
// misleading line.
const MIN_HISTORICAL_UNIQUE_DAYS = 3;

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

function toIsoDay(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toISOString().slice(0, 10);
}

function uniqueDatedSeries<T>(
  points: T[],
  getDate: (point: T) => string,
  getValue: (point: T) => number | null | undefined,
  formatLabel: (date: string) => string,
): ChartPoint[] {
  const byDay = new Map<string, ChartPoint>();
  for (const point of points) {
    const value = getValue(point);
    if (value == null) continue;
    const rawDate = getDate(point);
    const day = toIsoDay(rawDate);
    byDay.set(day, { label: formatLabel(rawDate), value });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, point]) => point);
}

// Per-(domain, metric) "we already tried an on-demand Ahrefs fetch" marker, so a
// domain with genuinely no Ahrefs data is scraped at most ONCE (paid scrape) and
// never re-fired across reloads. The in-memory firingRef dedupes within a mount;
// this localStorage marker dedupes across reloads. This is browser-capability
// handling (private mode / SSR), not a data fallback.
function computeTried(key: string): boolean {
  if (typeof window === "undefined") return true; // SSR: never fire
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false; // storage disabled (private mode): allow a single attempt
  }
}
function markComputeTried(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // storage unavailable — firingRef still dedupes within the mount
  }
}

/**
 * getOrFetchIfNeverSeen — when the read-cache query for a brand domain has
 * SETTLED with no usable Ahrefs data, fire the matching on-demand AhrefService
 * compute ONCE (so AhrefService actually checks Ahrefs), then write the result
 * straight into the read-cache so the card fills without waiting for the 30s
 * poll. The localStorage marker bounds a genuinely-empty domain to a single paid
 * scrape; firingRef dedupes within the mount.
 */
function useGetOrFetchIfNeverSeen(args: {
  domain: string | null | undefined;
  settled: boolean;
  empty: boolean;
  metric: string;
  cacheKey: readonly unknown[];
  compute: (domain: string) => Promise<unknown>;
}) {
  const { domain, settled, empty, metric, cacheKey, compute } = args;
  const qc = useQueryClient();
  const firingRef = useRef(false);
  useEffect(() => {
    if (!domain || !settled || !empty || firingRef.current) return;
    const marker = `ahref-compute-tried:${domain}:${metric}`;
    if (computeTried(marker)) return;
    firingRef.current = true;
    compute(domain)
      .then((res) => {
        // Mark ONLY after AhrefService was actually consulted (200). A 404 — e.g.
        // the api-service compute proxy not yet deployed — must NOT mark, so we
        // retry once it goes live instead of permanently skipping the domain.
        markComputeTried(marker);
        if (res != null) qc.setQueryData([...cacheKey], res);
      })
      .catch((err) =>
        console.error(`[dashboard] ahref ${metric} get-or-fetch failed`, err),
      )
      .finally(() => {
        firingRef.current = false;
      });
    // cacheKey/compute are stable per metric; gate on the primitive signals only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, settled, empty, metric]);
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
 * Four brand health metrics at the top of the brand overview page, all sourced
 * from AhrefService. A metric renders as a chart only when its backend response
 * exposes at least 3 historical points on unique calendar days; otherwise it
 * stays a big current value. Today, traffic exposes a monthly historical series,
 * while DR, estimated revenue, and AI mentions expose latest snapshots only.
 *
 * All four read ahref-service's CACHE (fast GET) for display; when the cache is
 * empty for a never-seen domain we fire the matching on-demand compute POST ONCE
 * so AhrefService actually checks Ahrefs ("getOrFetchIfNeverSeen"), writing the
 * result back into the read cache. The scrape never gates render — only the GETs
 * do. Each source owns its query; the four cards reveal together as one latched
 * group, gated first on the brand domain being known so the barrier never latches
 * an empty first paint.
 */
export function BrandMetricsHeader({
  brandId: _brandId,
  domain,
}: {
  brandId: string;
  domain: string | null | undefined;
}) {
  const domainReady = !!domain;

  const {
    data: traffic,
    isPending: trafficPending,
    isFetched: trafficFetched,
  } = useAuthQuery(
    ["domainTrafficHistory", domain],
    () => getDomainTrafficHistory(domain as string),
    { ...pollOptionsSlower, enabled: domainReady },
  );

  const {
    data: dr,
    isPending: drPending,
    isFetched: drFetched,
  } = useAuthQuery(
    ["domainDrStatus", domain],
    () => getDomainDrStatus(domain as string),
    { ...pollOptionsSlower, enabled: domainReady },
  );

  // Ahrefs Brand-Radar AI-visibility — read the fast CACHE GET (array, [0]),
  // polled like the other two reads. The paid get-or-refresh POST is fired off the
  // render path by useGetOrFetchIfNeverSeen below, never as the display query, so a
  // slow scrape can't block the reveal.
  const {
    data: aiVis,
    isPending: aiVisPending,
    isFetched: aiVisFetched,
  } = useAuthQuery(
    ["domainAiVisibility", domain],
    () => getDomainAiVisibility(domain as string),
    { ...pollOptionsSlower, enabled: domainReady },
  );

  // getOrFetchIfNeverSeen triggers for all three cache-backed metrics. A domain
  // with no cached row → one on-demand scrape, result written back to the read
  // cache. "empty" = no usable value shown; the localStorage marker caps it at a
  // single attempt per domain even when Ahrefs genuinely has nothing.
  useGetOrFetchIfNeverSeen({
    domain,
    settled: trafficFetched,
    empty: !traffic?.hasData,
    metric: "traffic",
    cacheKey: ["domainTrafficHistory", domain],
    compute: computeDomainTraffic,
  });
  useGetOrFetchIfNeverSeen({
    domain,
    settled: drFetched,
    empty: dr?.latestValidDr == null,
    metric: "dr",
    cacheKey: ["domainDrStatus", domain],
    compute: computeDomainDr,
  });
  useGetOrFetchIfNeverSeen({
    domain,
    settled: aiVisFetched,
    empty: !aiVis?.snapshotDate,
    metric: "aivis",
    cacheKey: ["domainAiVisibility", domain],
    compute: computeDomainAiVisibility,
  });

  // Visits series — chronological, dropping months with no captured value and
  // deduping by date so a chart requires real historical points.
  const visitsSeries = useMemo<ChartPoint[]>(() => {
    return uniqueDatedSeries(
      traffic?.monthlyOrganicTraffic ?? [],
      (p) => p.month,
      (p) => p.organicTraffic,
      formatMonth,
    );
  }, [traffic]);

  // Reveal the four cards together once every FAST cache-read source has SETTLED
  // (traffic + DR + ai-visibility GET). All four display queries are read-only
  // cache GETs, so none can block the group — the paid Apify scrapes run off the
  // render path via useGetOrFetchIfNeverSeen, never as a reveal-gating query (a
  // slow/inline scrape POST in this barrier once froze all four cards — CLAUDE.md
  // "never gate a reveal barrier on a slow/inline-compute query"). Gating on
  // `!isPending` (settle) rather than `data !== undefined` means an errored query
  // still reveals its "No data yet" state instead of a perpetual skeleton. A
  // disabled query stays isPending forever, so each flag is gated on its own
  // enabled condition; the domain-loaded flag goes first so we never latch an empty
  // group during the first paint.
  const revealed = useCoordinatedReveal([
    domainReady,
    !domainReady || !trafficPending,
    !domainReady || !drPending,
    !domainReady || !aiVisPending,
  ]);

  const drValue = dr?.latestValidDr;
  const revenue = traffic?.trafficValueMonthlyAvg;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {/* 1 — Monthly organic visits */}
      <MetricCard title="Monthly visits" subtitle="organic, Ahrefs">
        {!revealed ? (
          <Skeleton className="flex-1 w-full" />
        ) : visitsSeries.length >= MIN_HISTORICAL_UNIQUE_DAYS ? (
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
        {!revealed ? (
          <Skeleton className="flex-1 w-full" />
        ) : drValue != null ? (
          <BigStat value={String(drValue)} caption="Ahrefs DR" />
        ) : (
          <NoData label="No DR yet" />
        )}
      </MetricCard>

      {/* 3 — Estimated monthly revenue (Ahrefs traffic value, latest only) */}
      <MetricCard title="Est. monthly revenue" subtitle="traffic value, Ahrefs">
        {!revealed ? (
          <Skeleton className="flex-1 w-full" />
        ) : revenue != null ? (
          <BigStat value={formatUsd(revenue)} caption="/ month" />
        ) : (
          <NoData label="No revenue estimate yet" />
        )}
      </MetricCard>

      {/* 4 — AI mentions (Ahrefs Brand-Radar global mention count) */}
      <MetricCard
        title="AI mentions"
        subtitle={aiVis?.snapshotDate ? formatDay(aiVis.snapshotDate) : "Ahrefs Brand-Radar"}
      >
        {!revealed ? (
          <Skeleton className="flex-1 w-full" />
        ) : aiVis?.snapshotDate ? (
          <BigStat value={formatInt(aiVis.mentionsTotal)} caption="across AI engines" />
        ) : (
          <NoData label="No AI mentions yet" />
        )}
      </MetricCard>
    </div>
  );
}
