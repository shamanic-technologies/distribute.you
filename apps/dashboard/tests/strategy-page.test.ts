import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  bestModelRow,
  buildAudienceEstimateRows,
  goalForOptimizationGoal,
  grainLabel,
  isFlooredRow,
  modelAvatar,
  objectiveForOptimizationGoal,
  OFFER_LEVERS,
  offerLeverValue,
  outcomeNoun,
} from "../src/lib/strategy-model";
import type {
  WorkflowProjectionGrain,
  WorkflowProjectionGrainBlock,
  WorkflowProjectionLadderRow,
} from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

/** A grain block with the given observed clicks (drives the floor rule). */
function block(observedClicks: number, spentUsd = 100): WorkflowProjectionGrainBlock {
  return {
    evidence: { spentUsd, observedContacted: 10, observedClicks, observedPositiveReplies: 2 },
    unitCosts: { costPerClickUsd: 2, costPerPositiveReplyUsd: 5, costPerContactedUsd: 1 },
    projected: {
      costPerSignupUsd: 40,
      costPerPaidClientUsd: 200,
      costPerMeetingBookedUsd: 50,
      roiMultiple: 6,
      cacPct: 16,
    },
  };
}

/** A ladder row whose `resolved` block sits at `grain`. */
function row(over: {
  slug: string;
  audienceId: string | null;
  grain: WorkflowProjectionGrain;
  observedClicks?: number;
  clickUsd?: number;
  costPerOutcomeUsd?: number | null;
  roiMultiple?: number | null;
  cacPct?: number | null;
}): WorkflowProjectionLadderRow {
  const estimatesByGrain: WorkflowProjectionLadderRow["estimatesByGrain"] = {};
  estimatesByGrain[over.grain] = block(over.observedClicks ?? 5);
  return {
    audienceId: over.audienceId,
    workflow: { workflowDynastySlug: over.slug, workflowDynastyName: "Pelican" },
    estimatesByGrain,
    resolved: {
      grain: over.grain,
      costPerClickUsd: over.clickUsd ?? 2,
      costPerOutcomeUsd: over.costPerOutcomeUsd ?? 40,
      costPerPaidClientUsd: 200,
      costPerMeetingBookedUsd: 50,
      roiMultiple: over.roiMultiple ?? 6,
      cacPct: over.cacPct ?? 16,
    },
  };
}

