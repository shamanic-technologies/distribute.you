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
  computeDomainTraffic,
  computeDomainDr,
  computeDomainAiVisibility,
} from "@/lib/api";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { Skeleton } from "@/components/skeleton";

// A line chart needs ≥2 points to show a trend.
const VISITS_MIN_POINTS = 2;

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
 * from AhrefService:
 *  1. Monthly organic visits  — line over time (Ahrefs traffic history)
 *  2. Domain Rating           — current value, big number (no series exposed)
 *  3. Est. monthly revenue    — current value, big number (Ahrefs traffic value)
 *  4. AI mentions             — Ahrefs Brand-Radar global AI-mention count
 *
 * Cards 1–3 read ahref-service's CACHE (GET); when the cache is empty for a
 * never-seen domain we fire the matching on-demand compute ONCE so AhrefService
 * actually checks Ahrefs ("getOrFetchIfNeverSeen"). Card 4 has no cache-read GET,
 * so its get-or-refresh POST doubles as reader + trigger. Each source owns its
 * query; the four cards reveal together as one latched group, gated first on the
 * brand domain being known so the barrier never latches an empty first paint.
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

  // Ahrefs Brand-Radar AI-visibility. get-or-refresh, so the POST itself is the
  // read; ahref-service decides cache-vs-scrape (keeping paid scrapes rare). No
  // poll / focus / reconnect refetch — but a 5-min staleTime (not Infinity) lets
  // an errored first call (e.g. proxy not yet deployed → 404) recover on the next
  // mount once the proxy is live, instead of pinning the error for the gcTime.
  const { data: aiVis, isPending: aiVisPending } = useAuthQuery(
    ["domainAiVisibility", domain],
    () => computeDomainAiVisibility(domain as string),
    {
      enabled: domainReady,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 0,
    },
  );

  // getOrFetchIfNeverSeen triggers for the two cache-backed metrics. A domain
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

  // Visits series — chronological, dropping months with no captured value.
  const visitsSeries = useMemo<ChartPoint[]>(() => {
    const points = traffic?.monthlyOrganicTraffic ?? [];
    return points
      .filter((p) => p.organicTraffic != null)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((p) => ({ label: formatMonth(p.month), value: p.organicTraffic as number }));
  }, [traffic]);

  // Reveal the cards once the two FAST cache-read sources (traffic + DR GET) have
  // SETTLED. Card 4's ai-visibility is deliberately EXCLUDED from this barrier: it
  // is a get-or-refresh POST that scrapes Apify inline for a never-seen domain and
  // can take tens of seconds — gating the group on it held all four cards in a
  // skeleton until the scrape returned ("shows nothing"). Card 4 reveals with the
  // group and renders its OWN inner skeleton while its POST is pending. Gating on
  // `!isPending` (settle) rather than `data !== undefined` means an errored query
  // (e.g. proxy 404) still reveals its "No data yet" state instead of a perpetual
  // skeleton. A disabled query stays isPending forever, so each flag is gated on
  // its own enabled condition; the domain-loaded flag goes first so we never latch
  // an empty group during the first paint.
  const revealed = useCoordinatedReveal([
    domainReady,
    !domainReady || !trafficPending,
    !domainReady || !drPending,
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

      {/* 4 — AI mentions (Ahrefs Brand-Radar global mention count) */}
      <MetricCard
        title="AI mentions"
        subtitle={aiVis?.snapshotDate ? formatDay(aiVis.snapshotDate) : "Ahrefs Brand-Radar"}
      >
        {aiVisPending ? (
          // get-or-refresh scrape in flight — card-local skeleton, never blocks the
          // other three cards (see the reveal-barrier note above).
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-8 w-20" />
          </div>
        ) : aiVis?.snapshotDate ? (
          <BigStat value={formatInt(aiVis.mentionsTotal)} caption="across AI engines" />
        ) : (
          <NoData label="No AI mentions yet" />
        )}
      </MetricCard>
    </div>
  );
}
