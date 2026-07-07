import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  goalForOptimizationGoal,
  isRowFloored,
  modelAvatar,
  objectiveForOptimizationGoal,
  OFFER_LEVERS,
  offerLeverValue,
  outcomeNoun,
  pickAudienceRow,
  pickBrandRow,
  WORKFLOW_GRAIN_LABEL,
} from "../src/lib/strategy-model";
import type { WorkflowProjectionGrain, WorkflowProjectionRow } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

/** Build a workflow-projection ladder row. The single grain block is placed at the
 *  resolved grain so `isRowFloored` reads the right evidence. */
function row(over: {
  workflowDynastySlug: string;
  audienceId: string | null;
  grain: WorkflowProjectionGrain;
  observedClicks?: number;
  costPerClickUsd?: number;
  costPerOutcomeUsd?: number | null;
  costPerPaidClientUsd?: number | null;
  roiMultiple?: number | null;
  cacPct?: number | null;
}): WorkflowProjectionRow {
  const block = {
    evidence: {
      spentUsd: 100,
      observedContacted: 10,
      observedClicks: over.observedClicks ?? 5,
      observedPositiveReplies: 2,
    },
    unitCosts: {
      costPerClickUsd: over.costPerClickUsd ?? 2,
      costPerPositiveReplyUsd: 10,
      costPerContactedUsd: 1,
    },
    projected: {
      costPerSignupUsd: over.costPerOutcomeUsd ?? 40,
      costPerPaidClientUsd: over.costPerPaidClientUsd ?? 200,
      costPerMeetingBookedUsd: 30,
      roiMultiple: over.roiMultiple ?? 6,
      cacPct: over.cacPct ?? 8,
    },
  };
  return {
    audienceId: over.audienceId,
    workflow: { workflowDynastySlug: over.workflowDynastySlug, workflowDynastyName: "Pelican" },
    estimatesByGrain: { [over.grain]: block },
    resolved: {
      grain: over.grain,
      costPerClickUsd: over.costPerClickUsd ?? 2,
      costPerOutcomeUsd: over.costPerOutcomeUsd ?? 40,
      costPerPaidClientUsd: over.costPerPaidClientUsd ?? 200,
      costPerMeetingBookedUsd: 30,
      roiMultiple: over.roiMultiple ?? 6,
      cacPct: over.cacPct ?? 8,
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

describe("WORKFLOW_GRAIN_LABEL — honest population label", () => {
  it("labels each grain by the population it came from", () => {
    expect(WORKFLOW_GRAIN_LABEL.crossOrg).toBe("fleet benchmark");
    expect(WORKFLOW_GRAIN_LABEL.brand).toBe("this brand");
    expect(WORKFLOW_GRAIN_LABEL.audience).toBe("this audience");
  });
});

describe("pickBrandRow — the workflow's brand-level (audienceId null) row", () => {
  const rows: WorkflowProjectionRow[] = [
    row({ workflowDynastySlug: "best", audienceId: null, grain: "brand", costPerClickUsd: 3 }),
    row({ workflowDynastySlug: "best", audienceId: "a1", grain: "audience", costPerClickUsd: 4 }),
    row({ workflowDynastySlug: "other", audienceId: null, grain: "crossOrg", costPerClickUsd: 9 }),
  ];

  it("returns the audienceId-null row for the given workflow", () => {
    const r = pickBrandRow(rows, "best");
    expect(r?.audienceId).toBeNull();
    expect(r?.resolved.costPerClickUsd).toBe(3);
  });
  it("ignores other workflows' rows", () => {
    expect(pickBrandRow(rows, "best")?.workflow.workflowDynastySlug).toBe("best");
  });
  it("is null when there is no best pick", () => {
    expect(pickBrandRow(rows, null)).toBeNull();
  });
});

describe("pickAudienceRow — the workflow's per-audience row (server-resolved grain)", () => {
  const rows: WorkflowProjectionRow[] = [
    row({ workflowDynastySlug: "best", audienceId: null, grain: "brand" }),
    row({ workflowDynastySlug: "best", audienceId: "a1", grain: "audience", costPerOutcomeUsd: 40 }),
    row({ workflowDynastySlug: "best", audienceId: "a2", grain: "brand", costPerOutcomeUsd: 55 }),
  ];

  it("returns the matching audience's row + reads resolved verbatim", () => {
    const r = pickAudienceRow(rows, "best", "a1");
    expect(r?.audienceId).toBe("a1");
    expect(r?.resolved.grain).toBe("audience");
    expect(r?.resolved.costPerOutcomeUsd).toBe(40);
  });
  it("returns a fallback-grain row when the audience has no own evidence (server-resolved)", () => {
    const r = pickAudienceRow(rows, "best", "a2");
    expect(r?.resolved.grain).toBe("brand");
    expect(r?.resolved.costPerOutcomeUsd).toBe(55);
  });
  it("is null for an audience with no row", () => {
    expect(pickAudienceRow(rows, "best", "missing")).toBeNull();
  });
});

describe("isRowFloored — 0 observed clicks ⇒ the cost is a floor", () => {
  it("is true when the resolved grain observed zero clicks", () => {
    const r = row({ workflowDynastySlug: "best", audienceId: null, grain: "crossOrg", observedClicks: 0 });
    expect(isRowFloored(r)).toBe(true);
  });
  it("is false when the resolved grain has observed clicks", () => {
    const r = row({ workflowDynastySlug: "best", audienceId: null, grain: "brand", observedClicks: 5 });
    expect(isRowFloored(r)).toBe(false);
  });
  it("is false for a null row", () => {
    expect(isRowFloored(null)).toBe(false);
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
  it("reads the best model + per-audience estimates from the one workflow-projection ladder", () => {
    expect(page).toContain("getWorkflowProjectionLadder");
    expect(page).toContain("recommendedWorkflowDynastySlug");
    expect(page).toContain("pickBrandRow");
    expect(page).toContain("pickAudienceRow");
    // the old two-endpoint + client-side grain ladder is gone
    expect(page).not.toContain("fetchFeatureCandidates");
    expect(page).not.toContain("selectBestModelEvidence");
    expect(page).not.toContain("buildAudienceMetricRows");
  });
  it("reads costs VERBATIM from the server-resolved grain (no client CPC/projection math)", () => {
    expect(page).toContain("resolved.costPerClickUsd");
    expect(page).toContain("resolved.costPerOutcomeUsd");
    expect(page).toContain("resolved.costPerPaidClientUsd");
    expect(page).toContain("formatPct(resolved.cacPct)");
    // no rescale of a brand projection by an audience CPC
    expect(page).not.toContain("bestWf");
    expect(page).not.toContain("brandCostPerOutcome");
  });
  it("labels the number by its resolved grain, not a fixed 'this brand'", () => {
    expect(page).toContain("WORKFLOW_GRAIN_LABEL");
    expect(page).toContain("Based on ");
    expect(page).not.toContain("This brand cost / click");
  });
  it("renders a >$X floor when the resolved grain saw 0 clicks", () => {
    expect(page).toContain("formatUsdFloor");
    expect(page).toContain("isRowFloored");
    expect(page).toContain("`>${s}`");
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
  it("keeps an Edit link on The plan (→ settings); the offer card is edited INLINE (no blue Edit button)", () => {
    expect(page).toContain("settingsHref");
    expect(page).toContain("action={<EditLink href={settingsHref} />}");
    // the offer card no longer jumps to Brand Profile — each lever is a hover-to-edit
    // zone (TextEditor / ListEditor) and Save forks a new brand-profile version.
    expect(page).not.toContain("action={<EditLink href={brandProfileHref} />}");
    expect(page).not.toContain("Edit your offer in Brand Profile");
    expect(page).toContain("saveBrandProfileVersion");
    expect(page).toContain("TextEditor");
    expect(page).toContain("ListEditor");
  });
  it("lists every active audience (not only ones with evidence) in the best model", () => {
    expect(page).toContain("activeAudiences");
    expect(page).toContain("Estimates by audience");
  });
  it("shows the five served projected-economics boxes for the best model", () => {
    expect(page).toContain("Cost / click");
    expect(page).toContain("Cost / paid client");
    expect(page).toContain("Lifetime revenue on each dollar spent");
    expect(page).toContain("Cost of acquisition");
  });
  it("renders the per-audience metric table with expansion-first CPC/CPS/ROI/CAC tooltips", () => {
    expect(page).toContain("MetricLabel");
    expect(page).toContain('text="CPC"');
    expect(page).toContain('text="CAC"');
    expect(page).toContain('text="ROI"');
    expect(page).toContain("formatRoi");
    // CAC is rendered as a % (cost-to-win ÷ lifetime revenue), not a $ amount
    expect(page).toContain("formatPct(r?.cacPct)");
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
