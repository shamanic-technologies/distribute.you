"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffBoxHealth } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, dayLabel, type Line } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import { containerLabel, loadLabel, memLabel, type BoxDailyPoint, type BoxHealth, type BoxRecentPoint } from "@/lib/monitoring/box-health";

/**
 * Monitoring > Box > Load and memory (staff only, BOX-OVERLOAD-1026-MONITORING). The production box (every service +
 * Postgres) posts a sample every 5 minutes to features-service, which serves the red/green verdict, its reasons and
 * thresholds, the daily series, the last 48 h, and the top 10 containers by CPU and by memory. Red on the hub IS the
 * alert (no email). This file draws served values in the served order; it computes no figure.
 */

export const BOX_DAYS = 30;
const AMBER = "var(--data-amber)";
const ACCENT = "var(--accent)";
const VIOLET = "var(--data-violet)";
const LIMIT = "var(--data-rose)";

export function useBoxHealth() {
  return useAuthQuery(["staffBoxHealth", BOX_DAYS], () => getStaffBoxHealth(BOX_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const utcHour = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "2-digit", hourCycle: "h23", timeZone: "UTC" }) + "h";

type Range = "recent" | "daily";
type RecentP = BoxRecentPoint & { day: string };

/** "Last 48 hours" or "Per day": the same question over the fine series or the daily one. */
function RangeSwitch({ value, onChange, hours }: { value: Range; onChange: (r: Range) => void; hours: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Range">
      {(["recent", "daily"] as const).map((r) => (
        <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)} className={value === r ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}>
          {r === "recent" ? `Last ${hours} hours` : "Per day"}
        </button>
      ))}
    </span>
  );
}

/** One question, two grains: every sample of the last 48 h, or one point per UTC day (a day without samples is absent). */
function Chart({
  title,
  data,
  recentLines,
  dailyLines,
  format,
}: {
  title: string;
  data: BoxHealth;
  recentLines: Line<RecentP>[];
  dailyLines: Line<BoxDailyPoint>[];
  format: (v: number) => string | null;
}) {
  const [range, setRange] = useState<Range>("recent");
  const recent: RecentP[] = data.recent.map((p) => ({ ...p, day: p.sampledAt }));
  const one = [{ key: "all", label: "All", days: null }];
  return (
    <section>
      <SectionTitle right={<RangeSwitch value={range} onChange={setRange} hours={data.recentHours} />}>{title}</SectionTitle>
      {range === "recent" ? (
        <DailyLines
          points={recent}
          lines={recentLines}
          format={format}
          windows={one}
          label={`${title}, last ${data.recentHours} hours`}
          empty={`No sample in the last ${data.recentHours} hours.`}
          pointLabel={(d) => `${utcTime(d)} UTC`}
          tickLabel={utcHour}
        />
      ) : (
        <DailyLines
          points={data.daily}
          lines={dailyLines}
          format={format}
          windows={one}
          label={`${title}, per day`}
          empty="Fewer than two days with samples."
          pointLabel={(d) => dayLabel(d)}
          caption={(p) => `${p.sampleCount} samples`}
        />
      )}
    </section>
  );
}

