import { formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { shownFigure, type StatBasis } from "@/lib/maturity";
import type { V2Campaign } from "@/components/v2/use-campaigns";

/**
 * What one result cost this campaign, READ off the producer's own group for the step
 * the campaign's leg lands on: a reply-led pipe is priced per positive reply, a
 * visit-led one per website visit. The figure is the MATURE half of the served pair,
 * and it reads `Learning` exactly where the producer says the campaign is not mature
 * (lib/maturity.ts). Selecting which served field to show is display; nothing is
 * divided or counted here.
 */
export function costPerResult(m: V2Campaign, basis: StatBasis): { value: string; unit: string } | null {
  const pair = m.row.revenue?.outcomesMaturity;
  if (!pair) return null;
  const replyLed = m.leg?.toKey === "conversation";
  if (!replyLed && m.leg?.toKey !== "website_visit") return null;
  const shown = shownFigure(pair, (h) => (replyLed ? h.cpprCents : h.cpcCents), basis);
  if (shown.learning) return { value: "Learning", unit: "" };
  return shown.value == null ? null : { value: formatCentsAsUsdAdaptive(shown.value), unit: replyLed ? "/ reply" : "/ visit" };
}

/**
 * How many results this campaign got, on the step its leg lands on (the same served
 * count `costPerResult` prices): positive replies for a reply-led pipe, website visits
 * for a visit-led one. Null when its leg lands elsewhere or the producer did not answer.
 */
export function outcomeCount(m: V2Campaign): { count: number; unit: string } | null {
  const g = m.row.revenue;
  if (m.leg?.toKey === "conversation") return g?.positiveReplies != null ? { count: g.positiveReplies, unit: "replies" } : null;
  if (m.leg?.toKey === "website_visit") return g?.websiteClicks != null ? { count: g.websiteClicks, unit: "visits" } : null;
  return null;
}
