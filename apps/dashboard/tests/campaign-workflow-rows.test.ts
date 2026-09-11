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
  workflowOutcomeCostCents,
  workflowOutcomeCount,
  workflowOutcomePairFor,
  buildFleetWorkflowRows,
  collapseWorkflowCatalogue,
  runningDynastyFor,
  resolveRunningWorkflow,
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

function row(over: Partial<CampaignWorkflowRow> = {}): CampaignWorkflowRow {
  return {
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
    outcomePair: "reply",
    learning: false,
    channel: "email",
    audienceType: "cold-outreach",
    contentModel: null,
    contentPromptType: null,
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
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
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
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
      isLearning,
    });
    expect(rows).toEqual([]);
  });

  it("gives a workflow this campaign never ran NULL figures, never zeros", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups: [],
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
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
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
      isLearning,
    });
    expect(thin[0].learning).toBe(true);
    const measured = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups: [grp({ recipientsRepliesPositive: 10 })],
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
      isLearning,
    });
    expect(measured[0].learning).toBe(false);
  });

  it("falls back to the slug when the catalogue names no dynasty", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [cat({ workflowDynastyName: "" })],
      groups: [grp({ workflowDynastyName: null })],
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
      isLearning,
    });
    expect(rows[0].workflowDynastyName).toBe("chan-legato");
  });
});

describe("the running workflow is resolved ONCE, for every grain", () => {
  // campaign-service states a VERSIONED slug and the catalogue carries only each
  // dynasty's CURRENT version, so an older pin is nameable only by a group's folded
  // `workflowSlugs`. Measured in prod 2026-09-11: 30 of 30 versioned cold-email
  // campaign slugs match no current catalogue entry.
  const cur = cat({ workflowSlug: "chan-legato-v9", workflowDynastySlug: "chan-legato", version: 9 });
  const group = grp({ workflowDynastySlug: "chan-legato", workflowSlugs: ["chan-legato-v2"] });

  it("names the dynasty from a group when the catalogue only carries a newer version", () => {
    expect(resolveRunningWorkflow("chan-legato-v2", [cur], [[group]])).toEqual({
      dynastySlug: "chan-legato",
      dynastyName: "Legato",
    });
  });

  it("answers the SAME at the global grain, which holds no groups of its own", () => {
    // The regression: resolving per grain returned null here, so `Running now` vanished
    // on the Global tab alone while the other three rendered it.
    const resolved = resolveRunningWorkflow("chan-legato-v2", [cur], [[group]]);
    const rows = buildFleetWorkflowRows({
      catalogue: [cur],
      fleet: [],
      outreach: [],
      running: resolved,
      pair: "reply",
      isLearning,
    });
    expect(rows.filter((r) => r.running).map((r) => r.workflowDynastySlug)).toEqual([
      "chan-legato",
    ]);
  });

  it("states NO running workflow when no source names the version", () => {
    expect(resolveRunningWorkflow("chan-unknown-v3", [cur], [[group]])).toEqual({
      dynastySlug: null,
      dynastyName: null,
    });
    expect(resolveRunningWorkflow(null, [cur], [[group]]).dynastySlug).toBeNull();
  });
});

describe("the RUNNING workflow always gets a row, even once its lineage is retired", () => {
  // Rows are keyed on the catalogue, and a dynasty retired while a campaign still runs
  // it is absent from it — so the row was dropped and `Running now` had nothing to put
  // under a heading whose whole job is to say what is happening. 17 prod cold-email
  // campaigns are pinned to `tectonic` / `atlantis`, neither of which the catalogue
  // carries.
  const catalogue = [cat({ workflowSlug: "chan-other", workflowDynastySlug: "chan-other" })];
  const retired = grp({
    workflowDynastySlug: "chan-tectonic",
    workflowDynastyName: "Chan Tectonic",
    workflowSlugs: ["chan-tectonic-v16"],
    recipientsRepliesPositive: 3,
    committedCostUsd: 42,
  });

  it("synthesizes the row at a scoped grain, named and figured from the group", () => {
    const running = resolveRunningWorkflow("chan-tectonic-v16", catalogue, [[retired]]);
    const rows = buildCampaignWorkflowRows({
      catalogue,
      groups: [retired],
      running,
      pair: "reply",
      isLearning,
    });
    const row = rows.find((r) => r.workflowDynastySlug === "chan-tectonic")!;
    expect(row.running).toBe(true);
    expect(row.workflowDynastyName).toBe("Chan Tectonic");
    expect(row.positiveReplies).toBe(3);
    expect(row.committedCostUsd).toBe(42);
    // Everything only the CATALOGUE knows reads null rather than a guess.
    expect(row.contentModel).toBeNull();
    expect(row.contentPromptType).toBeNull();
    expect(rows.filter((r) => r.running)).toHaveLength(1);
  });

  it("synthesizes it at the global grain too, with no figures to borrow", () => {
    const running = resolveRunningWorkflow("chan-tectonic-v16", catalogue, [[retired]]);
    const rows = buildFleetWorkflowRows({
      catalogue,
      fleet: [],
      outreach: [],
      running,
      pair: "reply",
      isLearning,
    });
    const row = rows.find((r) => r.workflowDynastySlug === "chan-tectonic")!;
    expect(row.running).toBe(true);
    expect(row.positiveReplies).toBeNull();
    expect(row.committedCostUsd).toBeNull();
    // Nothing named it here, so the name falls back to what the resolver carried.
    expect(row.workflowDynastyName).toBe("Chan Tectonic");
  });

  it("never duplicates a dynasty the catalogue already offers", () => {
    const offered = [cat({ workflowSlug: "chan-legato-v9", workflowDynastySlug: "chan-legato", version: 9 })];
    const rows = buildCampaignWorkflowRows({
      catalogue: offered,
      groups: [],
      running: { dynastySlug: "chan-legato", dynastyName: "Legato" },
      pair: "reply",
      isLearning,
    });
    expect(rows.filter((r) => r.workflowDynastySlug === "chan-legato")).toHaveLength(1);
    expect(rows[0].running).toBe(true);
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
      running: { dynastySlug: "a", dynastyName: null },
      pair: "reply",
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
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
      isLearning,
    });
    expect(rows.map((r) => r.workflowDynastySlug)).toEqual(["a", "b"]);
  });

  it("gives a workflow the fleet has no row for NULL figures, never zeros", () => {
    const rows = buildFleetWorkflowRows({
      catalogue,
      fleet,
      outreach: [],
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
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
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
      isLearning,
    });
    expect(rows.every((r) => r.roiMultiple === null && r.cpcCents === null)).toBe(true);
  });
});