/** A served top-10 list: name, a bar against the first row, the value. */
function TopList({ title, rows, format, color }: { title: string; rows: { name: string; v: number }[]; format: (v: number) => string; color: string }) {
  const top = rows[0]?.v ?? 0;
  return (
    <div className="k-card overflow-hidden">
      <p className="k-label k-line-subtle border-b px-4 py-2.5">{title}</p>
      {rows.length === 0 ? (
        <EmptyNote>No live sample in the last hour.</EmptyNote>
      ) : (
        <ul className="divide-y divide-[var(--line-subtle)]">
          {rows.map((r) => (
            <li key={r.name} className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)_64px] items-center gap-3 px-4 py-2 text-[13px]">
              <span className="k-mono truncate text-[12px]" title={r.name}>
                {containerLabel(r.name)}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-[var(--data-track)]">
                <span className="block h-full rounded-full" style={{ width: `${top > 0 ? (r.v / top) * 100 : 0}%`, background: color }} />
              </span>
              <span className="text-right tabular-nums">{format(r.v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BoxHealthView({ data }: { data: BoxHealth }) {
  const t = data.thresholds;
  const l = data.latest;
  const red = data.status === "red";
  const limitLoad = t.load5Max;
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {data.reasons.map((r) => (
            <p key={r} className="text-[14px] font-medium">
              {r}
            </p>
          ))}
          <p className="k-fg3 mt-0.5 text-[12px]">
            {l ? `Latest sample ${utcTime(l.sampledAt)} UTC` : "No sample yet"}
            {data.minutesSinceLastSample != null && `, ${Math.round(data.minutesSinceLastSample)} min ago`}. Red when the load average over 5 minutes is above{" "}
            {limitLoad != null ? loadLabel(limitLoad) : `${t.loadPerCoreMax}x the cores`} ({t.loadPerCoreMax}x {l?.cores ?? "the"} cores), available memory is under {memLabel(t.memAvailableMinMb)}, swap is over {t.swapUsedPctMax}% full, the kernel killed a process for memory in the last {t.oomWindowHours} h, or no sample came for {t.staleAfterMinutes} min.
          </p>
        </div>
      </div>

      {l && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Load, 5 min" note={`${l.cores} cores`}>
            <Figure value={<span style={{ color: limitLoad != null && l.load5 > limitLoad ? RED : undefined }}>{loadLabel(l.load5)}</span>} sub={limitLoad != null ? `limit ${loadLabel(limitLoad)}` : undefined} />
          </StatTile>
          <StatTile label="Available memory" note={`of ${memLabel(l.memTotalMb)}`}>
            <Figure value={<span style={{ color: l.memAvailableMb < t.memAvailableMinMb ? RED : undefined }}>{memLabel(l.memAvailableMb)}</span>} sub={`limit ${memLabel(t.memAvailableMinMb)}`} />
          </StatTile>
          <StatTile label="Swap used" note={`of ${memLabel(l.swapTotalMb)}`}>
            <Figure
              value={<span style={{ color: l.swapUsedPct == null || l.swapUsedPct > t.swapUsedPctMax ? RED : undefined }}>{l.swapUsedPct == null ? "No swap" : `${l.swapUsedPct}%`}</span>}
              sub={`limit ${t.swapUsedPctMax}%`}
            />
          </StatTile>
          <StatTile label="Memory kills" note={`last ${t.oomWindowHours} h`}>
            <Figure value={l.oomKillsLast24h == null ? <span className="k-fg4">—</span> : <span style={{ color: l.oomKillsLast24h > 0 ? RED : undefined }}>{l.oomKillsLast24h}</span>} />
          </StatTile>
        </div>
      )}

      <Chart
        title="Load average"
        data={data}
        format={(v) => loadLabel(v)}
        recentLines={[
          { key: "load5", label: "5 min", color: ACCENT, get: (p) => p.load5 },
          { key: "load15", label: "15 min", color: VIOLET, get: (p) => p.load15 },
          ...(limitLoad != null ? [{ key: "limit", label: "Limit", color: LIMIT, dashed: true, get: () => limitLoad }] : []),
        ]}
        dailyLines={[
          { key: "max", label: "Highest", color: AMBER, get: (p) => p.load5Max },
          { key: "mean", label: "Average", color: ACCENT, get: (p) => p.load5Mean },
          ...(limitLoad != null ? [{ key: "limit", label: "Limit", color: LIMIT, dashed: true, get: () => limitLoad }] : []),
        ]}
      />

      <Chart
        title="Available memory"
        data={data}
        format={(v) => memLabel(v)}
        recentLines={[
          { key: "avail", label: "Available", color: ACCENT, get: (p) => p.memAvailableMb },
          { key: "limit", label: "Limit", color: LIMIT, dashed: true, get: () => t.memAvailableMinMb },
        ]}
        dailyLines={[
          { key: "min", label: "Lowest of the day", color: ACCENT, get: (p) => p.memAvailableMinMb },
          { key: "limit", label: "Limit", color: LIMIT, dashed: true, get: () => t.memAvailableMinMb },
        ]}
      />

      <Chart
        title="Swap used"
        data={data}
        format={(v) => `${loadLabel(v)}%`}
        recentLines={[
          { key: "swap", label: "Used", color: ACCENT, get: (p) => p.swapUsedPct },
          { key: "limit", label: "Limit", color: LIMIT, dashed: true, get: () => t.swapUsedPctMax },
        ]}
        dailyLines={[
          { key: "max", label: "Fullest of the day", color: ACCENT, get: (p) => p.swapUsedPctMax },
          { key: "limit", label: "Limit", color: LIMIT, dashed: true, get: () => t.swapUsedPctMax },
        ]}
      />

      <section>
        <SectionTitle right={<span>averaged over the last {data.topContainers.windowMinutes} min, {data.topContainers.sampleCount} {data.topContainers.sampleCount === 1 ? "sample" : "samples"}</span>}>Containers</SectionTitle>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <TopList title="CPU, cores" rows={data.topContainers.byCpu.map((c) => ({ name: c.name, v: c.cpuCores }))} format={loadLabel} color={AMBER} />
          <TopList title="Memory" rows={data.topContainers.byMemory.map((c) => ({ name: c.name, v: c.memMb }))} format={memLabel} color={VIOLET} />
        </div>
      </section>
    </div>
  );
}

export function BoxHealthPage() {
  const q = useBoxHealth();
  if (q.isError && !q.data) return <Failed what="the box load and memory" />;
  if (!q.data) return <Loading />;
  return <BoxHealthView data={q.data} />;
}

/** The hub's one-second read: the 5-minute load and the free memory, red when the served verdict is red, its reason under it. */
export function BoxHealthTile({ href }: { href: string }) {
  const q = useBoxHealth();
  const data = q.data;
  const l = data?.latest;
  const red = data?.status === "red";
  return (
    <StatTile label="Box load and memory" note={l ? `${l.cores} cores` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : !l ? (
            <span style={{ color: RED }}>No sample</span>
          ) : (
            <span style={{ color: red ? RED : undefined }}>Load {loadLabel(l.load5)}</span>
          )
        }
        sub={l ? `${memLabel(l.memAvailableMb)} free, ${l.swapUsedPct == null ? "no swap" : `swap ${l.swapUsedPct}%`}` : undefined}
      />
      {data && <p className="k-fg3 mt-0.5 line-clamp-2 text-[12px]" title={data.reason}>{data.reason}</p>}
    </StatTile>
  );
}
