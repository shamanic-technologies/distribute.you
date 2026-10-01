import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { NULL_PAIR } from "./fixtures/maturity";

const src = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

/**
 * WHEN THIS SCOPE'S FIGURES STOP BEING NOISE — served, not derived.
 *
 * The band used to assemble its countdown in the browser out of three services, and it
 * picked its expected price by taking the CHEAPEST figure across every workflow. That
 * selects, by construction, the workflow that spent the LEAST and observed NOTHING: a
 * floor, not a price. Measured in prod on brand a179bbd9 / campaign 3922c8e1, the floor
 * was $21.22 from a workflow with zero outcomes, so the spend target came out at $212 —
 * a figure $409 of committed spend had passed weeks earlier. The band read
 * `Learning: 0 days left` above a `Learning` tag still saying to wait.
 *
 * features-service v0.165.0 serves the whole verdict (`learningPhase`). The fixture
 * below is that campaign's REAL prod body, so every case asserts the DIVERGENCE: a suite
 * that only checked "a block came back" would pass on the implementation this replaces.
 */
const PROD_PHASE = {
  status: "learning",
  unmeasuredReason: null,
  campaignId: "3922c8e1-3405-46af-8a56-1eef3f221b19",
  campaignIdentityKey:
    "5fefaf5a-8d50-4c5f-aa4b-3d35bcd1de93|a179bbd9-8eed-4dba-9338-78125922b0c6|sales_meetings_from_conversation|cold_email",
  legKey: "start_to_conversation",
  outcomeStep: { key: "conversation", label: "Conversation" },
  outcomesObserved: 4,
  outcomesRequired: 10,
  progressPct: 40,
  outcomeObserved: true,
  expectedCostPerOutcomeUsd: 79.44,
  spendTargetUsd: 794.4,
  committedSpentUsd: 409.26,
  spendRemainingUsd: 385.14,
  dailyCeilingUsd: 8,
  daysRemaining: 49,
  ceilingScenarios: [
    { dailyCeilingUsd: 16, daysRemaining: 25 },
    { dailyCeilingUsd: 24, daysRemaining: 17 },
    { dailyCeilingUsd: 40, daysRemaining: 10 },
  ],
  outcomeLagDays: 14,
  campaigns: [
    {
      campaignId: "3922c8e1-3405-46af-8a56-1eef3f221b19",
      campaignIds: [
        "3922c8e1-3405-46af-8a56-1eef3f221b19",
        "53ff8069-c95b-44cf-8acc-38ae04a70113",
      ],
      campaignIdentityKey:
        "5fefaf5a-8d50-4c5f-aa4b-3d35bcd1de93|a179bbd9-8eed-4dba-9338-78125922b0c6|sales_meetings_from_conversation|cold_email",
      legKey: "start_to_conversation",
      outcomeStep: { key: "conversation", label: "Conversation" },
      outcomesObserved: 4,
      outcomeObserved: true,
      live: true,
    },
  ],
};

/** The minimum a revenue body needs to parse, so a case can carry only what it is about. */
const bodyWith = (learningPhase: unknown) => ({
  spend: null,
  headline: { totalPipelineUsd: 1440 },
  costEconomics: {
    maturity: NULL_PAIR,
    committedCostUsd: 409.26,
    costOfAcquisitionPct: 30.4,
    roiMultiple: 3.28,
    costPerAcquisitionUsd: 760.22,
    expectedConversions: null,
    costPerConversionUsd: null,
  },
  timeSeries: [],
  organizations: [],
  events: [],
  attributedOutcomes: [],
  leads: [],
  learningPhase,
});

