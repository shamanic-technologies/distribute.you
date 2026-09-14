import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFeatureRevenue } from "../src/lib/revenue-parse";

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

describe("the band divides nothing", () => {
  const band = src("components/campaigns/learning-progress-callout.tsx");
  const scope = src("components/campaigns/scope-learning-band.tsx");

  it("renders the served figures and computes no threshold, price or countdown", () => {
    expect(band).toContain("phase.daysRemaining");
    expect(band).toContain("phase.progressPct");
    expect(band).toContain("phase.ceilingScenarios");
    // The arithmetic that produced "0 days left" must not come back in any form.
    expect(band).not.toContain("learningProgress");
    expect(band).not.toContain("LEARNING_MIN_OUTCOMES");
    expect(band).not.toContain("settlingDays");
    expect(band).not.toMatch(/Math\.ceil\(/);
  });

  it("the two modules it replaced are GONE, not merely unused", () => {
    // A lib with no caller is a lib the next surface reaches for. Both are deleted, and
    // nothing under src may name them again.
    const all = [
      "lib/use-scope-learning-lead.ts",
      "lib/learning-progress.ts",
    ];
    for (const rel of all) {
      expect(() => src(rel)).toThrow();
    }
    expect(scope).not.toContain("useScopeLearningLead");
    // The cheapest-across-workflows pick is what chose the floor. It has no caller left.
    const choice = src("lib/workflow-projection-choice.ts");
    expect(choice).not.toContain("learningSignalUnitCostUsd");
    expect(choice).not.toContain("workflowSignalUnitCost");
  });

  it("takes the verdict as a PROP, so the band and the figures beside it share one body", () => {
    // A read of its own is how one campaign came to read 13 days on its own page and 27
    // one click up: same spend, same ceiling, two call sites passing different inputs.
    expect(scope).toContain("phase: LearningPhase | null | undefined");
    expect(scope).not.toContain("useAuthQuery");
  });

  it("states the three verdicts that speak, and nothing for the two that do not", () => {
    expect(band).toContain('case "learning"');
    expect(band).toContain('case "learning_limited"');
    expect(band).toContain('case "paused"');
    // `priced` and `unmeasured` render nothing: the first has its figures, and the
    // second is the producer saying it cannot answer.
    expect(band).toContain("default:\n      return null;");
  });

  it("offers the raise only while there is spend left to get through", () => {
    // On `learning_limited` the money is already in and the wait is the provider's, so
    // a lever promising to buy days back would be promising something it cannot.
    expect(band).toContain("phase.daysRemaining != null");
    expect(band).toContain("s.daysRemaining < phase.daysRemaining");
  });

  it("names both figures and states what the raise buys, in days saved", () => {
    // "about 42 days" makes a reader subtract to learn what they gain.
    expect(band).toContain("save {saved}");
    expect(band).not.toContain("/day instead → about");
  });

  it("opens the budget form on the figure the button just named", () => {
    const modal = src("components/campaigns/campaign-controls-modal.tsx");
    expect(band).toContain("prefillBudgetUsd={prefillUsd}");
    expect(modal).toContain("draftFor(row, prefill)");
    // A figure offered for ONE campaign has no row to land on at a wider grain.
    expect(modal).toContain("const prefill = campaignId != null ? prefillBudgetUsd : undefined;");
  });

  it("carries no explanatory line under the bar", () => {
    // Three clauses (the spend target, the daily rate, the settling window) on a band
    // whose whole job is to be read at a glance.
    expect(band).not.toContain("we need to price it");
    expect(band).not.toContain("Replies keep landing for");
  });

  it("wears the charter's TERTIARY, rotated to the brand, on every layer it draws", () => {
    // One accent across a campaign's surfaces: the band and the `Learning` tag it
    // belongs to must never read as two different states of one thing.
    expect(band).toContain("tone-tile");
    for (const cls of [
      "border-orange-200",
      "bg-orange-50",
      "text-orange-700",
      "bg-orange-200",
      "bg-orange-600",
    ]) {
      expect(band).toContain(cls);
    }
    expect(band).not.toMatch(/(bg|text|border)-purple-/);

    const css = src("app/globals.css");
    for (const sel of [".tone-tile.bg-orange-50", ".tone-tile.border-orange-200"]) {
      expect(css).toContain(`:root[data-brand-tint] ${sel}`);
      expect(css).toContain(`html.dark:root[data-brand-tint] ${sel}`);
    }
    for (const sel of [
      ".tone-tile .text-orange-700",
      ".tone-tile .bg-orange-200",
      ".tone-tile .bg-orange-600",
    ]) {
      expect(css).toContain(`:root[data-brand-tint] ${sel}`);
    }
    for (const rule of [
      "html.dark .text-orange-700",
      "html.dark .border-orange-200",
      "html.dark .bg-orange-200",
    ]) {
      expect(css).toContain(rule);
    }
  });

  it("ships no em-dash in anything a customer reads", () => {
    // Comments are exempt fleet-wide; the copy is not. Asserted against a
    // comment-stripped copy so an explanatory line cannot fail its own guard.
    const stripped = band
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(stripped).not.toContain("—");
  });
});

describe("every surface feeds the band from its OWN scope's body", () => {
  // A band fed from a wider read states a wider scope's countdown under a narrower
  // name. The Campaigns list is the one that can drift: arrive through a sales funnel
  // and it narrows to that funnel's campaigns while its header keeps answering for the
  // whole offer, so the band needs the funnel's own body there.
  it("the funnel Overview reads its funnel's body", () => {
    const page = src("components/funnels/funnel-overview-page.tsx");
    expect(page).toContain("phase={data?.learningPhase ?? null}");
  });

  it("the campaigns list narrows to the funnel when the route names one", () => {
    const page = src("components/campaigns/campaigns-page.tsx");
    expect(page).toContain('["offerFunnelRevenue", brandId, offerId ?? "none", narrowedKey ?? "none"]');
    expect(page).toContain("const learningPhase = funnelKey");
    expect(page).toContain("phase={learningPhase}");
  });

  it("the brand and offer Overview reads its own body", () => {
    const page = src("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
    expect(page).toContain("phase={data?.learningPhase ?? null}");
    expect(page).not.toContain("featureSlug={featureSlug} offerId={offerId} />");
  });

  it("the campaign Overview reads its own campaign's body", () => {
    const page = src("components/campaigns/campaign-overview-page.tsx");
    expect(page).toContain("phase={data?.learningPhase ?? null}");
    expect(page).not.toContain("campaignId={campaignId}\n        />");
  });
});
