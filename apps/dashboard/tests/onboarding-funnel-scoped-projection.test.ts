import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { funnelDraftFromBrand, salesFunnelByKey } from "../src/lib/sales-funnels";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

const onboarding = read("components/onboarding/onboarding.tsx");
const bestModelCard = read("components/strategy/best-model-card.tsx");
const api = read("lib/api.ts");
const campaignOverview = read("components/campaigns/campaign-overview-page.tsx");
const funnelView = read("lib/onboarding-funnel-view.ts");

/** The slice of a function body, measured from its own signature. */
function sliceFrom(src: string, marker: string, length: number): string {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return src.slice(at, at + length);
}

describe("the projection is priced on the FUNNEL, never on a goal", () => {
  // A goal cannot separate a meeting bought with a positive reply from one bought with a
  // click onto the site: `reply_meeting` and `visit_meeting` both echo `meetingBooked`, so
  // features-service prices a goal-keyed request from BOTH channels at once. Per dollar
  // that buys ~86x more clicks than replies, so the click leg supplies nearly every
  // projected outcome — and the RANKING rides the same number, so the workflow crowned
  // BEST is whichever is cheapest per click. Measured on a conversation-led brand: $26 per
  // meeting and 26.8x return against $283 and 2.1x for the chain it actually sells.
  it("sends ?funnel= and canonicalises it", () => {
    const reader = sliceFrom(api, "export async function getWorkflowProjectionLadder(", 2600);
    expect(reader).toContain('query.set("funnel", canonicalSalesFunnelKey(params.funnel))');
  });

  it("declares funnelKey on the response schema so zod cannot strip it", () => {
    const schema = sliceFrom(api, "const WorkflowProjectionLadderResponseSchema = z.object({", 900);
    expect(schema).toContain("funnelKey:");
  });

  it("onboarding's best-model fetch takes a funnel key and sends no goal or objective", () => {
    const fetcher = sliceFrom(
      onboarding,
      "function fetchBestModelLadder(id: string, funnelKey: string | null)",
      700,
    );
    expect(fetcher).toContain("funnel: funnelKey as SalesFunnelKeyWire");
    expect(fetcher).not.toContain("objective");
    expect(fetcher).not.toContain("optimizationGoalForOutcome");
  });

  it("both prewarms key on the persisted primary funnel, not the outcome", () => {
    expect(onboarding).toContain("void fetchBestModelLadder(prewarmId, pending.primaryFunnelKey)");
    expect(onboarding).not.toContain("fetchBestModelLadder(prewarmId, pending.outcome)");
  });

  it("the campaign overview states its own funnel on the projection read", () => {
    // A campaign runs exactly ONE funnel, so it is the surface that must never ask at
    // goal grain. Same param its audience-stats read already sends.
    const call = sliceFrom(campaignOverview, "getWorkflowProjection({", 700);
    expect(call).toContain("...(campaignFunnelKey ? { funnel: campaignFunnelKey } : {})");
  });
});

describe("BestModelStats renders the funnel's own chain", () => {
  it("takes a funnelKey and gates every tile on the chain's steps", () => {
    expect(bestModelCard).toContain("funnelKey: SalesFunnelKeyWire | null");
    expect(bestModelCard).toContain("const steps = stepsFor(null, funnelKey)");
    expect(bestModelCard).toContain('hasStep("website_visits")');
    expect(bestModelCard).toContain('hasStep("positive_replies")');
  });

  it("carries no goal prop and no goal-keyed branch", () => {
    // `goal === "sales_meetings"` was true of BOTH meeting funnels, which is how a
    // reply -> meeting chain ended up with a "Cost per website visit" tile.
    expect(bestModelCard).not.toContain("goal: BrandOptimizationGoal");
    expect(bestModelCard).not.toContain('goal === "sales_meetings"');
    expect(bestModelCard).not.toContain("isWebsiteVisitsGoal");
    expect(bestModelCard).not.toContain("isPositiveRepliesGoal");
    expect(bestModelCard).not.toContain("outcomeNoun(goal)");
  });

  it("builds its column count from whole class strings", () => {
    // A class assembled at runtime is invisible to the Tailwind compiler, so the column
    // count would silently not apply.
    expect(bestModelCard).not.toContain("lg:grid-cols-${");
    expect(bestModelCard).toContain('"lg:grid-cols-6"');
  });
});

