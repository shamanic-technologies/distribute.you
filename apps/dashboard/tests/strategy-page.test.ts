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
  pickAudienceOrBrandRow,
  pickAudienceRow,
  pickBestBrandRow,
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
  // Explicit `null` must survive (a cold-start / no-economics cost); only `undefined`
  // (the key omitted) falls back to the default.
  const outcome = over.costPerOutcomeUsd === undefined ? 40 : over.costPerOutcomeUsd;
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
      costPerSignupUsd: outcome,
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
      costPerOutcomeUsd: outcome,
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

describe("pickBestBrandRow — cheapest brand-level workflow by resolved.costPerOutcomeUsd", () => {
  it("picks the cheapest brand-level cost-per-outcome, NOT recommendedWorkflowDynastySlug", () => {
    // azalea is the backend-recommended dynasty (its cheap 2-click AUDIENCE leg won the
    // fleet-wide argmin), but its BRAND-level row is 0-click → floored to a bad cost.
    // pelican has real brand clicks → a far cheaper brand-level cost-per-outcome.
    const rows: WorkflowProjectionRow[] = [
      row({ workflowDynastySlug: "azalea", audienceId: null, grain: "crossOrg", observedClicks: 0, costPerClickUsd: 5.58, costPerOutcomeUsd: 3720 }),
      row({ workflowDynastySlug: "azalea", audienceId: "cheap-leg", grain: "audience", observedClicks: 2, costPerClickUsd: 1.1, costPerOutcomeUsd: 50 }),
      row({ workflowDynastySlug: "pelican", audienceId: null, grain: "brand", observedClicks: 30, costPerClickUsd: 2.86, costPerOutcomeUsd: 400 }),
      row({ workflowDynastySlug: "rampart", audienceId: null, grain: "brand", observedClicks: 27, costPerClickUsd: 3.79, costPerOutcomeUsd: 530 }),
    ];
    const best = pickBestBrandRow(rows, "azalea");
    expect(best?.workflow.workflowDynastySlug).toBe("pelican");
    expect(best?.audienceId).toBeNull();
    expect(best?.resolved.costPerClickUsd).toBe(2.86);
    expect(best?.resolved.grain).toBe("brand"); // never a crossOrg-floored row when a real one is cheaper
  });

  it("skips brand rows whose cost-per-outcome is null or <= 0", () => {
    const rows: WorkflowProjectionRow[] = [
      row({ workflowDynastySlug: "coldstart", audienceId: null, grain: "crossOrg", costPerOutcomeUsd: null }),
      row({ workflowDynastySlug: "zero", audienceId: null, grain: "brand", costPerOutcomeUsd: 0 }),
      row({ workflowDynastySlug: "real", audienceId: null, grain: "brand", costPerClickUsd: 4, costPerOutcomeUsd: 600 }),
    ];
    expect(pickBestBrandRow(rows, null)?.workflow.workflowDynastySlug).toBe("real");
  });

  it("falls back to the recommended dynasty's brand row when none rank", () => {
    const rows: WorkflowProjectionRow[] = [
      row({ workflowDynastySlug: "a", audienceId: null, grain: "crossOrg", costPerOutcomeUsd: null }),
      row({ workflowDynastySlug: "b", audienceId: null, grain: "crossOrg", costPerOutcomeUsd: null }),
    ];
    expect(pickBestBrandRow(rows, "b")?.workflow.workflowDynastySlug).toBe("b");
  });

  it("falls back to the first brand row when nothing ranks and no recommended pick", () => {
    const rows: WorkflowProjectionRow[] = [
      row({ workflowDynastySlug: "first", audienceId: null, grain: "crossOrg", costPerOutcomeUsd: null }),
      row({ workflowDynastySlug: "second", audienceId: null, grain: "crossOrg", costPerOutcomeUsd: null }),
    ];
    expect(pickBestBrandRow(rows, null)?.workflow.workflowDynastySlug).toBe("first");
  });

  it("is null when there are no brand-level rows", () => {
    const rows: WorkflowProjectionRow[] = [
      row({ workflowDynastySlug: "x", audienceId: "a1", grain: "audience" }),
    ];
    expect(pickBestBrandRow(rows, "x")).toBeNull();
  });
});

