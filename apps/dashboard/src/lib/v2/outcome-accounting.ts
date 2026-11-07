/**
 * OUTCOME-ACCOUNTING-1107 (owner 2026-11-07: « Affiche les choses rigoureusement dans une démarche de comptabilité
 * analytique industrielle. Les chiffres réels, comme les chiffres expected nous intéressent tous les deux », then « Apply
 * for all outcome pages »). Every Outcome page reads ONE report served by features-service (`OutcomeAccounting`, on each
 * `outcome-cost-series` step and on `published-units`): cost per Unit, cost from Start, yield to the next milestone, the
 * NET expected value, and a return ONLY at a campaign's Target (GTM Factory framework §10/§12). Each figure is ACTUAL
 * beside EXPECTED; nothing is computed here, this module parses and names.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";

export const OutcomeAccountingSchema = z.object({
  outcomeKey: z.string(),
  step: z.string().nullable(),
  costPerUnit: z.object({
    actualUsd: z.number().nullable(),
    actualUnits: z.number(),
    actualSpentUsd: z.number(),
    actualUnavailableReason: z.string().nullable(),
    expectedUsd: z.number().nullable(),
    expectedBasis: z.string().nullable(),
    expectedUnavailableReason: z.string().nullable(),
    variance: z.object({
      /** actual − expected; positive = adverse. */
      usd: z.number().nullable(),
      pct: z.number().nullable(),
      yieldUsd: z.number().nullable(),
      mixUsd: z.number().nullable(),
      splitUnavailableReason: z.string().nullable(),
      unavailableReason: z.string().nullable(),
    }),
  }),
  costFromStart: z.object({
    actualUsd: z.number().nullable(),
    actualUnavailableReason: z.string().nullable(),
    expectedUsd: z.number().nullable(),
    expectedUnavailableReason: z.string().nullable(),
    rolledYieldPct: z.number().nullable(),
    rolledYieldFromStep: z.string().nullable(),
    route: z.array(z.string()),
  }),
  yieldToNext: z.object({
    nextStep: z.string().nullable(),
    measuredPct: z.number().nullable(),
    measuredNextUnits: z.number().nullable(),
    measuredTrials: z.number().nullable(),
    measuredUnavailableReason: z.string().nullable(),
    expectedPct: z.number().nullable(),
    priorPct: z.number().nullable(),
    expectedUnavailableReason: z.string().nullable(),
  }),
  value: z.object({
    expectedNetPerUnitUsd: z.number().nullable(),
    lifetimeRevenueUsd: z.number().nullable(),
    lifetimeRevenueSource: z.string().nullable(),
    unavailableReason: z.string().nullable(),
  }),
  returns: z.object({
    isCampaignTarget: z.boolean(),
    measured: z.object({
      roiMultiple: z.number().nullable(),
      targetUnits: z.number().nullable(),
      spentUsd: z.number().nullable(),
      learning: z.boolean(),
      unavailableReason: z.string().nullable(),
    }),
    expected: z.object({
      roiMultiple: z.number().nullable(),
      unavailableReason: z.string().nullable(),
    }),
    unavailableReason: z.string().nullable(),
  }),
});
export type OutcomeAccounting = z.infer<typeof OutcomeAccountingSchema>;

/** A null figure's served reason, in the words the page prints. Unknown reasons are logged and printed as words. */
export function accountingReasonWords(reason: string | null | undefined): string {
  switch (reason) {
    case null:
    case undefined:
      return "—";
    case "no_unit_of_ours_yet":
      return "None made by us yet";
    case "not_on_ledger_yet":
      return "Not counted yet";
    case "not_made_by_our_campaigns":
      return "Not made by our campaigns";
    case "spend_unreadable":
      return "Cost not readable";
    case "no_visit_attribution_on_outcome":
    case "next_milestone_not_tracked_for_outcome":
      return "Not tracked";
    case "next_milestone_not_counted_for_offer":
      return "Not counted";
    case "every_decision_still_open":
      return "Too early";
    case "final_milestone":
      return "Last step";
    case "outcome_not_on_route":
    case "step_not_on_expected_path":
      return "Not on the plan";
    case "no_lifetime_revenue":
      return "No client value set";
    case "zero_conversion_rate":
      return "No conversion yet";
    case "expected_model_computing":
      return "Computing";
    default:
      console.error("[outcome-accounting] no words for reason", { reason });
      return reason.replace(/_/g, " ");
  }
}

/** A variance reads favourable when the actual cost is BELOW the expected one (a falling cost is green). */
export function varianceTone(usd: number | null): "good" | "bad" | null {
  if (usd == null || usd === 0) return null;
  return usd < 0 ? "good" : "bad";
}