describe("a single path states no rank", () => {
  it("hides the Primary tag on the funnel detail step when there is one path", () => {
    // 1631 chars from the step's own guard to the gate.
    const step = sliceFrom(onboarding, 'if (step === "funnelStats") {', 1800);
    expect(step).toContain("detailFunnels.length > 1 && funnel.key === primaryFunnelKey");
  });

  it("drops the superlative headline and the rank numeral on the model step", () => {
    // The mark sits 3880 chars in.
    const step = sliceFrom(onboarding, 'if (step === "model") {', 4300);
    expect(step).toContain('selectedFunnels.length > 1 ? "Your most profitable path with us."');
    expect(step).toContain("What your path should return.");
    // The numeral is a rank; it only means something beside a second path.
    expect(step).toContain('selectedFunnels.length > 1 ? (');
    expect(step).toContain("<SalesFunnelMark def={salesFunnelByKey(primaryFunnel.key as SalesFunnelKey)}");
  });
});

describe("the funnel detail step prefills what we already know", () => {
  it("seeds each rate through the shared helper, not an empty object", () => {
    // The per-key resolution sits 1719 chars into the function.
    const draft = sliceFrom(onboarding, "function funnelDraft(funnel: FunnelView)", 1900);
    expect(draft).toContain("funnelDraftFromBrand(def, storedEconomics, defaultDestinationUrl).rates");
    // Per key: typed here, then the same key typed on another path, then the brand.
    expect(draft).toContain("typedHere ?? typedOnAnotherPath ?? seeded[rate.key] ?? \"\"");
    expect(draft).not.toContain("rates: own?.rates ?? {}");
  });

  it("keeps the economics in STATE, so a form seeded from them re-seeds when they land", () => {
    // A ref lands with no re-render: the fields would stay blank under copy saying we
    // prefilled them.
    expect(onboarding).toContain("setStoredEconomics(economics)");
    expect(onboarding).toContain("useState<EffectiveSalesEconomics | null>(null)");
  });

  it("marks an optional destination beside its label, and says it once", () => {
    // 4958 chars in: the destinations list is the last block of the step.
    const step = sliceFrom(onboarding, 'if (step === "funnelStats") {', 5400);
    expect(step).toContain("{dest.optional && (");
    expect(step).toContain("Optional");
    // The hint under the input no longer repeats it.
    expect(funnelView).not.toContain('hint: "Optional.');
  });
});

describe("funnelDraftFromBrand seeds from the EFFECTIVE economics shape", () => {
  // Onboarding has only the effective read (it folds cross-brand averages in for a brand
  // that has stated nothing yet), and it carries a SUBSET of the rate columns. Real unit
  // tests: the lib is alias-free apart from type-only imports.
  const effective = {
    lifetimeRevenueUsd: 10_000,
    replyToMeetingPct: 75,
    visitToMeetingPct: 4,
    meetingToClosePct: 10,
    visitToSignupPct: 8,
    signupToPaidClientPct: 16,
    visitToClosePct: 1.3,
  };

  it("fills the reply -> meeting chain's own legs", () => {
    const draft = funnelDraftFromBrand(salesFunnelByKey("reply_meeting"), effective, null);
    expect(draft.rates.replyToMeetingPct).toBe("75");
    expect(draft.rates.meetingToClosePct).toBe("10");
    expect(draft.lifetimeRevenueUsd).toBe("10,000");
  });

  it("leaves the show-up rate blank — nothing in the fleet measures it", () => {
    const draft = funnelDraftFromBrand(salesFunnelByKey("reply_meeting"), effective, null);
    expect(draft.rates.meetingBookedToAttendedPct).toBe("");
  });

  it("seeds a rate the effective read does not carry as blank, never as a zero", () => {
    // form_magnet's legs live only on the full brand economics; a missing rate must read
    // as "we have no figure", not as 0% conversion.
    const draft = funnelDraftFromBrand(salesFunnelByKey("visit_form"), effective, null);
    Object.values(draft.rates).forEach((v) => expect(v === "" || Number(v) > 0).toBe(true));
  });
});
