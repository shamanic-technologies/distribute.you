// Single-source "contacted" derivation for the brand Overview. features-service
// `/revenue` now carries a per-lead `contacted` flag + real `contactedAt`
// timestamp (features-service#372), so the Outreach stat card, the 7-day activity
// graph actual, and the leads/orgs table all read "contacted" from ONE payload —
// no more table-then-card-then-graph stagger.
//
// Dependency-free (view types only) — safe to unit-test and import anywhere.

import type { ConversionLead } from "./revenue-view";

/**
 * Count of contacted leads on a `/revenue` payload. `contacted` stays true after
 * the lead clicks / replies, so this never undercounts.
 */
export function countContactedLeads(leads: ConversionLead[]): number {
  return leads.reduce((n, lead) => (lead.contacted === true ? n + 1 : n), 0);
}

/**
 * Local calendar day (`YYYY-MM-DD`) of an ISO timestamp in the given IANA zone,
 * or null when the timestamp is absent/unparseable. NEVER synthesizes a day —
 * `en-CA` formats as `YYYY-MM-DD`, matching the backend pipeline-activity day keys.
 */
export function localDayInTimeZone(
  iso: string | null | undefined,
  timeZone: string,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Bucket contacted leads by their REAL `contactedAt` local calendar day (the
 * graph's timezone). A contacted lead whose `contactedAt` is null/unknown is
 * "contacted, date unknown" → excluded from every day bucket (fail loud: no
 * guessed day), so it counts in the card total but not in any graph bar.
 */
export function bucketContactedByDay(
  leads: ConversionLead[],
  timeZone: string,
): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const lead of leads) {
    if (lead.contacted !== true) continue;
    const day = localDayInTimeZone(lead.contactedAt, timeZone);
    if (day === null) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return byDay;
}
