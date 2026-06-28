import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  buildAudienceMetricRows,
  goalForOptimizationGoal,
  modelAvatar,
  objectiveForOptimizationGoal,
  OFFER_LEVERS,
  offerLeverValue,
  outcomeNoun,
  projectionCostKey,
  selectBestModelEvidence,
} from "../src/lib/strategy-model";
import type { FeatureCandidate, FeatureCandidateGrain } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

function candidate(over: Partial<FeatureCandidate> & {
  workflowDynastySlug: string;
  audienceId: string | null;
  costGrain: "goal-global" | "audience";
  costPerOutcomeUsd: number | null;
  grain?: FeatureCandidateGrain;
  clickUsd?: number | null;
  roiMultiple?: number | null;
  costPerCloseUsd?: number | null;
}): FeatureCandidate {
  return {
    audienceId: over.audienceId,
    workflow: { workflowDynastySlug: over.workflowDynastySlug, workflowDynastyName: "Pelican" },
    goal: "meetingBooked",
    grain: over.grain ?? (over.costGrain === "audience" ? "audience" : "goal-global"),
    costPerOutcomeUsd: over.costPerOutcomeUsd,
    costPerCloseUsd: over.costPerCloseUsd,
    roiMultiple: over.roiMultiple,
    conversion: { rate: 0.1, grain: "brand-goal", sampleSize: null },
    cost: {
      costPerLeadUsd: 1,
      clickUsd: over.clickUsd ?? 2,
      replyUsd: 3,
      grain: over.costGrain,
      sampleSize: { runs: 1, contacted: 1, clicks: 1, replies: 1 },
    },
  };
}

describe("strategy goal mapping", () => {
  it("maps the saved objective onto the candidates goal enum", () => {
    expect(goalForOptimizationGoal("signups")).toBe("signup");
    expect(goalForOptimizationGoal("sales_meetings")).toBe("meetingBooked");
  });
  it("maps the saved objective onto the projection objective", () => {
    expect(objectiveForOptimizationGoal("signups")).toBe("self-serve");
    expect(objectiveForOptimizationGoal("sales_meetings")).toBe("meeting-booked");
  });
  it("picks the projection cost field for the objective", () => {
    expect(projectionCostKey("signups")).toBe("costPerSignupUsd");
    expect(projectionCostKey("sales_meetings")).toBe("costPerMeetingBookedUsd");
  });
  it("names the outcome", () => {
    expect(outcomeNoun("signups")).toBe("signup");
    expect(outcomeNoun("sales_meetings")).toBe("meeting");
  });
});

