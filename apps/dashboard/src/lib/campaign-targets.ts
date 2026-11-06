/**
 * Today: one row of cards per ongoing campaign, on its Target (owner 2026-11-06, LEAD-GENERIC-1106:
 * "plusieurs cards par Target, en ligne par target"). features-service `GET /brands/:brandId/campaign-targets`
 * (OUTCOME-RUNG-AND-TARGET-1106), net pricing. The PAST is measured from the ledger and never moves with the
 * Plan; only `projection` reads the current Plan (`planComputedAt` says which computation). Every figure is
 * served: this module parses and names, it computes nothing. Alias-free (unit-tested).
 */
import { z } from "zod";

const num = z.number().nullable();

const ProjectionSchema = z
  .object({
    planComputedAt: z.string().nullable(),
    planFunnelId: z.string().nullable(),
    costPerTargetUsd: num,
    costPerTargetBasis: z.string().nullable(),
    spendPerDayUsd: num,
    spendPerDaySource: z.string().nullable(),
    outcomesPerDay: num,
    daily: z.array(z.object({ date: z.string(), expectedOutcomes: z.number(), cumulativeExpectedOutcomes: z.number() }).passthrough()),
    nextExpectedAt: z.string().nullable(),
    nextExpectedInHours: num,
    unavailableReason: z.string().nullable(),
  })
  .passthrough();

const CampaignTargetRowSchema = z
  .object({
    salesFunnelCampaignId: z.string(),
    name: z.string(),
    offerId: z.string(),
    target: z.object({ key: z.string(), label: z.string(), lifecycleRung: z.string().nullable() }).passthrough().nullable(),
    outcomesToDate: num,
    outcomesUnavailableReason: z.string().nullable(),
    spentUsd: num,
    costPerOutcomeUsd: num,
    costPerOutcomeUnavailableReason: z.string().nullable(),
    measuredReturn: z
      .object({ roiMultiple: num, valueUsd: num, spentUsd: num, unavailableReason: z.string().nullable() })
      .passthrough(),
    past: z.array(z.object({ date: z.string(), outcomes: z.number(), cumulativeOutcomes: z.number() }).passthrough()),
    pastUnavailableReason: z.string().nullable(),
    projection: ProjectionSchema,
  })
  .passthrough();
export type CampaignTargetRow = z.infer<typeof CampaignTargetRowSchema>;

export const CampaignTargetsSchema = z
  .object({
    brandId: z.string(),
    pricing: z.enum(["gross", "net"]),
    computedAt: z.string(),
    targets: z.array(CampaignTargetRowSchema),
  })
  .passthrough();
export type CampaignTargets = z.infer<typeof CampaignTargetsSchema>;

/** The rows of one offer (the dashboard shows the selected offer only), in the served order. */
export function targetsOfOffer(rows: readonly CampaignTargetRow[], offerId: string | null): CampaignTargetRow[] {
  return offerId ? rows.filter((r) => r.offerId === offerId) : [...rows];
}

/** "Next one expected in about 2 days." from the served hours; null when nothing is expected. */
export function nextExpectedWords(hours: number | null): string | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 1) return "Next one expected within the hour.";
  if (hours < 36) {
    const h = Math.round(hours);
    return `Next one expected in about ${h} ${h === 1 ? "hour" : "hours"}.`;
  }
  const d = Math.round(hours / 24);
  if (d < 60) return `Next one expected in about ${d} days.`;
  const m = Math.round(d / 30);
  return `Next one expected in about ${m} months.`;
}

/** Plain words for a served reason code (`target_has_no_value`): the code itself, read as a sentence. */
export function reasonWords(reason: string | null): string {
  if (!reason) return "Not available yet";
  const KNOWN: Record<string, string> = {
    target_has_no_value: "No value set for this outcome",
    nothing_spent_yet: "Nothing spent yet",
    plan_not_computed_yet: "Plan not computed yet",
    no_outcome_yet: "No outcome yet",
  };
  const known = KNOWN[reason];
  if (known) return known;
  const words = reason.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
