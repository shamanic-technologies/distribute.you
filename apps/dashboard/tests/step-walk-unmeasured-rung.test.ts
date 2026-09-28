import { describe, it, expect } from "vitest";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { positiveReplySharePct, websiteVisitSharePct } from "../src/lib/step-share";

/**
 * features-service#1203: a rung nothing in the fleet counts (sales_from_website's
 * "Direct purchase", lead_forms_from_ads' ad-hosted form) is served as an UNMEASURED
 * rung — `leadField: null`, and null count / costs / rates. It must parse, keep its
 * place and label, and read as "no figure", never 0 and never dropped.
 */
function body(steps: unknown[]) {
  return {
    featureSlug: "sales-cold-email-outreach",
    headline: { totalPipelineUsd: 0 },
    costEconomics: { committedCostUsd: 10, costOfAcquisitionPct: null, roiMultiple: null },
    timeSeries: [],
    organizations: [],
    leads: [],
    events: [],
    attributedOutcomes: [],
    funnelSteps: { name: "Sales from website", committedSpentCents: 1000, contactedRecipients: 200, steps },
  };
}

const visit = {
  step: "Website visit", leadField: "clicked", recipientsReached: 12, costPerReachCents: 83,
  fromStep: "Contacted", fromRecipientsReached: 200, conversionFromPreviousPct: 6,
};
const unmeasured = {
  step: "Direct purchase", leadField: null, recipientsReached: null, costPerReachCents: null,
  fromStep: "Website visit", fromRecipientsReached: 12, conversionFromPreviousPct: null,
};
const paid = {
  step: "Paid client", leadField: "purchased", recipientsReached: 1, costPerReachCents: 1000,
  fromStep: "Direct purchase", fromRecipientsReached: null, conversionFromPreviousPct: null,
};

describe("step walk with an unmeasured rung", () => {
  it("parses, keeps the rung in order with its label, and every figure stays null", () => {
    const view = parseFeatureRevenue(body([visit, unmeasured, paid]), "test");
    const steps = view.stepWalk!.steps;
    expect(steps.map((s) => s.step)).toEqual(["Website visit", "Direct purchase", "Paid client"]);
    expect(steps[1]).toMatchObject({
      leadField: null, recipientsReached: null, costPerReachCents: null, conversionFromPreviousPct: null,
    });
    expect(steps[2].fromRecipientsReached).toBeNull();
    // The measured rungs are untouched.
    expect(steps[0]).toMatchObject(visit);
    expect(websiteVisitSharePct(view.stepWalk)).toBe(6);
  });

  it("an unmeasured FIRST rung (lead_forms_from_ads) states no share rather than crashing", () => {
    const view = parseFeatureRevenue(body([{ ...unmeasured, step: "Ad form filled", fromStep: "Contacted" }]), "test");
    expect(view.stepWalk!.steps[0].leadField).toBeNull();
    expect(positiveReplySharePct(view.stepWalk)).toBeNull();
    expect(websiteVisitSharePct(view.stepWalk)).toBeNull();
  });

  it("a body whose rungs are all measured parses exactly as before", () => {
    const view = parseFeatureRevenue(body([visit]), "test");
    expect(view.stepWalk!.steps).toEqual([visit]);
  });
});
