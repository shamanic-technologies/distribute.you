import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
const deprecatedStageField = "funnel" + "Stages";

describe("OutreachStatCards copy", () => {
  const cards = read("../src/components/revenue/outreach-stat-cards.tsx");
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const auto = read("../src/components/revenue/outreach-stat-cards-auto.tsx");

  it("defaults to NO goal, so a surface that names no chain shows no chain's steps", () => {
    expect(cards).toContain("type { BrandOptimizationGoal }");
    expect(cards).toContain("optimizationGoal?: BrandOptimizationGoal");
    // The old `?? "sales_meetings"` default put one chain's steps on every surface,
    // including those that state none. The brand column it stood in for is retired
    // (NOT NULL, server-defaulted), so the default was a guess dressed as a value.
    expect(cards).toContain("const goal = optimizationGoal ?? null;");
    expect(cards).not.toContain('optimizationGoal ?? "sales_meetings"');
    expect(cards).not.toContain(deprecatedStageField);
  });

  it("names the always-visible acquisition card from a prop, defaulting to Outreach", () => {
    // The label is a prop because the count under it differs by surface: the brand
    // Overview counts email SEQUENCES sent, the Leads page counts the PEOPLE its tabs
    // reach. Same word over both read as one number contradicting itself.
    expect(cards).toContain('outreachLabel = "Outreach"');
    expect(cards).toContain("outreachLabel?: string;");
    expect(cards).toContain("label={outreachLabel}");
    expect(cards).toContain(
      "stats.leadsContacted ?? stats.recipientsContacted ?? 0",
    );
    expect(cards).not.toContain('label="Opens"');
    expect(cards).not.toContain("recipientsOpened");
    expect(cards).not.toContain('label="Impressions"');
  });

  it("uses Website Visits / Cost per website visit with the requested tooltip", () => {
    expect(cards).toContain('label: "Website Visits"');
    expect(cards).toContain(
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    );
    expect(cards).toContain('costLabel: "Cost per website visit"');
  });

  it("hides the click cards and shows the Positive Replies outcome for positive_replies", () => {
    // Single-step reply→paid goal: Website Visits + CPC cards are hidden, and the unified
    // outcome card becomes Positive Replies + Cost per positive reply (GA, no beta badge,
    // no conversion-tracker CTA — reply attribution is inbox-sourced).
    // Decided from the STEPS, not a goal test: the reply is terminal only when the chain
    // carries no downstream outcome. See campaign-funnel-steps.test.ts for the funnel case,
    // where a reply is a MID-chain signal above its own Sales Meetings pair.
    expect(cards).toContain(
      'const isPositiveReplies = hasStep("positive_replies") && outcomeStep === null;',
    );
    expect(cards).toContain("{showFunnelMetrics && showVisitPair && (");
    expect(cards).toContain('label: "Positive Replies"');
    expect(cards).toContain('costLabel: "Cost per positive reply"');
    expect(cards).toContain("formatCount(spend.positiveRepliesCount)");
    // The zero-reply floor now lives in features-service (max(committed net spend, the
    // expected cost from the brand's best model), the same cascade it applies per audience),
    // so the card renders the server field VERBATIM and matches the Strategy page.
    expect(cards).toContain("formatCostCents(spend?.cpprCents)");
    // GA outcome — the reply card carries no beta badge and no setup CTA.
    expect(cards).toContain("showAction: false");
    // CPPR abbreviation is not used as a card label here (full phrase instead).
    expect(cards).not.toContain('costLabel: "CPPR"');
  });

  it("tells the reader a zero-outcome cost is the expected price, not a restatement of Total spent", () => {
    // The old tooltip promised "it shows the committed spend so far (= Total spent)" —
    // which described the client-side floor and put the SAME number under two labels one
    // card apart. features-service now serves the floored figure, so the copy has to say
    // what the reader is actually looking at.
    expect(cards).not.toContain("it shows the committed spend so far (= Total spent)");
    expect(cards).toContain("const EXPECTED_COST_NOTE =");
    expect(cards).toContain(
      "Until the first one lands it shows what it is expected to cost, or your spend so far once that is higher.",
    );
    // ONE constant behind every cost tooltip on the row (website visit, both positive-reply
    // cards, and the goal's outcome card) so they cannot drift into describing two rules.
    expect(cards.match(/EXPECTED_COST_NOTE\}/g) ?? []).toHaveLength(4);
  });

  it("renders the server cost verbatim with no client fallback to total spend", () => {
    // features-service's projection read is deliberately fail-soft: on a blip it returns
    // null, which means "we could not estimate this". The honest render for that is "—".
    // Falling back to the brand's committed spend (the old `costSoFarFloorCents(...)` call
    // here) is what printed "Cost per positive reply $29" directly above "Total spent $29",
    // so re-adding it would reintroduce the bug on the one branch no fixture covers.
    expect(cards).not.toContain("costSoFarFloorCents(");
    expect(cards).not.toContain("totalSpentCents");
    expect(cards).toContain("formatCostCents(spend?.cpprCents)");
    // The helper itself stays — the per-audience surfaces still hold a passthrough guard.
    const floor = read("../src/lib/cost-so-far-floor.ts");
    expect(floor).toContain("export function costSoFarFloorCents(");
  });

  it("derives the outcome card from the goal-steps single source (no borrowed card for 1-step goals)", () => {
    // The per-goal outcome (Signups / Sales Meetings / Form submissions / Purchases, or
    // NONE for website_visits/positive_replies) comes from the goal-steps single source —
    // the component no longer hardcodes a visit-vs-reply binary that mislabelled the newer
    // goals. `outcomeStepFor` is that source keyed on the campaign's funnel when it states
    // one, and on the goal otherwise.
    expect(cards).toContain("outcomeStepFor");
    expect(cards).toContain("const outcomeStep = outcomeStepFor(goal, funnelKey)");
    expect(cards).not.toContain("isVisitDrivenGoal");
  });

  it("renders the goal's outcome label + cost label from the step (not a hardcoded binary)", () => {
    // The multi-step outcome card sources its label/cost-label from the goal-steps step.
    expect(cards).toContain("label: outcomeStep.label");
    expect(cards).toContain("costLabel: outcome.costLabel");
    // The render reads them off the unified outcome card.
    expect(cards).toContain("label={outcomeCard.label}");
    expect(cards).toContain("label={outcomeCard.costLabel}");
    expect(cards).not.toContain('label: "Sales"');
    expect(cards).not.toContain('costLabel: "CAC"');
  });

  it("binds the Form submissions/CPFS outcome for the form_submissions goal via the goal-steps source", () => {
    // The form_submissions outcome (label + count/cost fields) now lives in the
    // goal-steps single source, not a hardcoded branch in the component. The card
    // renders it through the goal-steps outcome step like every other goal.
    const steps = read("../src/lib/goal-steps.ts");
    expect(steps).toContain('label: "Form submissions"');
    expect(steps).toContain('countField: "formSubmissionsCount"');
    expect(steps).toContain('costField: "cpfsCents"');
    expect(steps).toContain('costLabel: "CPFS"');
  });

  it("renders the REAL server-provided tracker count for the outcome card, not a hardcoded dash", () => {
    // Count/cost come from the features-service /revenue spend block (real, tracker-sourced)
    // via the step's countField/costField, not the old hardcoded value="—".
    expect(cards).toContain("spend?.[outcome.countField]");
    expect(cards).toContain("spend?.[outcome.costField]");
    expect(cards).toContain("outcomeCount != null");
    expect(cards).toContain("value={outcomeCard.countValue}");
    // No projection language on the cost tooltips.
    expect(cards).not.toContain("Coming soon");
  });

  it("formats cost-per metrics adaptively (<$10 keeps cents, ≥$10 whole)", () => {
    expect(cards).toContain("Math.abs(usd) < 10 ? 2 : 0");
    expect(cards).toContain("minimumFractionDigits: decimals");
    expect(cards).toContain("maximumFractionDigits: decimals");
  });

  it("states the brand's money at brand level and leaves the funnel steps to the campaign", () => {
    // A brand sells through SEVERAL sales funnels at once, so a Website-Visits or
    // Sales-Meetings card there names one funnel's step while the row beside it sums
    // every funnel. The brand Overview therefore shows Outreach plus the four money
    // cards; the campaign Overview (one funnel by construction) keeps the step pairs.
    expect(cards).toContain("showEconomics?: boolean");
    expect(cards).toContain("showFunnelMetrics = true");
    expect(cards).toContain("{showEconomics && (");
    expect(cards).toContain("{showFunnelMetrics && showReplyPair && (");
    expect(cards).toContain("{showFunnelMetrics && outcomeCard && (");
    expect(cards).toContain('label="Pipeline revenue"');
    expect(cards).toContain('label="ROI"');
    expect(cards).toContain('label="$ CAC"');
    expect(cards).toContain('label="% CAC"');
    // Every money value is read verbatim off features-service. `$ CAC` reads
    // `costPerAcquisitionUsd` — the field served on the DEFAULT un-lensed read — and
    // NOT the lens-only `costPerConversionUsd`, which is absent on this response and
    // left the card on a dash. It must never be divided out of the other two either.
    expect(cards).toContain("formatRoi(economics?.roiMultiple)");
    expect(cards).toContain("formatUsd(economics?.costPerAcquisitionUsd)");
    expect(cards).not.toContain("formatUsd(economics?.costPerConversionUsd)");
    expect(cards).toContain("formatPct(economics?.costOfAcquisitionPct)");
    expect(cards).toContain("formatUsd(totalPipelineUsd)");
    // The brand page is the one that turns the two modes on.
    expect(page).toContain("showEconomics");
    expect(page).toContain("showFunnelMetrics={false}");
    expect(page).toContain("economics={revenueRevealed ? data?.costEconomics : null}");
  });

  // NOTHING reads the retired brand column any more. The auto variant takes the
  // CAMPAIGN's own funnel when it is on a campaign route, and at brand level renders
  // the money cards with no funnel pair at all — the same split the brand Overview
  // takes, since a brand sells through several funnels at once.
  it("reads no brand goal anywhere, and keys the row on the campaign's funnel", () => {
    expect(auto).not.toContain("salesEconomics");
    expect(auto).not.toContain("optimizationGoal");
    expect(auto).toContain("campaignData?.campaign.funnelKey");
    expect(auto).toContain("funnelKey={funnelKey}");
    expect(auto).toContain("showEconomics={!campaignId}");
    expect(auto).toContain("showFunnelMetrics={!!campaignId}");
    expect(page).not.toContain("optimizationGoal");
    expect(page).not.toContain("getBrandSalesEconomics");
  });
});
