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
  /**
   * Mailbox vendors refusing our API right now (SEND-PRIMEFORGE-402-1030): their mailboxes are out
   * of the send pool, every other vendor sends on. Empty = every vendor answered. Optional: an
   * instantly-service older than v0.83.153 does not serve it, and that reads as nothing refused.
   */
  vendorRefusals: z
    .array(
      z.object({
        vendor: z.string(),
        // The vendor's answer, verbatim.
        error: z.string(),
        // First refusal of the current streak, then the latest one (ISO).
        since: z.string(),
        lastSeenAt: z.string(),
        // SEND-POOL-VENDOR-402-1030 (instantly-service v0.83.157): when the stored listing its mailboxes keep sending
        // on was fetched, null = none stored and its mailboxes are out of the pool. Absent on an older deploy.
        lastListingAt: z.string().nullish(),
        lastListingMailboxes: z.number().optional(),
      }),
    )
    .optional(),
  /**
   * What the sender can hand a NEW email to right now, per send pool, read through the sender's own selection
   * (SEND-POOL-VENDOR-402-1030). `shared` = the pool every org sends from; any other name = a feature with mailboxes
   * reserved to it. `sendable: 0` = every org on that pool has its new emails refused. Optional: absent before v0.83.157.
   */
  sendPools: z
    .array(
      z.object({
        pool: z.string(),
        sendable: z.number(),
        // Sendable mailboxes per vendor, as served.
        byVendor: z.record(z.string(), z.number()),
      }),
    )
    .optional(),
  /**
   * The same per pool, per UTC day over 90 days, stored by instantly-service (`send_pool_daily`, a sample every 15 min,
   * v0.83.158). `sendableMin` = the day's lowest sample (a few hours at 0 read 0); null on a day with no sample.
   */
  sendPoolHistory: z
    .array(
      z.object({
        pool: z.string(),
        days: z.array(
          z.object({
            day: z.string(),
            sendableMin: z.number().nullable(),
            sendableLast: z.number().nullable(),
            byVendor: z.record(z.string(), z.number()).nullable(),
          }),
        ),
      }),
    )
    .optional(),
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

// ─── Vendor refusals (SEND-PRIMEFORGE-402-1030) ────────────────────────────

export type VendorRefusal = NonNullable<OpsInfra["vendorRefusals"]>[number];

/** Every vendor refusing us, as served. An older instantly-service serves no field: nothing refused. */
export const vendorRefusals = (infra: OpsInfra): VendorRefusal[] => infra.vendorRefusals ?? [];

/** A mailbox vendor by its brand name. Unknown prints as served. */
const VENDOR_WORD: Record<string, string> = { primeforge: "Primeforge", mailforge: "Mailforge", gandi: "Gandi" };
export const vendorWord = (vendor: string) => VENDOR_WORD[vendor] ?? vendor;

/** A served ISO instant as staff read it: "Oct 29, 15:02 UTC". */
export const utcMoment = (iso: string) =>
  `${new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })} UTC`;

/** The one-line read of a refusal: who refuses, since when, and what it stops. */
export const refusalSentence = (r: VendorRefusal) =>
  r.lastListingAt && r.lastListingMailboxes
    ? `${vendorWord(r.vendor)} refuses us since ${utcMoment(r.since)}: its ${r.lastListingMailboxes} mailboxes keep sending on the list it gave us ${utcMoment(r.lastListingAt)}.`
    : `${vendorWord(r.vendor)} refuses us since ${utcMoment(r.since)}: its mailboxes send nothing, every other vendor keeps sending.`;

// ─── Send pools (SEND-POOL-VENDOR-402-1030) ────────────────────────────────

export type SendPool = NonNullable<OpsInfra["sendPools"]>[number];

/** Every send pool as served; an older instantly-service serves none. */
export const sendPools = (infra: OpsInfra): SendPool[] => infra.sendPools ?? [];

/** The pools no new email can go out from: every org on them is refused. */
export const emptySendPools = (infra: OpsInfra): SendPool[] => sendPools(infra).filter((p) => p.sendable === 0);

/** Who sends from a pool, in words. A reserved pool prints its feature as served. */
export const sendPoolWord = (pool: string) => (pool === "shared" ? "Every org" : pool);

export type SendPoolHistory = NonNullable<OpsInfra["sendPoolHistory"]>[number];
export type SendPoolDay = SendPoolHistory["days"][number];

/** Every pool's stored daily series, as served; an older instantly-service serves none. */
export const sendPoolHistory = (infra: OpsInfra): SendPoolHistory[] => infra.sendPoolHistory ?? [];

/** A day the pool fell to zero at least once: red. A day with no sample is not a zero. */
export const poolWasEmpty = (d: SendPoolDay) => d.sendableMin === 0;

/** The vendors of a series, in the order their mailboxes appear first in it (stable bar colours). */
export const seriesVendors = (h: SendPoolHistory): string[] => [...new Set(h.days.flatMap((d) => Object.keys(d.byVendor ?? {})))].sort();

/** A pool's mailboxes per vendor, largest first: "13 Primeforge, 2 Gandi". Sorting and lookup only. */
export const sendPoolVendors = (p: SendPool) =>
  byCountDesc(p.byVendor)
    .map(([v, n]) => `${n} ${vendorWord(v)}`)
    .join(", ");

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
