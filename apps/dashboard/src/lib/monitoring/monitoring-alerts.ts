import { z } from "zod";

/**
 * Monitoring > Alerts > Raised (staff only, SIGNUP-EMAILS-1111-MONITORING), alias-free so vitest reads it directly.
 *
 * Owner 2026-10-22, « no email in my inbox please »: since 2026-11-11 transactional-email-service no longer emails staff
 * alerts (a paid data provider out of credits, a campaign failing every run, a campaign out of people, a trigger silent,
 * a prospect waiting on a campaign that cannot run, a sending domain blocklisted, a newsletter release halted or
 * stalled). It records them and serves, per alert type, a verdict (broken = raised in the last 24 h), a one-sentence
 * reason, a zero-filled daily series and the latest occurrences with the facts they were raised with. This module only
 * parses and NAMES what is served: the verdict, the counts and the order are the producer's, never recomputed here.
 */

export const MonitoringAlertOccurrenceSchema = z.object({
  raisedAt: z.string(),
  orgId: z.string().nullable(),
  campaignId: z.string().nullable(),
  // The caller's facts, as raised (values arrive as strings, numbers kept as served).
  metadata: z.record(z.string(), z.unknown()).nullable(),
});
export type MonitoringAlertOccurrence = z.infer<typeof MonitoringAlertOccurrenceSchema>;

export const MonitoringAlertSchema = z.object({
  eventType: z.string(),
  label: z.string(),
  verdict: z.enum(["broken", "ok"]),
  reason: z.string(),
  lastRaisedAt: z.string().nullable(),
  daily: z.array(z.object({ day: z.string(), count: z.number() })),
  recent: z.array(MonitoringAlertOccurrenceSchema),
});
export type MonitoringAlert = z.infer<typeof MonitoringAlertSchema>;

export const MonitoringAlertsSchema = z.object({
  days: z.number(),
  generatedAt: z.string(),
  alerts: z.array(MonitoringAlertSchema),
});
export type MonitoringAlerts = z.infer<typeof MonitoringAlertsSchema>;

/** The alert types the producer says are broken, in its order (broken first). A filter on the served verdict, nothing graded. */
export const brokenAlerts = (d: MonitoringAlerts) => d.alerts.filter((a) => a.verdict === "broken");

/** The served reason as people read it: an ISO time inside it prints as "Nov 11, 06:48 UTC" (formatting only, words untouched). */
export const reasonWords = (reason: string) =>
  reason.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, (iso) => when(iso));

/** A served fact as text, or null when absent/empty. */
export function fact(m: MonitoringAlertOccurrence["metadata"], key: string): string | null {
  const v = m?.[key];
  if (v == null) return null;
  const s = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v);
  return s.trim() === "" ? null : s;
}

/** A unit's name is `<funnel campaign> - <channel> - <brand> - <offer> - <leg>`: its funnel campaign part. */
export const campaignShort = (name: string) => name.split(" - ")[0];

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const when = (iso: string) =>
  `${new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" })} UTC`;
/** "since <date>" off a served ISO date, or nothing when the producer stored something that is not a date. */
const since = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? ` since ${v.length > 10 ? when(v) : day(v)}` : "");
const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const plural = (v: string, one: string, many: string) => `${v} ${v === "1" ? one : many}`;

/** What happened, in plain words: one line + an optional detail line, each built only from the served facts. */
export interface OccurrenceWords {
  what: string;
  detail: string | null;
  /** The campaign it concerns, short name + full name for hover, when the facts carry one. */
  campaign: { short: string; full: string } | null;
}

/** Facts never shown as words: ids and the SQL hint for whoever investigates (shown apart, on demand). */
const HIDDEN_FACTS = new Set(["orgId", "brandId", "campaignId", "email", "whereToLook", "eventId", "occurrenceId", "featureSlug", "campaignName"]);

/**
 * One occurrence in plain words, per alert type. An alert type this page does not know yet still reads: its facts are
 * listed `key: value` (the producer can add a type without a dashboard ship).
 */
export function occurrenceWords(eventType: string, o: MonitoringAlertOccurrence): OccurrenceWords {
  const m = o.metadata;
  const f = (k: string) => fact(m, k);
  const name = f("campaignName");
  const campaign = name ? { short: campaignShort(name), full: name } : null;
  switch (eventType) {
    case "campaign_failing": {
      const runs = f("consecutiveFailures");
      const retry = f("retryInterval");
      return {
        what: `${runs ? `Failed ${plural(runs, "run", "runs")} in a row` : "Fails every run"}${since(f("failingSince"))}`,
        detail: retry ? `Retried every ${retry}.` : null,
        campaign,
      };
    }
    case "provider_credits_exhausted": {
      const p = f("provider");
      return { what: `${p ? titleCase(p) : "A provider"} is out of credits`, detail: f("reason"), campaign };
    }
    case "sending_domain_blocklisted": {
      const d = f("domain");
      const list = f("listName");
      return {
        what: `${d ?? "A sending domain"} is on ${list ?? "a blocklist"}${since(f("listedSince"))}`,
        detail: f("actionTaken"),
        campaign,
      };
    }
    case "trigger_occurrence_stuck": {
      const who = f("prospect")?.replace(/^<|>$/g, "") ?? "A prospect";
      const tries = f("attempts");
      return {
        what: `${who} waits on the campaign${since(f("waitingSince"))}${tries ? `, ${plural(tries, "try", "tries")}` : ""}`,
        detail: f("lastError"),
        campaign,
      };
    }
    case "trigger_silent": {
      const t = f("triggerLabel") ?? f("triggerId") ?? "A trigger";
      const days = f("silentDays");
      const live = f("liveCampaignCount");
      return {
        what: `${t} silent${days ? ` for ${days} days` : ""}${since(f("silentSince"))}`,
        detail: live ? `${plural(live, "live campaign waits", "live campaigns wait")} on it.` : null,
        campaign,
      };
    }
    default: {
      const facts = Object.keys(m ?? {})
        .filter((k) => !HIDDEN_FACTS.has(k))
        .map((k) => `${k}: ${f(k)}`)
        .filter((s) => !s.endsWith(": null"));
      return { what: facts[0] ?? "Raised", detail: facts.slice(1).join(" · ") || null, campaign };
    }
  }
}

/** Who it concerns: the brand (named by the caller's lookup), else the client's email, else the org id's head; null = no client (ours). */
export function occurrenceClient(o: MonitoringAlertOccurrence, brandName: (id: string) => string): string | null {
  const brandId = fact(o.metadata, "brandId");
  if (brandId) return brandName(brandId);
  const email = fact(o.metadata, "email");
  if (email) return email;
  const org = o.orgId ?? fact(o.metadata, "orgId");
  return org ? `Org ${org.slice(0, 8)}` : null;
}

/** The client's email beside a brand name, when the facts carry one. */
export const occurrenceEmail = (o: MonitoringAlertOccurrence) => fact(o.metadata, "email");