/**
 * The module has to stay importable by vitest, which resolves no `@` alias.
 */
describe("the outcome pair is the campaign's own LEG, not its funnel", () => {
  it("takes the VISIT pair for a leg that lands on a website visit", () => {
    expect(workflowOutcomePairFor("visit")).toBe("visit");
  });

  it("keeps the REPLY pair for a leg that lands on a sales interest", () => {
    expect(workflowOutcomePairFor("reply")).toBe("reply");
  });

  it("keeps the REPLY pair for every leg with NO per-workflow figure", () => {
    // features-service serves no per-workflow signup / form / sale count, and a leg we
    // could not place answers null. Both keep the columns this table read before legs
    // were consulted rather than a column of dashes.
    expect(workflowOutcomePairFor("signup")).toBe("reply");
    expect(workflowOutcomePairFor("formSubmission")).toBe("reply");
    expect(workflowOutcomePairFor("sale")).toBe("reply");
    expect(workflowOutcomePairFor(null)).toBe("reply");
    expect(workflowOutcomePairFor(undefined)).toBe("reply");
  });

  it("counts and prices a VISIT-led campaign on its visits, never its replies", () => {
    const [row] = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups: [grp({ recipientsRepliesPositive: 0, cpprCents: null, recipientsClicked: 412, cpcCents: 130 })],
      running: { dynastySlug: null, dynastyName: null },
      pair: "visit",
      isLearning,
    });
    expect(row.outcomePair).toBe("visit");
    expect(workflowOutcomeCount(row)).toBe(412);
    expect(workflowOutcomeCostCents(row)).toBe(130);
    // The reply figures are still carried verbatim — nothing is dropped, the row simply
    // states which of the two it is judged on.
    expect(row.positiveReplies).toBe(0);
  });

  it("reads the LEARNING bar against the pair's own count", () => {
    // 412 visits and zero replies: measured on a visit-led campaign, thin on a
    // reply-led one. The bar cannot be read against a count the row is not about.
    const groups = [grp({ recipientsRepliesPositive: 0, recipientsClicked: 412, cpcCents: 130 })];
    const visit = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups,
      running: { dynastySlug: null, dynastyName: null },
      pair: "visit",
      isLearning,
    })[0];
    const reply = buildCampaignWorkflowRows({
      catalogue: [cat()],
      groups,
      running: { dynastySlug: null, dynastyName: null },
      pair: "reply",
      isLearning,
    })[0];
    expect(visit.learning).toBe(false);
    expect(reply.learning).toBe(true);
  });

  it("puts the fleet's single served price on the pair's own field", () => {
    // `costPerOutcomeUsd` prices whichever objective the caller ASKED for, so on a
    // visit-led campaign it is a cost per website visit — and reading it as `cpprCents`
    // is how a visit price ends up under a "cost per sales interest" header.
    const [row] = buildFleetWorkflowRows({
      catalogue: [cat({ workflowDynastySlug: "a", workflowSlug: "a", workflowDynastyName: "A" })],
      fleet: [
        {
          workflowDynastySlug: "a",
          workflowDynastyName: "A",
          spentUsd: 900,
          costPerOutcomeUsd: 3.5,
          observedPositiveReplies: 2,
          observedClicks: 260,
        },
      ],
      outreach: [],
      running: { dynastySlug: null, dynastyName: null },
      pair: "visit",
      isLearning,
    });
    expect(row.cpcCents).toBe(350);
    expect(row.cpprCents).toBeNull();
    expect(workflowOutcomeCount(row)).toBe(260);
    expect(row.learning).toBe(false);
  });

  it("sections and ranks a VISIT-led scope on its visits", () => {
    const rows = [
      row({ workflowDynastySlug: "dear", outcomePair: "visit", websiteClicks: 300, cpcCents: 900 }),
      row({ workflowDynastySlug: "cheap", outcomePair: "visit", websiteClicks: 300, cpcCents: 120 }),
      // Plenty of replies, no visit at all: NOT measured on a campaign that buys visits.
      row({
        workflowDynastySlug: "repliesOnly",
        outcomePair: "visit",
        positiveReplies: 40,
        cpprCents: 100,
        websiteClicks: 0,
        outreach: 12,
        learning: true,
      }),
    ];
    const out = sectionCampaignWorkflowRows(rows);
    expect(out.measured.map((r) => r.workflowDynastySlug)).toEqual(["cheap", "dear"]);
    expect(out.notMeasured.map((r) => r.workflowDynastySlug)).toEqual(["repliesOnly"]);
  });
});

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
