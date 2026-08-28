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

  it("defaults to NO goal, so a surface that names no funnel shows no steps at all", () => {
    expect(cards).toContain("type { BrandOptimizationGoal }");
    expect(cards).toContain("optimizationGoal?: BrandOptimizationGoal");
    // The old `?? "sales_meetings"` default put one funnel's steps on every surface,
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

  it("hides the click cards and shows the Sales Interests outcome for positive_replies", () => {
    // Single-step reply→paid goal: Website Visits + CPC cards are hidden, and the unified
    // outcome card becomes Sales Interests + Cost per sales interest (GA, no beta badge,
    // no conversion-tracker CTA — reply attribution is inbox-sourced).
    // Decided from the STEPS, not a goal test: the reply is terminal only when the funnel
    // carries no downstream outcome. See campaign-funnel-steps.test.ts for the funnel case,
    // where a reply is a MID-funnel signal above its own Sales Meetings pair.
    expect(cards).toContain(
      'const isPositiveReplies = hasStep("positive_replies") && outcomeStep === null;',
    );
    expect(cards).toContain("{showFunnelMetrics && showVisitPair && (");
    expect(cards).toContain('label: "Sales Interests"');
    expect(cards).toContain('costLabel: "Cost per sales interest"');
    expect(cards).toContain("formatCount(spend.positiveRepliesCount)");
    // The zero-reply floor now lives in features-service (max(committed net spend, the
    // expected cost from the brand's best model), the same cascade it applies per audience),
    // so the card renders the server field VERBATIM and matches the Strategy page.
    expect(cards).toContain("formatCostCents(spend?.cpprCents)");
    // The reply pair is the ONLY outcome pair left, so nothing gates it on a tracker.
    expect(cards).not.toContain("trackerButton");
    expect(cards).not.toContain("showAction");
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
    // cards) so they cannot drift into describing two rules.
    expect(cards.match(/EXPECTED_COST_NOTE\}/g) ?? []).toHaveLength(3);
  });

  it("renders the server cost verbatim with no client fallback to total spend", () => {
    // features-service's projection read is deliberately fail-soft: on a blip it returns
    // null, which means "we could not estimate this". The honest render for that is "—".
    // Falling back to the brand's committed spend (the old `costSoFarFloorCents(...)` call
    // here) is what printed "Cost per sales interest $29" directly above "Total spent $29",
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

  it("states NO outcome pair for a tracker-sourced outcome (Sales Meetings/CPSM and siblings)", () => {
    // Without a live conversion tracker both cards rendered a "set up conversion tracker"
    // CTA in place of their value — a chore wearing the shape of a metric — so the pair is
    // gone at every scope rather than gated. The step's own label/cost-label are no longer
    // read here; the reply pair below is the only outcome pair the row states.
    expect(cards).not.toContain("label: outcomeStep.label");
    expect(cards).not.toContain("costLabel: outcome.costLabel");
    expect(cards).not.toContain("ConversionTrackerButton");
    expect(cards).not.toContain("getBrandConversionToken");
    // The render still reads the surviving (reply) card through the same unified shape.
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

  it("reads no tracker-sourced count or cost off the spend block", () => {
    // The tracker outcome pair is gone, so the component no longer indexes the spend block
    // by the step's countField/costField. The reply card keeps its own named fields.
    expect(cards).not.toContain("spend?.[outcome.countField]");
    expect(cards).not.toContain("spend?.[outcome.costField]");
    expect(cards).not.toContain("outcomeCount");
    expect(cards).toContain("value={outcomeCard.countValue}");
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

  // People and actions are two different counts, so the row states both and each card
  // says which it is. A lead is contacted once and outreached as many times as its
  // sequence has steps; printing one number under one word is what made the two grains
  // read as one broken figure.
  it("states Leads contacted beside Outreaches, and only explains the second when both are on screen", () => {
    expect(cards).toContain("contactedOverride?: number | null;");
    expect(cards).toContain('label="Leads contacted"');
    expect(cards).toContain(
      "Distinct people this campaign reached. Each one is counted once, however many emails they received.",
    );
    // The contacted card renders ONLY when the caller supplies the count — a surface
    // that states one outreach figure keeps the single card exactly as before.
    expect(cards).toContain("{showOutreach && contactedOverride != null && (");
    // ...and the actions card only disambiguates itself when the other one is beside it.
    expect(cards).toContain(
      "A lead can be outreached several times over their lifetime.",
    );
  });

  // The share is SERVED (`funnelSteps.steps[0].conversionFromPreviousPct`). A browser
  // dividing the two counts is the compute-a-stat-in-the-browser bug and would drift
  // from the producer the moment either side changed scope.
  it("renders the sales-interest share as a served subtitle, never a division", () => {
    expect(cards).toContain("signalSharePct?: number | null;");
    expect(cards).toContain("signalSharePct != null ? `${formatSharePct(signalSharePct)} of contacted`");
    // Both sales-interest count cards carry it: the mid-funnel pair AND the 1-step
    // outcome card, or one campaign would state the share and its sibling would not.
    expect(cards.match(/of contacted`/g)?.length).toBe(2);
    expect(cards).toContain("subtitle={outcomeCard.countSubtitle}");
    // No client ratio anywhere on the row.
    expect(cards).not.toContain("positiveRepliesCount / ");
    expect(cards).not.toContain("/ outreach");
  });

  // The prop is only real if the PAGE passes it — a component that handles a flag no
  // caller sends is correct code and an absent feature.
  it("has the campaign Overview pass both counts and the served share", () => {
    const campaign = read("../src/components/campaigns/campaign-overview-page.tsx");
    const call = campaign.slice(
      campaign.indexOf("<OutreachStatCards"),
      campaign.indexOf("<OutreachStatCards") + 600,
    );
    expect(call).toContain("contactedOverride={leadsContacted}");
    expect(call).toContain('outreachLabel="Outreaches"');
    expect(call).toContain("signalSharePct={salesInterestShare}");
    // The contacted base is a SERVED field off the funnel breakdown.
    expect(campaign).toContain("data?.funnelSteps?.contactedRecipients ?? null");
    // The share goes through the ONE helper the Leads page reads too, so the two
    // surfaces cannot state the same percentage two ways.
    expect(campaign).toContain("salesInterestSharePct(data?.funnelSteps)");
    const auto = read("../src/components/revenue/outreach-stat-cards-auto.tsx");
    expect(auto).toContain("salesInterestSharePct(revenueData?.funnelSteps)");
  });

  // NOTHING reads the retired brand column any more. The auto variant takes the
  // CAMPAIGN's own funnel when it is on a campaign route, and at brand level renders
  // the money cards with no funnel pair at all — the same split the brand Overview
  // takes, since a brand sells through several funnels at once.
  it("reads no brand goal anywhere, and keys the row on the campaign's funnel", () => {
    expect(auto).not.toContain("salesEconomics");
    expect(auto).not.toContain("optimizationGoal");
    expect(auto).toContain("scopedCampaign?.funnelKey");
    expect(auto).toContain("funnelKey={funnelKey}");
    expect(auto).toContain("showEconomics={!campaignId}");
    expect(auto).toContain("showFunnelMetrics={!!campaignId}");
    expect(page).not.toContain("optimizationGoal");
    expect(page).not.toContain("getBrandSalesEconomics");
  });
});
