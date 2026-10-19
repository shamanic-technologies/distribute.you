/**
 * Monitoring > Emails > Capacity (staff only): what our sending estate can do, what it sends, and
 * the backlog between the two. Ported from the admin console's cold-email Overview
 * (MONITORING-ADMIN-PORT-1019). Every figure is the producer's:
 * - instantly-service `/instantly/ops/infra` (fleet totals, one rollup per pool, who is held out),
 *   `/instantly/audit/capacity-history` (in-production daily limits per day),
 *   `/instantly/audit/reconcile` (our count vs Instantly's per fact);
 * - features-service `/features/audit/send-forecast` (created and sent per day, past and ahead,
 *   plus the fleet summary: measured send rate, backlog, total daily budget).
 *
 * This module parses and LOOKS UP. It never sums, averages or differences a figure; the one
 * arithmetic below (`stackHeight`) sizes a bar and is never printed.
 *
 * Schemas mirror apps/admin/src/lib/api.ts, keeping only the fields Monitoring renders. Alias-free
 * so it carries real unit tests.
 */
import { z } from "zod";

// ─── Infra rollup (instantly-service /ops/infra) ───────────────────────────

const VolumeSchema = z.object({
  outreach: z.number(),
  warmup: z.number(),
  seed: z.number(),
  repliesIn: z.number(),
  bouncesIn: z.number(),
  // null = nothing sent in the window, never a zero rate.
  bounceRatePerMille: z.number().nullable(),
});

export const OpsInfraSchema = z.object({
  asOf: z.string(),
  fleet: z.object({
    dailyCapacity: z.number(),
    healthyAccountCount: z.number(),
    totalAccountCount: z.number(),
    blockedDomainCount: z.number(),
    queuedSteps: z.number(),
    byLifecycle: z.record(z.string(), z.number()),
  }),
  pools: z.array(
    z.object({
      pool: z.string(),
      mailboxes: z.number(),
      addresses: z.number(),
      byLifecycle: z.record(z.string(), z.number()),
      dailyCapacity: z.number(),
      inProduction: z.number(),
      queuedSteps: z.number(),
      volume7d: VolumeSchema,
      // null = nothing measured in this pool, never a 0%.
      inboxPctMean: z.number().nullable(),
    }),
  ),
  exclusions: z.object({
    domainPolicy: z.array(z.object({ domain: z.string(), reason: z.string(), note: z.string().nullable() })),
    featureReservations: z.array(z.object({ accountEmail: z.string(), featureSlug: z.string() })),
  }),
});
export type OpsInfra = z.infer<typeof OpsInfraSchema>;
export type OpsPool = OpsInfra["pools"][number];

/** A pool by the name people know (the vendor that sells us its mailboxes). Unknown prints as served. */
const POOL_WORD: Record<string, string> = {
  "google-workspace": "Google Workspace",
  "gandi-relay": "Gandi relay",
  "mailforge-relay": "Mailforge relay",
  "dfy-google": "DFY Google",
  unknown: "Not attributed",
};
export const poolWord = (pool: string) => POOL_WORD[pool] ?? pool;

/** Served counts per state, largest first, for display. Sorting only. */
export function byCountDesc(counts: Record<string, number>): Array<[string, number]> {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// ─── Send forecast (features-service /features/audit/send-forecast) ────────

/**
 * TWO calendars, never one series: `created*` counts SEQUENCES and runs seven days a week (budget
 * driven); the sent fields count EMAILS and run Monday to Friday (throughput driven). null = the
 * series does not apply that day (past days carry no projection, future days no actuals): a dash.
 */
const SendForecastDaySchema = z.object({
  date: z.string(),
  isToday: z.boolean(),
  createdActual: z.number().nullable(),
  createdProjected: z.number().nullable(),
  actualSent: z.number().nullable(),
  inFlightSent: z.number().nullable(),
  forecastNew: z.number().nullable(),
  total: z.number().nullable(),
});
export const SendForecastSchema = z.object({
  days: z.array(SendForecastDaySchema),
  summary: z.object({
    totalDailyBudgetUsd: z.number(),
    followupModel: z.string(),
    activeBrandCount: z.number(),
    totalNewSequencesPerDay: z.number(),
    observedDailyThroughput: z.number().nullable(),
    queuedEmails: z.number(),
    queuedSendingDays: z.number().nullable(),
  }),
});
export type SendForecast = z.infer<typeof SendForecastSchema>;
export type SendForecastDay = SendForecast["days"][number];

/** A projected count arrives fractional: shown as whole units. null stays null (a dash). */
export function whole(v: number | null | undefined): string | null {
  return v == null ? null : Math.round(v).toLocaleString("en-US");
}

/** The height of a stacked bar, in served units: sizes the drawing, never printed. */
export function stackHeight(parts: Array<number | null>): number {
  let h = 0;
  for (const p of parts) h += p ?? 0;
  return h;
}

// ─── Capacity history (instantly-service /audit/capacity-history) ──────────

export const CapacityHistorySchema = z.object({
  series: z.array(z.object({ date: z.string(), inProductionCount: z.number(), dailyCapacity: z.number() })),
});
export type CapacityHistory = z.infer<typeof CapacityHistorySchema>;
export const CAPACITY_WINDOWS = [7, 30, 90] as const;
export type CapacityWindow = (typeof CAPACITY_WINDOWS)[number];

// ─── Reconcile (instantly-service /audit/reconcile) ────────────────────────

export const ReconcileSchema = z.object({
  asOf: z.string(),
  metrics: z.array(z.object({ key: z.string(), label: z.string(), local: z.number(), instantly: z.number(), delta: z.number() })),
});
export type Reconcile = z.infer<typeof ReconcileSchema>;

/** The served delta (local minus Instantly) with its sign. Formatting only. */
export function signed(delta: number): string {
  const abs = Math.round(Math.abs(delta)).toLocaleString("en-US");
  return delta > 0 ? `+${abs}` : delta < 0 ? `-${abs}` : "0";
}
