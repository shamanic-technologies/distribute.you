import { z } from "zod";

/**
 * Monitoring > Triggers > Reports (staff only, TRIGGER-REPORTS-MONITORING-1027), alias-free so vitest reads it directly.
 *
 * crm-service reports four facts to campaign-service as campaign triggers: a CRM form filled, a WhatsApp number given,
 * a positive reply, an account event (crm #214). Each report is sent, skipped on purpose, or not sent yet; one not sent
 * 15 minutes after it was seen is STUCK and makes its trigger red. Read through api-service's staff passthrough (#1386):
 * `GET /v1/crm/ops/trigger-reports?days=N`. The producer serves the verdict, the stuck reports with their reason, and a
 * daily series; the page draws them as served (no sort, no sum, no re-grading). Red on the hub IS the alert (no email).
 * Cost that made it: every WhatsApp greeting of our own brand failed for 5 days unseen (2026-10-22 to 10-27).
 */

const num = z.number();

export const TriggerStuckReportSchema = z.object({
  reportId: z.string(),
  orgId: z.string(),
  brandId: z.string(),
  status: z.string(),
  reason: z.string().nullable(),
  lastError: z.string().nullable(),
  attempts: num,
  detectedAt: z.string(),
});

export const TriggerReportSchema = z.object({
  trigger: z.string(),
  status: z.enum(["ok", "red"]),
  stuck: num,
  stuckByReason: z.array(z.object({ reason: z.string().nullable(), count: num, oldestAt: z.string(), latestAt: z.string() })),
  stuckReports: z.array(TriggerStuckReportSchema),
  byDay: z.array(z.object({ day: z.string(), sent: num, skipped: num, notSent: num })),
});

export const TriggerReportsSchema = z.object({
  generatedAt: z.string(),
  days: num,
  stuckAfterMinutes: num,
  status: z.enum(["ok", "red"]),
  triggers: z.array(TriggerReportSchema),
});
export type TriggerReports = z.infer<typeof TriggerReportsSchema>;
export type TriggerReport = TriggerReports["triggers"][number];
export type TriggerStuckReport = z.infer<typeof TriggerStuckReportSchema>;

const TRIGGER_NAMES: Record<string, string> = {
  form_submitted: "Form filled",
  whatsapp_number_given: "WhatsApp number given",
  positive_reply_received: "Positive reply",
  account_event: "Account event",
};

/** A trigger as people say it; an unknown key shows as served. Display only. */
export function triggerName(key: string): string {
  return TRIGGER_NAMES[key] ?? key;
}

const REASON_NAMES: Record<string, string> = {
  offer_unknown: "No offer to report it on",
  campaign_unreachable: "Campaign service not reachable",
  campaign_refused: "Refused by the campaign",
};

/** A stuck reason as people say it; null = not tried yet, an unknown key shows as served. Display only. */
export function reasonName(reason: string | null): string {
  if (reason == null) return "Not sent yet";
  return REASON_NAMES[reason] ?? reason.replace(/_/g, " ");
}