describe("modelAvatar — deterministic placeholder face", () => {
  it("is stable for the same slug", () => {
    expect(modelAvatar("pelican-obsidian")).toEqual(modelAvatar("pelican-obsidian"));
  });
  it("returns an emoji + color", () => {
    const a = modelAvatar("anything");
    expect(typeof a.emoji).toBe("string");
    expect(a.color).toMatch(/^#/);
  });
});

describe("selectBestModelEvidence — groups served rows, never computes", () => {
  const candidates: FeatureCandidate[] = [
    candidate({ workflowDynastySlug: "best", audienceId: null, costGrain: "goal-global", costPerOutcomeUsd: 50 }),
    candidate({ workflowDynastySlug: "best", audienceId: "a1", costGrain: "audience", costPerOutcomeUsd: 40 }),
    candidate({ workflowDynastySlug: "best", audienceId: "a2", costGrain: "audience", costPerOutcomeUsd: 60 }),
    candidate({ workflowDynastySlug: "other", audienceId: "a3", costGrain: "audience", costPerOutcomeUsd: 99 }),
  ];

  it("returns the cross-org row for the best workflow", () => {
    const e = selectBestModelEvidence(candidates, "best");
    expect(e.crossOrg?.costPerOutcomeUsd).toBe(50);
  });
  it("returns only the best workflow's per-audience rows", () => {
    const e = selectBestModelEvidence(candidates, "best");
    expect(e.audiences.map((c) => c.audienceId).sort()).toEqual(["a1", "a2"]);
  });
  it("is empty when there is no best pick", () => {
    const e = selectBestModelEvidence(candidates, null);
    expect(e.crossOrg).toBeNull();
    expect(e.fallback).toBeNull();
    expect(e.audiences).toEqual([]);
  });
  it("returns the audienceId-null fallback row (any coarse grain)", () => {
    const brandFallback = candidate({
      workflowDynastySlug: "b2",
      audienceId: null,
      costGrain: "goal-global",
      grain: "brand-goal",
      costPerOutcomeUsd: 55,
    });
    const e = selectBestModelEvidence([brandFallback], "b2");
    // fallback keys on audienceId-null (any coarse grain); summary grain = brand-goal
    expect(e.fallback?.grain).toBe("brand-goal");
  });
});

describe("buildAudienceMetricRows — audience → brand-average → cross-org ladder", () => {
  const ownA1 = candidate({
    workflowDynastySlug: "best",
    audienceId: "a1",
    costGrain: "audience",
    grain: "audience",
    costPerOutcomeUsd: 40,
    clickUsd: 4,
    roiMultiple: 6,
    costPerCloseUsd: 200,
  });

  it("uses an audience's OWN row + reads CPC/CPS/ROI/CAC verbatim", () => {
    const evidence = selectBestModelEvidence([ownA1], "best");
    const rows = buildAudienceMetricRows([{ id: "a1", name: "Founders" }], evidence);
    expect(rows[0]).toMatchObject({
      provenance: "own",
      clickUsd: 4,
      costPerOutcomeUsd: 40,
      roiMultiple: 6,
      costPerCloseUsd: 200,
    });
  });

  it("falls back to BRAND average (grain=brand-goal) for an audience with no own row", () => {
    const brandFb = candidate({
      workflowDynastySlug: "best",
      audienceId: null,
      costGrain: "goal-global",
      grain: "brand-goal",
      costPerOutcomeUsd: 55,
      roiMultiple: 5,
      costPerCloseUsd: 220,
    });
    const evidence = selectBestModelEvidence([ownA1, brandFb], "best");
    const rows = buildAudienceMetricRows(
      [
        { id: "a1", name: "Founders" },
        { id: "a2", name: "Marketers" },
      ],
      evidence,
    );
    expect(rows.find((r) => r.id === "a1")?.provenance).toBe("own");
    expect(rows.find((r) => r.id === "a2")).toMatchObject({
      provenance: "brand",
      costPerOutcomeUsd: 55,
      roiMultiple: 5,
      costPerCloseUsd: 220,
    });
  });

  it("falls back to CROSS-ORG (grain=goal-global) when there is no brand average", () => {
    const crossFb = candidate({
      workflowDynastySlug: "best",
      audienceId: null,
      costGrain: "goal-global",
      grain: "goal-global",
      costPerOutcomeUsd: 70,
    });
    const evidence = selectBestModelEvidence([crossFb], "best");
    const rows = buildAudienceMetricRows([{ id: "a9", name: "New" }], evidence);
    expect(rows[0]?.provenance).toBe("crossOrg");
    expect(rows[0]?.costPerOutcomeUsd).toBe(70);
  });

  it("emits nulls (never a synthesized 0) when no candidate covers an audience", () => {
    const evidence = selectBestModelEvidence([], "best");
    const rows = buildAudienceMetricRows([{ id: "a1", name: "Founders" }], evidence);
    expect(rows[0]).toMatchObject({
      clickUsd: null,
      costPerOutcomeUsd: null,
      roiMultiple: null,
      costPerCloseUsd: null,
    });
  });
});

describe("offerLeverValue — normalises brand-profile fields, drops Unknown", () => {
  const fields = {
    services: ["A", "B"],
    valueProposition: "Get a strategy in 8 minutes",
    socialProof: ["Unknown"],
    urgency: "  ",
  };
  it("returns a string as a one-line list", () => {
    expect(offerLeverValue(fields, "valueProposition")).toEqual(["Get a strategy in 8 minutes"]);
  });
  it("returns an array as multiple lines", () => {
    expect(offerLeverValue(fields, "services")).toEqual(["A", "B"]);
  });
  it("treats Unknown / blank / missing as not set", () => {
    expect(offerLeverValue(fields, "socialProof")).toEqual([]);
    expect(offerLeverValue(fields, "urgency")).toEqual([]);
    expect(offerLeverValue(fields, "scarcity")).toEqual([]);
    expect(offerLeverValue(null, "services")).toEqual([]);
  });
});

describe("OFFER_LEVERS — the seven value-equation levers", () => {
  it("covers the Hormozi levers in order", () => {
    expect(OFFER_LEVERS.map((l) => l.key)).toEqual([
      "services",
      "valueProposition",
      "perceivedLikelihood",
      "socialProof",
      "riskReversal",
      "urgency",
      "scarcity",
    ]);
  });
});

describe("brand-profile field set carries the new levers", () => {
  const fieldEditor = read("../src/components/brand-profile/field-editor.tsx");
  it("adds services + perceivedLikelihood (linked to Brand Profile)", () => {
    expect(fieldEditor).toContain('key: "services"');
    expect(fieldEditor).toContain('key: "perceivedLikelihood"');
  });
});

describe("StrategyPage source guards", () => {
  const page = read("../src/components/strategy/strategy-page.tsx");

  it("is beta-gated on the email allowlist", () => {
    expect(page).toContain("useIsBetaUser");
    expect(page).toContain("if (!isBeta) return <NotAvailable />");
  });
  it("carries a beta MaturityBadge", () => {
    expect(page).toContain('<MaturityBadge level="beta" />');
  });
  it("reads the best model + 3-level cost per outcome from served endpoints", () => {
    expect(page).toContain("getWorkflowProjection");
    expect(page).toContain("fetchFeatureCandidates");
    expect(page).toContain("recommendedWorkflowDynastySlug");
    expect(page).toContain("selectBestModelEvidence");
  });
  it("surfaces the agency-domain framing", () => {
    expect(page).toContain("on your behalf");
    expect(page).toContain("warmed sending domains");
  });
  it("offers example emails + the reassessment explainer", () => {
    expect(page).toContain("listWorkflowExamples");
    expect(page).toContain("How we pick the best model");
  });
  it("shows the offer (Hormozi) section read from Brand Profile", () => {
    expect(page).toContain("getBrandProfile");
    expect(page).toContain("OFFER_LEVERS");
    expect(page).toContain("What we use to optimize your conversion");
    expect(page).toContain("Alex Hormozi value equation");
  });
  it("puts an Edit link top-right of The plan (→ settings) and the offer card (→ brand profile)", () => {
    expect(page).toContain("settingsHref");
    expect(page).toContain("action={<EditLink href={settingsHref} />}");
    expect(page).toContain("action={<EditLink href={brandProfileHref} />}");
    // the old bottom button was moved to the header Edit link
    expect(page).not.toContain("Edit your offer in Brand Profile");
  });
  it("lists every active audience (not only ones with evidence) in the best model", () => {
    expect(page).toContain("activeAudiences");
    expect(page).toContain("audienceRows");
  });
  it("shows the four served projected-economics boxes for this brand", () => {
    expect(page).toContain("This brand cost / click");
    expect(page).toContain("bestWf.clickUsd");
    expect(page).toContain("Projected lifetime revenue on each dollar spent");
    expect(page).toContain("Projected cost of acquisition");
    expect(page).toContain("bestWf.projection?.cacPct");
  });
  it("renders the per-audience metric table with CPC/CPS/ROI/CAC tooltips", () => {
    expect(page).toContain("buildAudienceMetricRows");
    expect(page).toContain("MetricLabel");
    expect(page).toContain('text="CPC"');
    expect(page).toContain('text="CAC"');
    expect(page).toContain('text="ROI"');
    expect(page).toContain("formatRoi");
    // the confusing single-value label is gone
    expect(page).not.toContain("starting estimate");
  });
  it("shows full example emails with follow-ups", () => {
    expect(page).toContain("ExampleEmailCard");
    expect(page).toContain("Follow-up");
    expect(page).toContain("EmailSignature");
  });
});

describe("Strategy nav entry", () => {
  const sidebar = read("../src/components/context-sidebar.tsx");
  it("is wired as a beta-gated brand-level item", () => {
    expect(sidebar).toContain('id: "strategy"');
    expect(sidebar).toContain("revenueOk && isBeta");
    expect(sidebar).toContain('maturity: "beta"');
  });
  it("has a route page", () => {
    const route = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/strategy/page.tsx",
    );
    expect(route).toContain("StrategyPage");
  });
});
