/**
 * The campaign Workflows table's model — real unit tests, because
 * `lib/campaign-workflow-rows.ts` is alias-free (its only imports are types, erased
 * at build). Keep it that way: a runtime `@/…` import there turns these into
 * resolution failures.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  buildCampaignWorkflowRows,
  buildFleetWorkflowRows,
  collapseWorkflowCatalogue,
  runningDynastyFor,
  sectionCampaignWorkflowRows,
  fleetComparison,
  type CampaignWorkflowRow,
  type FleetWorkflowCost,
  type WorkflowCatalogueRow,
  type WorkflowRevenueGroup,
} from "../src/lib/campaign-workflow-rows";

const LEARNING_BAR = 10;
const isLearning = (n: number | null | undefined) =>
  typeof n !== "number" || n < LEARNING_BAR;

function cat(over: Partial<WorkflowCatalogueRow> = {}): WorkflowCatalogueRow {
  return {
    workflowSlug: "chan-legato",
    workflowDynastySlug: "chan-legato",
    workflowDynastyName: "Legato",
    version: 1,
    status: "active",
    channel: "email",
    audienceType: "cold-outreach",
    contentModel: "flash-pro",
    contentPromptType: "blind-discovery-email-v26",
    ...over,
  };
}

function grp(over: Partial<WorkflowRevenueGroup> = {}): WorkflowRevenueGroup {
  return {
    workflowDynastySlug: "chan-legato",
    workflowDynastyName: "Legato",
    workflowSlugs: ["chan-legato", "chan-legato-v2"],
    totalPipelineUsd: 100,
    committedCostUsd: 25,
    roiMultiple: 4,
    costOfAcquisitionPct: 25,
    recipientsContacted: 383,
    recipientsClicked: 11,
    recipientsRepliesPositive: 12,
    cpprCents: 200,
    cpcCents: 100,
    ...over,
  };
}

describe("collapseWorkflowCatalogue", () => {
  it("keeps one entry per dynasty — the newest version", () => {
    const out = collapseWorkflowCatalogue([
      cat({ workflowSlug: "chan-legato", version: 1 }),
      cat({ workflowSlug: "chan-legato-v2", version: 2, workflowDynastyName: "Legato" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].version).toBe(2);
    expect(out[0].workflowSlug).toBe("chan-legato-v2");
  });

  it("drops a superseded version rather than letting it name the dynasty", () => {
    const out = collapseWorkflowCatalogue([
      cat({ workflowSlug: "chan-legato-v2", version: 2, status: "deprecated" }),
      cat({ workflowSlug: "chan-legato", version: 1 }),
    ]);
    expect(out.map((w) => w.workflowSlug)).toEqual(["chan-legato"]);
  });
});

describe("runningDynastyFor", () => {
  it("resolves the campaign's VERSIONED slug through the catalogue", () => {
    expect(
      runningDynastyFor("chan-legato-v2", [cat({ workflowSlug: "chan-legato-v2", version: 2 })], []),
    ).toBe("chan-legato");
  });

  it("resolves it through a GROUP when the catalogue no longer offers the workflow", () => {
    // The gateway asks workflow-service for the EXECUTABLE set, so a retired lineage
    // the campaign is somehow still on is absent from the catalogue entirely.
    expect(runningDynastyFor("chan-legato-v2", [], [grp()])).toBe("chan-legato");
  });

  it("states NO running workflow when neither source names the slug", () => {
    // Framing the wrong row as live is worse than framing none.
    expect(runningDynastyFor("chan-unknown", [cat()], [grp()])).toBeNull();
  });

  it("states none for a campaign that names no workflow", () => {
    expect(runningDynastyFor(null, [cat()], [grp()])).toBeNull();
    expect(runningDynastyFor("   ", [cat()], [grp()])).toBeNull();
  });
});

describe("buildCampaignWorkflowRows", () => {
  it("is keyed on the CATALOGUE — an offered-never-run workflow keeps its row", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [cat({ workflowDynastySlug: "chan-offered", workflowSlug: "chan-offered", workflowDynastyName: "Offered" })],
      groups: [grp({ workflowDynastySlug: "chan-retired", workflowDynastyName: "Retired" })],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows.map((r) => r.workflowDynastySlug)).toEqual(["chan-offered"]);
  });

  it("DROPS a group with no catalogue entry — a retired workflow is not an option", () => {
    // It used to render as a `Retired` row. A customer picking what to run next has
    // no use for a lineage nobody can put them on, and its money is still in the
    // cards above the table.
    const rows = buildCampaignWorkflowRows({
      catalogue: [],
      groups: [grp()],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows).toEqual([]);
  });

  it("gives a workflow this campaign never ran NULL figures, never zeros", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups: [],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows[0].cpprCents).toBeNull();
    expect(rows[0].committedCostUsd).toBeNull();
    expect(rows[0].outreach).toBeNull();
    expect(rows[0].positiveReplies).toBeNull();
    // No group means nothing to be thin — it has no price at all, which the null says.
    expect(rows[0].learning).toBe(false);
  });

  it("states LEARNING under the bar and not at or above it", () => {
    const thin = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups: [grp({ recipientsRepliesPositive: 9 })],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(thin[0].learning).toBe(true);
    const measured = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups: [grp({ recipientsRepliesPositive: 10 })],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(measured[0].learning).toBe(false);
  });

  it("falls back to the slug when the catalogue names no dynasty", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [cat({ workflowDynastyName: "" })],
      groups: [grp({ workflowDynastyName: null })],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows[0].workflowDynastyName).toBe("chan-legato");
  });
});

describe("fleetComparison", () => {
  const fleet: FleetWorkflowCost[] = [
    { workflowDynastySlug: "a", workflowDynastyName: "A", spentUsd: 10, costPerOutcomeUsd: 100, observedPositiveReplies: 1, observedClicks: 1 },
    { workflowDynastySlug: "b", workflowDynastyName: "B", spentUsd: 10, costPerOutcomeUsd: 300, observedPositiveReplies: 1, observedClicks: 1 },
    { workflowDynastySlug: "c", workflowDynastyName: "C", spentUsd: 10, costPerOutcomeUsd: 200, observedPositiveReplies: 1, observedClicks: 1 },
  ];

  it("takes the MEDIAN, never the mean — one absurd rate must not move it", () => {
    const skewed = [...fleet, { workflowDynastySlug: "d", workflowDynastyName: "D", spentUsd: 1, costPerOutcomeUsd: 100000, observedPositiveReplies: 0, observedClicks: 0 }];
    expect(fleetComparison("a", skewed).median).toBe(250);
  });

  it("reports this workflow's own rate and the fleet's best", () => {
    const out = fleetComparison("c", fleet);
    expect(out.mine).toBe(200);
    expect(out.best).toBe(100);
    expect(out.median).toBe(200);
  });

  it("answers NULL rather than zero when the fleet has no priced row", () => {
    const out = fleetComparison("a", [
      { workflowDynastySlug: "a", workflowDynastyName: "A", spentUsd: 0, costPerOutcomeUsd: null, observedPositiveReplies: 0, observedClicks: 0 },
    ]);
    expect(out.mine).toBeNull();
    expect(out.median).toBeNull();
    expect(out.best).toBeNull();
  });

  it("answers NULL for a workflow the fleet does not carry, without inventing one", () => {
    expect(fleetComparison("missing", fleet).mine).toBeNull();
  });
});

describe("sectionCampaignWorkflowRows", () => {
  const row = (over: Partial<CampaignWorkflowRow> = {}): CampaignWorkflowRow => ({
    workflowDynastySlug: "x",
    workflowDynastyName: "X",
    running: false,
    positiveReplies: null,
    cpprCents: null,
    committedCostUsd: null,
    outreach: null,
    websiteClicks: null,
    cpcCents: null,
    roiMultiple: null,
    learning: false,
    channel: "email",
    audienceType: "cold-outreach",
    contentModel: null,
    contentPromptType: null,
    ...over,
  });

  it("puts the RUNNING workflow in its OWN section and nowhere else", () => {
    const out = sectionCampaignWorkflowRows([
      row({ workflowDynastySlug: "live", running: true, positiveReplies: 40, cpprCents: 9000 }),
      row({ workflowDynastySlug: "cheap", positiveReplies: 40, cpprCents: 100 }),
    ]);
    expect(out.running.map((r) => r.workflowDynastySlug)).toEqual(["live"]);
    expect(out.measured.map((r) => r.workflowDynastySlug)).toEqual(["cheap"]);
    expect(out.notMeasured).toEqual([]);
  });

  it("splits MEASURED from NOT MEASURED on the sales-interest COUNT", () => {
    const out = sectionCampaignWorkflowRows([
      row({ workflowDynastySlug: "one", positiveReplies: 1, cpprCents: 500, learning: true }),
      row({ workflowDynastySlug: "none", positiveReplies: 0, learning: true }),
      row({ workflowDynastySlug: "never" }),
    ]);
    expect(out.measured.map((r) => r.workflowDynastySlug)).toEqual(["one"]);
    expect(out.notMeasured.map((r) => r.workflowDynastySlug)).toEqual(["none", "never"]);
  });

  it("ranks MEASURED cheapest-first, and sinks a row whose price is withheld", () => {
    const out = sectionCampaignWorkflowRows([
      row({ workflowDynastySlug: "dear", positiveReplies: 30, cpprCents: 800 }),
      row({ workflowDynastySlug: "cheap", positiveReplies: 30, cpprCents: 100 }),
      // A $0.01 price standing on two interests is deliberately NOT shown, so it must
      // not take the top row either — ordering on a figure the table withholds reads
      // as unordered.
      row({ workflowDynastySlug: "thin", positiveReplies: 2, cpprCents: 1, learning: true }),
    ]);
    expect(out.measured.map((r) => r.workflowDynastySlug)).toEqual(["cheap", "dear", "thin"]);
  });

  it("orders NOT MEASURED by outreach descending, nulls last", () => {
    const out = sectionCampaignWorkflowRows([
      row({ workflowDynastySlug: "never", outreach: null }),
      row({ workflowDynastySlug: "some", positiveReplies: 0, outreach: 40, learning: true }),
      row({ workflowDynastySlug: "many", positiveReplies: 0, outreach: 900, learning: true }),
    ]);
    expect(out.notMeasured.map((r) => r.workflowDynastySlug)).toEqual([
      "many",
      "some",
      "never",
    ]);
  });
});

describe("buildFleetWorkflowRows", () => {
  const catalogue = [
    cat({ workflowDynastySlug: "a", workflowSlug: "a", workflowDynastyName: "A" }),
    cat({ workflowDynastySlug: "b", workflowSlug: "b", workflowDynastyName: "B" }),
  ];
  const fleet: FleetWorkflowCost[] = [
    {
      workflowDynastySlug: "a",
      workflowDynastyName: "A",
      spentUsd: 1234,
      costPerOutcomeUsd: 61.5,
      observedPositiveReplies: 20,
      observedClicks: 7,
    },
    // A dynasty the catalogue no longer offers — RETIRED, so it gets no row here
    // either. The rule is the same at every grain.
    {
      workflowDynastySlug: "gone",
      workflowDynastyName: "Gone",
      spentUsd: 10,
      costPerOutcomeUsd: 1,
      observedPositiveReplies: 99,
      observedClicks: 1,
    },
  ];

  it("joins the two public reads on the dynasty and converts the rate to cents", () => {
    const rows = buildFleetWorkflowRows({
      catalogue,
      fleet,
      outreach: [{ workflowDynastySlug: "a", recipientsContacted: 5000 }],
      campaignWorkflowSlug: "a",
      isLearning,
    });
    const a = rows.find((r) => r.workflowDynastySlug === "a")!;
    expect(a.positiveReplies).toBe(20);
    expect(a.cpprCents).toBe(6150);
    expect(a.committedCostUsd).toBe(1234);
    expect(a.outreach).toBe(5000);
    expect(a.websiteClicks).toBe(7);
    expect(a.running).toBe(true);
    expect(a.learning).toBe(false);
  });

  it("drops a fleet row the catalogue no longer offers", () => {
    const rows = buildFleetWorkflowRows({
      catalogue,
      fleet,
      outreach: [],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows.map((r) => r.workflowDynastySlug)).toEqual(["a", "b"]);
  });

  it("gives a workflow the fleet has no row for NULL figures, never zeros", () => {
    const rows = buildFleetWorkflowRows({
      catalogue,
      fleet,
      outreach: [],
      campaignWorkflowSlug: null,
      isLearning,
    });
    const b = rows.find((r) => r.workflowDynastySlug === "b")!;
    expect(b.positiveReplies).toBeNull();
    expect(b.cpprCents).toBeNull();
    expect(b.committedCostUsd).toBeNull();
    expect(b.outreach).toBeNull();
    expect(b.learning).toBe(false);
  });

  it("invents NO return and NO per-click price from the two figures it has", () => {
    const rows = buildFleetWorkflowRows({
      catalogue,
      fleet,
      outreach: [],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows.every((r) => r.roiMultiple === null && r.cpcCents === null)).toBe(true);
  });
});

/**
 * The module has to stay importable by vitest, which resolves no `@` alias.
 */
describe("the model module stays alias-free", () => {
  it("carries no runtime `@/` import", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/lib/campaign-workflow-rows.ts"),
      "utf-8",
    );
    const runtimeAliasImport = /^import\s+(?!type\b)[^;]*from\s+"@\//m;
    expect(runtimeAliasImport.test(src)).toBe(false);
  });
});
