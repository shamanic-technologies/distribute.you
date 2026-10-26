import { z } from "zod";

/**
 * Monitoring > Box > Load and memory (staff only, BOX-OVERLOAD-1026-MONITORING), alias-free so vitest reads it directly.
 *
 * A cron on the production box (`box-health-report.py`, distribute-box) posts one sample every 5 minutes to
 * features-service (#2091): load average, MemAvailable, swap, new OOM kills, and CPU + memory per container from the
 * cgroups. History before it was backfilled from sysstat (10-minute steps, no per-container data). Read through
 * api-service's staff passthrough (#1384): `GET /v1/features/audit/box-health?days=N`. The producer serves the red/green
 * VERDICT with its reasons and its thresholds, the daily series, every sample of the last 48 h, and the top 10 containers;
 * the page renders those as they are: no sort, no sum, no re-grading. A day with no sample is absent (a gap, never a zero).
 * Red on the hub IS the alert: memory-watchdog.sh and its emails are retired (owner 2026-10-22, no email).
 */

const num = z.number();

export const BoxContainerSchema = z.object({ name: z.string(), cpuCores: num.nullish(), memMb: num.nullish() });

export const BoxHealthSchema = z.object({
  status: z.enum(["red", "green"]),
  reason: z.string(),
  reasons: z.array(z.string()),
  stale: z.boolean(),
  minutesSinceLastSample: num.nullable(),
  thresholds: z.object({
    loadPerCoreMax: num,
    load5Max: num.nullable(),
    memAvailableMinMb: num,
    swapUsedPctMax: num,
    oomWindowHours: num,
    staleAfterMinutes: num,
  }),
  latest: z
    .object({
      sampledAt: z.string(),
      source: z.string(),
      load1: num,
      load5: num,
      load15: num,
      cores: num,
      memTotalMb: num,
      memAvailableMb: num,
      swapTotalMb: num,
      swapUsedMb: num,
      swapUsedPct: num.nullable(),
      oomKills: num.nullish(),
      oomKillsLast24h: num.nullish(),
      containers: z.array(BoxContainerSchema).nullish(),
    })
    .nullable(),
  windowDays: num,
  daily: z.array(
    z.object({
      day: z.string(),
      sampleCount: num,
      load5Mean: num,
      load5Max: num,
      memAvailableMinMb: num,
      swapUsedPctMax: num.nullable(),
      oomKills: num.nullable(),
    }),
  ),
  recentHours: num,
  recent: z.array(
    z.object({
      sampledAt: z.string(),
      load1: num,
      load5: num,
      load15: num,
      memAvailableMb: num,
      swapUsedPct: num.nullable(),
    }),
  ),
  topContainers: z.object({
    windowMinutes: num,
    sampleCount: num,
    byCpu: z.array(z.object({ name: z.string(), cpuCores: num })),
    byMemory: z.array(z.object({ name: z.string(), memMb: num })),
  }),
});
export type BoxHealth = z.infer<typeof BoxHealthSchema>;
export type BoxDailyPoint = BoxHealth["daily"][number];
export type BoxRecentPoint = BoxHealth["recent"][number];

/** A container as people say it: `distribute-postgres-1` reads `postgres`. Display only. */
export function containerLabel(name: string): string {
  return name.replace(/^distribute-/, "").replace(/-\d+$/, "");
}

/** Megabytes as people read memory: "1.5 GB" from 1,000 MB up, "820 MB" below. */
export function memLabel(mb: number): string {
  return mb >= 1000 ? `${(mb / 1024).toLocaleString("en-US", { maximumFractionDigits: 1 })} GB` : `${Math.round(mb).toLocaleString("en-US")} MB`;
}

/** A load average or a CPU figure to one decimal. */
export function loadLabel(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
