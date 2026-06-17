import type { Lead } from "@/lib/api";
import type { RevenuePoint, ConversionLead, ConversionOrg } from "@/lib/revenue-view";

/**
 * A lead counts as engaged once it OPENED, CLICKED, or SIGNED UP. `signedUp`
 * isn't a Lead field yet (the signup status doesn't exist backend-side) —
 * guarded optional read so it lights up for free the day it's added.
 */
export function isEngagedLead(l: Lead): boolean {
  const signedUp = (l as unknown as { signedUp?: boolean }).signedUp === true;
  return l.opened || l.clicked || signedUp;
}

function startOfDayIso(iso: string): string {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Build a cumulative expected-signup-revenue curve for the chart. The
 * signups-lensed `/revenue` returns NO dated time-series yet (only a total), so
 * the chart read "No dated revenue yet". MOCKUP: we spread the expected total
 * across the engaged leads' activity dates (equal share each), cumulate, and pin
 * the last point to the real total. With no dated leads we fall back to a smooth
 * synthetic ramp over the last 14 days. Replace once the backend dates revenue.
 */
export function buildSignupRevenueSeries(leads: Lead[], total: number, nowMs: number): RevenuePoint[] {
  if (!total || total <= 0) return [];

  const engaged = leads.filter(isEngagedLead);
  const dates = engaged
    .map((l) => l.lastDeliveredAt ?? l.servedAt)
    .filter((d): d is string => !!d)
    .map(startOfDayIso);

  // No dated engagement → smooth synthetic ramp ending at the total.
  if (dates.length === 0) {
    const days = 14;
    const pts: RevenuePoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(nowMs);
      d.setUTCDate(d.getUTCDate() - (days - 1 - i));
      d.setUTCHours(0, 0, 0, 0);
      const frac = (i + 1) / days;
      // Slight ease-in so the curve accelerates toward the total.
      pts.push({ date: d.toISOString(), cumulativePipelineUsd: total * Math.pow(frac, 1.4) });
    }
    return pts;
  }

  // Equal share per engaged lead, accrued on its activity day, then cumulated.
  const perLead = total / engaged.length;
  const byDay = new Map<string, number>();
  for (const day of dates) byDay.set(day, (byDay.get(day) ?? 0) + perLead);

  const sortedDays = Array.from(byDay.keys()).sort();
  let cum = 0;
  const pts: RevenuePoint[] = sortedDays.map((day) => {
    cum += byDay.get(day)!;
    return { date: day, cumulativePipelineUsd: cum };
  });
  // Undated engaged leads don't accrue above, so pin the last point to the real
  // total — the curve always ends at the headline number.
  if (pts.length) pts[pts.length - 1].cumulativePipelineUsd = total;
  return pts;
}

/**
 * Derive Organization rows by grouping the lead conversions by company — used on
 * the Signups page where the lensed `/revenue` returns leads but an EMPTY
 * `organizations[]` (so the Organizations tab read blank). Aggregates expected
 * revenue, unions the conversion channels, and keeps the most-recent activity.
 */
export function deriveOrgsFromLeads(leads: ConversionLead[]): ConversionOrg[] {
  const byOrg = new Map<string, ConversionOrg>();
  for (const l of leads) {
    const name = l.orgName ?? "Unknown";
    const key = name.toLowerCase();
    const existing = byOrg.get(key);
    if (!existing) {
      byOrg.set(key, {
        orgId: null,
        orgName: name,
        orgLogoUrl: l.orgLogoUrl ?? null,
        orgDomain: l.orgDomain ?? null,
        topPerson: { firstName: l.firstName, lastName: l.lastName, photoUrl: l.photoUrl },
        tags: [...l.tags],
        expectedRevenueUsd: l.expectedRevenueUsd,
        mostAdvancedDate: l.date,
      });
      continue;
    }
    existing.orgLogoUrl = existing.orgLogoUrl ?? l.orgLogoUrl ?? null;
    existing.orgDomain = existing.orgDomain ?? l.orgDomain ?? null;
    existing.expectedRevenueUsd += l.expectedRevenueUsd;
    for (const t of l.tags) if (!existing.tags.includes(t)) existing.tags.push(t);
    if (l.date && (!existing.mostAdvancedDate || l.date > existing.mostAdvancedDate)) {
      existing.mostAdvancedDate = l.date;
    }
  }
  return Array.from(byOrg.values()).sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd);
}
