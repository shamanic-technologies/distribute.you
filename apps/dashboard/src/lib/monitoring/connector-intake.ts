import { z } from "zod";

/**
 * Monitoring > Connected tools (staff only, CONNECTOR-INTAKE-MONITORING-1028), alias-free so vitest reads it directly.
 *
 * A tool a client connected (GoHighLevel, PostHog, Stripe, Clerk) can sync "fine" every 15 min and still take in
 * nothing: Doc Dinners' GoHighLevel read "connected, synced minutes ago" while no contact, form, deal or appointment
 * came in from 2026-10-20 to 10-28, and every reactive campaign of that client starts from those records. crm-service
 * (#233, GHL-MIRROR-FROZEN-1028) serves, per connection, the records the VENDOR dated on each UTC day and its verdict
 * (red on a failing sync, a late sync, or a silence longer than the connection's own habit); read through api-service's
 * staff passthrough `GET /v1/crm/ops/connector-intake?days=N`. The page draws the served order and verdicts as they
 * are: no sort, no sum, no re-grading. Red on the hub IS the alert (no email).
 */

const num = z.number();

export const ConnectorIntakeReasonSchema = z.object({ code: z.string(), text: z.string() });

export const ConnectorIntakeConnectionSchema = z.object({
  source: z.string(),
  connectionId: z.string(),
  orgId: z.string(),
  brandId: z.string(),
  brandName: z.string().nullable(),
  account: z.string().nullable(),
  syncStatus: z.string(),
  lastSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  status: z.enum(["ok", "red", "paused"]),
  reasons: z.array(ConnectorIntakeReasonSchema),
  newestRecordDay: z.string().nullable(),
  quietDays: num.nullable(),
  usualLongestQuietDays: num.nullable(),
  activeDaysInHistory: num,
  byDay: z.array(z.object({ day: z.string(), records: num })),
});

export const ConnectorIntakeSchema = z.object({
  generatedAt: z.string(),
  days: num,
  rule: z.object({ historyDays: num, minActiveDays: num, minQuietDays: num, syncLateAfterMinutes: num }),
  status: z.enum(["ok", "red"]),
  connections: z.array(ConnectorIntakeConnectionSchema),
});
export type ConnectorIntake = z.infer<typeof ConnectorIntakeSchema>;
export type ConnectorIntakeConnection = ConnectorIntake["connections"][number];
export type ConnectorIntakeReason = z.infer<typeof ConnectorIntakeReasonSchema>;

const TOOL_NAMES: Record<string, string> = {
  gohighlevel: "GoHighLevel",
  posthog: "PostHog",
  stripe: "Stripe",
  clerk: "Clerk",
};

/** A tool as people say it; an unknown one shows as served. Display only. */
export function toolName(source: string): string {
  return TOOL_NAMES[source] ?? source;
}

/** "Doc Dinners · GoHighLevel": the served brand name, else the served account, then the tool. */
export function connectionName(c: ConnectorIntakeConnection): string {
  return `${c.brandName ?? c.account ?? c.brandId.slice(0, 8)} · ${toolName(c.source)}`;
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/**
 * One served reason in plain words, from the connection's served figures (no figure computed here). An unknown code
 * reads as the producer's own text.
 */
export function reasonWords(c: ConnectorIntakeConnection, r: ConnectorIntakeReason): string {
  if (r.code === "quiet_unusual" && c.quietDays != null) {
    return `nothing new for ${days(c.quietDays)}, usually never more than ${days(c.usualLongestQuietDays ?? 0)}`;
  }
  if (r.code === "sync_late") return c.lastSyncedAt ? `no good sync since ${utcTime(c.lastSyncedAt)} UTC` : "never synced";
  if (r.code === "sync_error") return `the sync fails: ${c.lastError ?? "no message"}`;
  return r.text;
}

/** The connections the hub turns red on: the served verdict, never re-graded. */
export function redConnections(data: ConnectorIntake): ConnectorIntakeConnection[] {
  return data.connections.filter((c) => c.status === "red");
}
