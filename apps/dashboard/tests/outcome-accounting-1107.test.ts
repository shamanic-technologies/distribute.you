import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OutcomeAccountingSchema, accountingReasonWords, varianceTone } from "../src/lib/v2/outcome-accounting";
import { OutcomeCostStepSchema } from "../src/lib/v2/outcome-cost-series";

/**
 * OUTCOME-ACCOUNTING-1107 (owner 2026-11-07: « comptabilité analytique industrielle … les chiffres réels comme les
 * chiffres expected », « Apply for all outcome pages »): every Outcome page renders features-service's served report,
 * actual beside expected, a return only at a campaign's Target.
 */
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// The producer's shape (features-service #2314 openapi `OutcomeAccounting`), a post on our brand.
export const accountingBody = {
  outcomeKey: "linkedin_post_published",
  step: "linkedin_post_published",
  performedBy: "ours",
  costPerUnit: {
    actualUsd: 0.016, actualUnits: 9, actualSpentUsd: 0.14, actualBasis: "ledger_full_absorption", actualUnavailableReason: null,
    expectedUsd: 0.139, expectedBasis: "own_spend", expectedSource: "own_spend", expectedUnavailableReason: null,
    variance: { usd: -0.123, pct: -88, yieldUsd: null, mixUsd: null, splitUnavailableReason: "entry_leg_has_no_yield", unavailableReason: null },
  },
  costFromStart: { actualUsd: 0.016, actualUnavailableReason: null, expectedUsd: 0.139, expectedUnavailableReason: null, rolledYieldPct: null, rolledYieldFromStep: null, route: ["linkedin_post_published"] },
  yieldToNext: {
    nextStep: "website_visit", measuredPct: null, measuredNextUnits: null, measuredTrials: null, measuredUnavailableReason: "no_visit_attribution_on_outcome",
    expectedPct: 0.4, priorPct: 0.4, priorBasis: "fleet", expectedUnavailableReason: null, censoringWindowDays: 14,
  },
  value: { expectedNetPerUnitUsd: 1.8, basis: "expected_net", lifetimeRevenueUsd: 600, lifetimeRevenueSource: "offer_stated", unavailableReason: null },
  returns: {
    isCampaignTarget: false, targetCampaignIds: [],
    measured: { roiMultiple: null, targetUnits: null, valueUsd: null, spentUsd: null, learning: true, unavailableReason: "outcome_is_no_campaign_target" },
    expected: { roiMultiple: null, valuePerUnitUsd: null, costFromStartUsd: null, unavailableReason: "outcome_is_no_campaign_target" },
    unavailableReason: "outcome_is_no_campaign_target",
  },
};

describe("outcome accounting (OUTCOME-ACCOUNTING-1107)", () => {
  it("parses the producer's report", () => {
    const a = OutcomeAccountingSchema.parse(accountingBody);
    expect(a.costPerUnit.actualUsd).toBe(0.016);
    expect(a.value.expectedNetPerUnitUsd).toBe(1.8);
    expect(a.returns.isCampaignTarget).toBe(false);
  });

  it("a cost-series step carries it, and an older step without it still parses", () => {
    const step = { stepKey: "signup", learningOutcomesRequired: 10, sinceInception: { spendUsd: 1, outcomes: 0, undatedOutcomes: 0, costPerOutcomeUsd: null, learning: true }, expected: { costPerOutcomeUsd: null, basis: null, combinationKey: null, unavailableReason: null }, months: [] };
    expect(OutcomeCostStepSchema.parse({ ...step, accounting: accountingBody }).accounting?.costPerUnit.expectedUsd).toBe(0.139);
    expect(OutcomeCostStepSchema.parse(step).accounting).toBeUndefined();
  });

  it("a falling cost reads good, a rising one bad", () => {
    expect(varianceTone(-0.12)).toBe("good");
    expect(varianceTone(0.5)).toBe("bad");
    expect(varianceTone(null)).toBeNull();
  });

  it("names served reasons in plain words", () => {
    expect(accountingReasonWords("no_visit_attribution_on_outcome")).toBe("Not tracked");
    expect(accountingReasonWords("no_unit_of_ours_yet")).toBe("None made by us yet");
    expect(accountingReasonWords(null)).toBe("—");
  });

  it("every outcome page renders the card: published outcomes and lead outcomes", () => {
    expect(src("src/components/v2/published-outcome-page.tsx")).toContain("<OutcomeAccountingCard accounting={data.accounting}");
    expect(src("src/components/v2/outcome-stats.tsx")).toContain("<OutcomeAccountingCard accounting={cost.accounting}");
  });

  it("the card shows a return only at a campaign's Target, and computes nothing", () => {
    const card = src("src/components/v2/outcome-accounting-card.tsx");
    expect(card).toContain("{r.isCampaignTarget && (");
    expect(card).not.toMatch(/actualUsd\s*-\s*s\.expectedUsd/);
  });

  it("our posts and the client team's sit in two tables; only ours carry cost and value", () => {
    const page = src("src/components/v2/published-outcome-page.tsx");
    expect(page).toContain("rows={oursRows} ours");
    expect(page).toContain("rows={teamRows} ours={false}");
  });
});

import { formatUsdUnit } from "../src/lib/format-number";
describe("unit prices keep their sub-cent digits", () => {
  it("two significant digits under $1, adaptive above", () => {
    expect(formatUsdUnit(0.005132)).toBe("$0.0051");
    expect(formatUsdUnit(0.018818)).toBe("$0.019");
    expect(formatUsdUnit(0.25)).toBe("$0.25");
    expect(formatUsdUnit(2.5)).toBe("$2.50");
    expect(formatUsdUnit(0)).toBe("$0.00");
    expect(formatUsdUnit(-0.013686)).toBe("-$0.014");
  });
});

import { outcomeCountWords } from "../src/lib/v2/outcome-cost-series";
describe("a step the ledger holds no count for (LEDGER-ONLY-1107)", () => {
  it("parses null counts with their reason and words them, never 0", () => {
    const step = {
      stepKey: "paid_client", learningOutcomesRequired: 10, outcomesUnavailableReason: "no_producer_declares_it",
      sinceInception: { spendUsd: 4386.97, outcomes: null, undatedOutcomes: null, costPerOutcomeUsd: null, learning: null },
      expected: { costPerOutcomeUsd: null, basis: null, combinationKey: null, unavailableReason: null },
      months: [{ month: "2026-11", spendUsd: 10, outcomes: null, costPerOutcomeUsd: null, cumulativeSpendUsd: 10, cumulativeOutcomes: null, cumulativeCostPerOutcomeUsd: null, learning: null }],
    };
    const p = OutcomeCostStepSchema.parse(step);
    expect(p.sinceInception.outcomes).toBeNull();
    expect(p.outcomesUnavailableReason).toBe("no_producer_declares_it");
    expect(outcomeCountWords(null, String)).toBe("not counted yet");
    expect(outcomeCountWords(4, String)).toBe("4");
  });
});