describe("strategy goal mapping", () => {
  it("maps the saved objective onto the projection goal enum", () => {
    expect(goalForOptimizationGoal("signups")).toBe("signup");
    expect(goalForOptimizationGoal("sales_meetings")).toBe("meetingBooked");
  });
  it("maps the saved objective onto the projection objective", () => {
    expect(objectiveForOptimizationGoal("signups")).toBe("self-serve");
    expect(objectiveForOptimizationGoal("sales_meetings")).toBe("meeting-booked");
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

describe("grainLabel — honest source of a resolved number", () => {
  it("labels each grain", () => {
    expect(grainLabel("crossOrg")).toBe("fleet benchmark");
    expect(grainLabel("brand")).toBe("this brand");
    expect(grainLabel("audience")).toBe("this audience");
  });
});

describe("isFlooredRow — zero-outcome floor detection", () => {
  it("is floored when the resolved grain observed 0 clicks", () => {
    expect(isFlooredRow(row({ slug: "best", audienceId: null, grain: "brand", observedClicks: 0 }))).toBe(true);
  });
  it("is not floored when the resolved grain has clicks", () => {
    expect(isFlooredRow(row({ slug: "best", audienceId: null, grain: "brand", observedClicks: 5 }))).toBe(false);
  });
});

describe("bestModelRow — the recommended workflow's brand-level row", () => {
  const rows = [
    row({ slug: "best", audienceId: null, grain: "brand" }),
    row({ slug: "best", audienceId: "a1", grain: "audience" }),
    row({ slug: "other", audienceId: null, grain: "crossOrg" }),
  ];
  it("returns the audienceId-null row of the recommended workflow", () => {
    const b = bestModelRow(rows, "best");
    expect(b?.audienceId).toBeNull();
    expect(b?.workflow.workflowDynastySlug).toBe("best");
  });
  it("is null when there is no recommended pick", () => {
    expect(bestModelRow(rows, null)).toBeNull();
  });
});

describe("buildAudienceEstimateRows — reads resolved verbatim, no client math", () => {
  it("uses an audience's OWN row + reads CPC/CPS/ROI/CAC verbatim", () => {
    const rows = [
      row({ slug: "best", audienceId: "a1", grain: "audience", clickUsd: 4, costPerOutcomeUsd: 40, roiMultiple: 6, cacPct: 8 }),
    ];
    const out = buildAudienceEstimateRows([{ id: "a1", name: "Founders" }], rows, "best");
    expect(out[0]).toMatchObject({
      grain: "audience",
      floored: false,
      clickUsd: 4,
      costPerOutcomeUsd: 40,
      roiMultiple: 6,
      cacPct: 8,
    });
  });

  it("falls back to the brand-level row for an audience with no own row", () => {
    const rows = [
      row({ slug: "best", audienceId: null, grain: "brand", clickUsd: 3, costPerOutcomeUsd: 55, roiMultiple: 5, cacPct: 20 }),
      row({ slug: "best", audienceId: "a1", grain: "audience" }),
    ];
    const out = buildAudienceEstimateRows(
      [
        { id: "a1", name: "Founders" },
        { id: "a2", name: "Marketers" },
      ],
      rows,
      "best",
    );
    expect(out.find((r) => r.id === "a1")?.grain).toBe("audience");
    expect(out.find((r) => r.id === "a2")).toMatchObject({
      grain: "brand",
      costPerOutcomeUsd: 55,
      roiMultiple: 5,
    });
  });

  it("propagates the zero-click floor flag from the resolved grain", () => {
    const rows = [row({ slug: "best", audienceId: "a1", grain: "audience", observedClicks: 0 })];
    const out = buildAudienceEstimateRows([{ id: "a1", name: "Founders" }], rows, "best");
    expect(out[0].floored).toBe(true);
  });

  it("emits nulls (never a synthesized 0) when no row covers an audience", () => {
    const out = buildAudienceEstimateRows([{ id: "a1", name: "Founders" }], [], "best");
    expect(out[0]).toMatchObject({
      clickUsd: null,
      costPerOutcomeUsd: null,
      roiMultiple: null,
      cacPct: null,
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

  it("is GA — no beta gate", () => {
    expect(page).not.toContain("useIsBetaUser");
    expect(page).not.toContain("if (!isBeta) return <NotAvailable />");
    expect(page).not.toContain('<MaturityBadge level="beta" />');
  });
  it("reads the best model + resolved grain from the workflow-projection ladder", () => {
    expect(page).toContain("getWorkflowProjectionLadder");
    expect(page).toContain("recommendedWorkflowDynastySlug");
    expect(page).toContain("bestModelRow");
    expect(page).toContain("resolved");
  });
  it("no longer reads the removed /candidates endpoint or client rescale helpers", () => {
    expect(page).not.toContain("fetchFeatureCandidates");
    expect(page).not.toContain("selectBestModelEvidence");
    expect(page).not.toContain("buildAudienceMetricRows");
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
    expect(page).not.toContain("Edit your offer in Brand Profile");
  });
  it("lists every active audience (not only ones with evidence) in the best model", () => {
    expect(page).toContain("activeAudiences");
    expect(page).toContain("audienceRows");
  });
  it("labels the best-model economics by the resolved grain (not a false 'this brand' claim)", () => {
    expect(page).toContain("grainLabel");
    expect(page).toContain("Based on ${bestGrainLabel}");
    expect(page).toContain("resolved.costPerClickUsd");
    expect(page).toContain("resolved.costPerPaidClientUsd");
    expect(page).toContain("resolved.cacPct");
    // the old misleading fixed "this brand" label is gone
    expect(page).not.toContain("This brand cost / click");
  });
  it("renders the zero-outcome floor as '>$X'", () => {
    expect(page).toContain("isFlooredRow");
    expect(page).toContain("bestFloored");
    expect(page).toContain("a.floored");
    expect(page).toContain("`>${amount}`");
  });
  it("renders the per-audience metric table with expansion-first CPC/CPS/ROI/CAC tooltips", () => {
    expect(page).toContain("buildAudienceEstimateRows");
    expect(page).toContain("MetricLabel");
    expect(page).toContain('text="CPC"');
    expect(page).toContain('text="CAC"');
    expect(page).toContain('text="ROI"');
    expect(page).toContain("formatRoi");
    // CAC is rendered as a % (cost-to-win ÷ lifetime revenue), not a $ amount
    expect(page).toContain("formatPct(a.cacPct)");
    // tooltips spell out the abbreviation first
    expect(page).toContain("Cost per click -");
    expect(page).toContain("Customer acquisition cost -");
    expect(page).toContain("Return on investment -");
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
  it("is wired as a GA revenue-feature brand-level item", () => {
    expect(sidebar).toContain('id: "strategy"');
    expect(sidebar).not.toContain("revenueOk && isBeta");
  });
  it("has a route page", () => {
    const route = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/strategy/page.tsx",
    );
    expect(route).toContain("StrategyPage");
  });
});