describe("the verdict is READ off the body, never rebuilt", () => {
  it("carries every figure the band states, verbatim", () => {
    const out = parseFeatureRevenue(bodyWith(PROD_PHASE), "test");
    const phase = out.learningPhase!;
    expect(phase.status).toBe("learning");
    expect(phase.daysRemaining).toBe(49);
    // The price is the pooled one from cells that OBSERVED an outcome — NOT the $21.22
    // floor the browser used to pick, and not the whole-spend $109.50 figure either.
    expect(phase.expectedCostPerOutcomeUsd).toBe(79.44);
    expect(phase.spendTargetUsd).toBe(794.4);
    expect(phase.spendRemainingUsd).toBeCloseTo(385.14, 2);
    expect(phase.progressPct).toBe(40);
    expect(phase.outcomesObserved).toBe(4);
    expect(phase.outcomesRequired).toBe(10);
    expect(phase.outcomeLagDays).toBe(14);
    expect(phase.ceilingScenarios).toHaveLength(3);
  });

  it("the target is ten outcomes at the SERVED price, and the spend has not reached it", () => {
    // The whole bug in one assertion: the old target was $212.20 and $409.26 had passed
    // it, which is why the countdown had expired. The served target is $794.40.
    const phase = parseFeatureRevenue(bodyWith(PROD_PHASE), "test").learningPhase!;
    expect(phase.spendTargetUsd).toBeGreaterThan(phase.committedSpentUsd!);
    expect(phase.spendTargetUsd).toBeCloseTo(
      phase.expectedCostPerOutcomeUsd! * phase.outcomesRequired,
      2,
    );
    // And it is nowhere near the floor the browser priced on.
    expect(phase.expectedCostPerOutcomeUsd!).toBeGreaterThan(21.22 * 3);
  });

  it("carries each campaign of the scope with its own count", () => {
    // So a reader can SEE why the verdict reads so, and so the identity's members are
    // named rather than the representative row standing in for them.
    const phase = parseFeatureRevenue(bodyWith(PROD_PHASE), "test").learningPhase!;
    expect(phase.campaigns).toHaveLength(1);
    expect(phase.campaigns[0].campaignIds).toHaveLength(2);
    expect(phase.campaigns[0].live).toBe(true);
    expect(phase.campaigns[0].outcomesObserved).toBe(4);
  });

  it("reads NULL as a read that carries no verdict, never as a priced scope", () => {
    // The producer means to send null on the lensed body, the lean groups, the
    // no-funnel short-circuit and the cold path — the same gate `spend` rides.
    expect(parseFeatureRevenue(bodyWith(null), "test").learningPhase).toBeNull();
  });

  it("survives a body that predates the field", () => {
    const body = bodyWith(null) as Record<string, unknown>;
    delete body.learningPhase;
    expect(parseFeatureRevenue(body, "test").learningPhase).toBeNull();
  });

  it("does not close the status or reason vocabularies", () => {
    // Both are the producer's and both are expected to grow. A reader that closed the
    // set would throw on the WHOLE body the day it does, taking down a page whose every
    // other figure is correct.
    const grown = parseFeatureRevenue(
      bodyWith({ ...PROD_PHASE, status: "a_sixth_verdict", unmeasuredReason: "a_new_reason" }),
      "test",
    ).learningPhase!;
    expect(grown.status).toBe("a_sixth_verdict");
    expect(grown.unmeasuredReason).toBe("a_new_reason");
  });

  it("still fails loud on real shape rot", () => {
    // Tolerating an unknown TOKEN is not tolerating a missing FIGURE: a body whose
    // verdict carries no `outcomesRequired` is rot, and rot must not be rendered.
    const rotten = { ...PROD_PHASE } as Record<string, unknown>;
    delete rotten.outcomesRequired;
    expect(() => parseFeatureRevenue(bodyWith(rotten), "test")).toThrow();
  });
});

describe("the modules the served verdict replaced stay gone", () => {
  it("the two modules it replaced are GONE, not merely unused", () => {
    // A lib with no caller is a lib the next surface reaches for. Both are deleted.
    for (const rel of ["lib/use-scope-learning-lead.ts", "lib/learning-progress.ts"]) {
      expect(() => src(rel)).toThrow();
    }
    // The cheapest-across-workflows pick is what chose the floor. It has no caller left.
    const choice = src("lib/workflow-projection-choice.ts");
    expect(choice).not.toContain("learningSignalUnitCostUsd");
    expect(choice).not.toContain("workflowSignalUnitCost");
  });
});

describe("the budget form takes a prefilled figure only for one campaign", () => {
  it("drafts on the prefill, and drops it at a wider grain", () => {
    const modal = src("components/campaigns/campaign-controls-modal.tsx");
    expect(modal).toContain("draftFor(row, prefill)");
    // A figure offered for ONE campaign has no row to land on at a wider grain.
    expect(modal).toContain("const prefill = campaignId != null ? prefillBudgetUsd : undefined;");
  });
});