describe("pickAudienceOrBrandRow — per-audience row, brand-level fallback", () => {
  const rows: WorkflowProjectionRow[] = [
    row({ workflowDynastySlug: "best", audienceId: null, grain: "brand", costPerClickUsd: 3 }),
    row({ workflowDynastySlug: "best", audienceId: "ran-it", grain: "audience", costPerClickUsd: 2 }),
  ];
  it("returns the audience's own row when it ran the workflow", () => {
    const r = pickAudienceOrBrandRow(rows, "best", "ran-it");
    expect(r?.audienceId).toBe("ran-it");
    expect(r?.resolved.grain).toBe("audience");
    expect(r?.resolved.costPerClickUsd).toBe(2);
  });
  it("falls back to the workflow's brand-level row when the audience never ran it", () => {
    const r = pickAudienceOrBrandRow(rows, "best", "never-ran");
    expect(r?.audienceId).toBeNull();
    expect(r?.resolved.grain).toBe("brand");
    expect(r?.resolved.costPerClickUsd).toBe(3);
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
    // the headline ranks the BRAND-LEVEL rows itself (cheapest cost-per-outcome); it does
    // NOT crown the workflow off recommendedWorkflowDynastySlug (that argmin spans audience
    // rows) — but still passes it in as the fallback pick.
    expect(page).toContain("recommendedWorkflowDynastySlug");
    expect(page).toContain("pickBestBrandRow");
    expect(page).toContain("pickAudienceOrBrandRow");
    // the old two-endpoint + client-side grain ladder is gone
    expect(page).not.toContain("fetchFeatureCandidates");
    expect(page).not.toContain("selectBestModelEvidence");
    expect(page).not.toContain("buildAudienceMetricRows");
  });
  it("reads costs VERBATIM from the server-resolved grain (no client CPC/projection math)", () => {
    expect(page).toContain("resolved.costPerClickUsd");
    expect(page).toContain("resolved.costPerOutcomeUsd");
    expect(page).toContain("resolved.costPerPaidClientUsd");
    expect(page).toContain("formatPctWhole(resolved.cacPct)");
    // no rescale of a brand projection by an audience CPC
    expect(page).not.toContain("bestWf");
    expect(page).not.toContain("brandCostPerOutcome");
  });
  it("labels the number by its resolved grain, not a fixed 'this brand'", () => {
    expect(page).toContain("WORKFLOW_GRAIN_LABEL");
    expect(page).toContain("Based on ");
    expect(page).not.toContain("This brand cost / click");
  });
  it("renders a plain whole-dollar cost (no '>' prefix) even when the grain saw 0 clicks", () => {
    expect(page).toContain("formatUsdFloor");
    expect(page).toContain("isRowFloored");
    // the ">" floor prefix read as confusing on a not-yet-realized outcome — dropped.
    expect(page).not.toContain("`>${s}`");
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
  it("shows the served projected-economics boxes for the best model", () => {
    // "Cost per website visit" = the click cost; for website_visits it IS the outcome,
    // so the separate "Cost / <noun>" outcome tile is dropped for that goal only.
    expect(page).toContain("Cost per website visit");
    expect(page).toContain("isWebsiteVisitsGoal");
    expect(page).toContain("Cost / paid client");
    expect(page).toContain("Lifetime revenue on each dollar spent");
    expect(page).toContain("Cost of acquisition");
  });
  it("renders the per-audience metric table with expansion-first cost/ROI/CAC tooltips", () => {
    expect(page).toContain("MetricLabel");
    expect(page).toContain('text="Cost per website visit"');
    expect(page).toContain('text="CAC"');
    expect(page).toContain('text="ROI"');
    expect(page).toContain("formatRoi");
    // CAC is rendered as a % (cost-to-win ÷ lifetime revenue), not a $ amount
    expect(page).toContain("formatPctWhole(r?.cacPct)");
    // tooltips spell out the abbreviation first
    expect(page).toContain("Cost per website visit -");
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
