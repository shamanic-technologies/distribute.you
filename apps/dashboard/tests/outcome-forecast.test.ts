import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CampaignOutcomeForecastSchema, delayWords, forecastUnavailableWords, monthYearWords, nextTargetWords, sourceWords } from "../src/lib/outcome-forecast";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const tunnel = { expected: [0, 0.1], median: [0, 0], p10: [0, 0], p90: [0, 1] };
const next = { shareWithinSearch: 0.53, searchDays: 1095, medianDate: "2029-05-10", earlyDate: "2027-03-15", lateDate: null, medianInDays: 905, expectedOneByDate: "2028-03-31", expectedOneInDays: 500 };

describe("campaign forecast (features-service OUTCOME-FORECAST-1117)", () => {
  it("parses the served body, a late date null included", () => {
    const body = CampaignOutcomeForecastSchema.parse({
      salesFunnelCampaignId: "c",
      computedAt: "2026-11-17T10:57:00Z",
      silverComputedAt: "2026-11-17T10:21:00Z",
      unavailableReason: null,
      hypotheses: {
        budget: { monthlyUsd: 220, pausedReason: "budget_cap_reached", resumesAt: "2026-12-01T00:00:00.000Z", unavailableReason: null },
        entryCost: { step: "lead_found", label: "Lead found", source: "campaign", usdPerUnit: 0.0674 },
        transitions: [{ fromStep: "lead_found", toStep: "paid_client", yield: { source: "fleet", unitsPerUnit: 0.041, median: 0.03, p10: 0.0006, p90: 0.11 }, delay: { source: "fleet", pairs: 3, thinSample: true, medianHours: 1800 } }],
        targetValue: { usd: 75000, source: "plan_target_value" },
      },
      forecast: {
        days: ["2026-11-18", "2026-11-19"],
        outcomes: [
          { step: "lead_found", label: "Lead found", isTarget: false, unitsToDate: 4157, cumulativeUnits: tunnel, unitsPerTarget: { median: 3000, p10: 900, p90: 9000 }, expectedRevenuePerUnitUsd: { median: 1.4, p10: 0.2, p90: 5 } },
          { step: "paid_client", label: "Paid client", isTarget: true, unitsToDate: 0, cumulativeUnits: tunnel, unitsPerTarget: null, expectedRevenuePerUnitUsd: null },
        ],
        spendAheadUsd: [0, 7],
        expectedRevenueUsd: tunnel,
        nextTarget: next,
      },
      alternatives: [{ budgetMultiplier: 2, monthlyBudgetUsd: 440, nextTarget: next, targetCumulativeUnits: tunnel, expectedRevenueUsd: tunnel, spendAheadUsd: [0, 14] }],
    });
    expect(body.forecast?.nextTarget.lateDate).toBeNull();
    expect(body.alternatives[0].monthlyBudgetUsd).toBe(440);
  });

  it("words the next Target, an assumption's source and a delay; never a blank", () => {
    expect(monthYearWords("2028-03-31")).toBe("Mar 2028");
    expect(nextTargetWords(next)).toBe("around Mar 2028");
    expect(nextTargetWords({ ...next, expectedOneByDate: null })).toBe("in more than 3 years at this budget");
    expect(sourceWords("fleet")).toBe("measured across our clients");
    expect(sourceWords("campaign")).toBe("measured on this campaign");
    expect(delayWords(46)).toBe("about 2 days");
    expect(delayWords(1800)).toBe("about 3 months");
    expect(forecastUnavailableWords("campaign_states_no_target")).toContain("no Target yet");
    // Every reason features-service serves has its own words: none falls to a line that says nothing.
    expect(forecastUnavailableWords("cost_unmeasured_and_plan_prices_no_target")).toContain("price its Target");
    expect(forecastUnavailableWords("target_ledger_unreadable")).toContain("Retrying");
    for (const r of ["target_outcome_not_declared_in_ledger", "target_no_producer_declares_outcome", "target_not_counted_in_ledger"]) expect(forecastUnavailableWords(r)).toContain("Target can be counted");
    expect(forecastUnavailableWords("yield_unmeasured:lead_found->message_sent")).toContain("enough results");
    expect(forecastUnavailableWords("no_unit_reaches_a_step")).toContain("first results");
  });

  it("reads net pricing through the gateway and computes nothing in the browser", () => {
    expect(src("lib/api.ts")).toContain("/outcome-forecast?pricing=net");
    const code = src("components/v2/campaign-forecast.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.reduce\(|\.sort\(/);
    expect(code).toContain("getFunnelCampaignOutcomeForecast(brandId, campaignId)");
  });
});
