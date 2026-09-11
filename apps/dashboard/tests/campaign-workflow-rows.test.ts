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
  collapseWorkflowCatalogue,
  runningDynastyFor,
  resolveRunningWorkflow,
  fleetComparison,
  type CampaignWorkflowRow,
  type FleetWorkflowCost,
  type WorkflowCatalogueRow,
  type WorkflowDynastyMembership,
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

  it("answers the SAME when NO group set is supplied at all", () => {
    // The regression this closed: resolving per grain returned null wherever the caller
    // held no groups, so `Running now` vanished on that surface alone while every other
    // one rendered it. The dynasty map answers with no groups in hand.
    expect(
      resolveRunningWorkflow("chan-legato-v2", [cur], [], [
        { workflowDynastySlug: "chan-legato", workflowDynastyName: "Legato", workflowSlugs: ["chan-legato-v2"] },
      ]),
    ).toEqual({ dynastySlug: "chan-legato", dynastyName: "Legato" });
  });

  it("states NO running workflow when no source names the version", () => {
    expect(resolveRunningWorkflow("chan-unknown-v3", [cur], [[group]])).toEqual({
      dynastySlug: null,
      dynastyName: null,
    });
    expect(resolveRunningWorkflow(null, [cur], [[group]]).dynastySlug).toBeNull();
  });
});

describe("a SUPERSEDED version is named by the channel's dynasty map, and by nothing else", () => {
  // The catalogue carries each dynasty's CURRENT version only, and a group's folded
  // `workflowSlugs` carries the versions that SPENT in the scope being read. A campaign
  // pinned to a version that is neither was unnameable permanently, and `Running now`
  // vanished with every figure on the page real and nothing red anywhere.
  //
  // Production 2026-09-11, the campaign that surfaced it: campaign-service pinned it to
  // `sales-cold-email-outreach-rudder-v3`; workflow-service's catalogue answered with
  // v5 alone (it filters to active versions whatever filter is passed); and the brand's
  // revenue group folded ["rudder-v2", "rudder-v5"] because this brand never ran v3.
  const RUDDER = "sales-cold-email-outreach-rudder";
  const prodCatalogue = cat({
    workflowSlug: `${RUDDER}-v5`,
    workflowDynastySlug: RUDDER,
    workflowDynastyName: "Sales Cold Email Outreach Rudder",
    version: 5,
  });
  const prodGroup = grp({
    workflowDynastySlug: RUDDER,
    workflowDynastyName: "Sales Cold Email Outreach Rudder",
    workflowSlugs: [`${RUDDER}-v2`, `${RUDDER}-v5`],
  });
  const prodMemberships: WorkflowDynastyMembership[] = [
    {
      workflowDynastySlug: RUDDER,
      workflowDynastyName: "Sales Cold Email Outreach Rudder",
      workflowSlugs: [
        `${RUDDER}-v3`,
        `${RUDDER}-v2`,
        RUDDER,
        `${RUDDER}-v4`,
        `${RUDDER}-v5`,
      ],
    },
  ];

  it("names the dynasty of the prod slug neither the catalogue nor the group carries", () => {
    // Both pre-existing sources answer null for this one — that IS the bug.
    expect(runningDynastyFor(`${RUDDER}-v3`, [prodCatalogue], [prodGroup])).toBeNull();
    expect(runningDynastyFor(`${RUDDER}-v3`, [prodCatalogue], [prodGroup], prodMemberships)).toBe(
      RUDDER,
    );
  });

  it("resolves it end to end, with the name the map states", () => {
    expect(
      resolveRunningWorkflow(`${RUDDER}-v3`, [prodCatalogue], [[prodGroup]], prodMemberships),
    ).toEqual({ dynastySlug: RUDDER, dynastyName: "Sales Cold Email Outreach Rudder" });
  });

  it("names the dynasty from the map alone, when no catalogue and no group answer", () => {
    // The name must come from the map too, or a resolvable dynasty renders as its slug.
    expect(resolveRunningWorkflow(`${RUDDER}-v3`, [], [[]], prodMemberships)).toEqual({
      dynastySlug: RUDDER,
      dynastyName: "Sales Cold Email Outreach Rudder",
    });
  });

  it("gives it a row on the Running now section at every grain", () => {
    const running = resolveRunningWorkflow(
      `${RUDDER}-v3`,
      [prodCatalogue],
      [[prodGroup]],
      prodMemberships,
    );
    const scoped = buildCampaignWorkflowRows({
      catalogue: [prodCatalogue],
      groups: [prodGroup],
      running,
      pair: "reply",
      isLearning,
    });
    expect(scoped.filter((r) => r.running).map((r) => r.workflowDynastySlug)).toEqual([RUDDER]);
    // And with NO groups in hand at all, which is what the map exists for: the two
    // other sources can only ever name a CURRENT version or one that already SPENT.
    const mapOnly = resolveRunningWorkflow(
      `${RUDDER}-v3`,
      [prodCatalogue],
      [],
      prodMemberships,
    );
    expect(mapOnly.dynastySlug).toBe(RUDDER);
  });

  it("does NOT override a catalogue match — the map is the last source, not the first", () => {
    // Every case that already resolved must stay byte-identical: the map adds coverage,
    // never a different answer.
    const other: WorkflowDynastyMembership[] = [
      { workflowDynastySlug: "somewhere-else", workflowDynastyName: "Else", workflowSlugs: ["chan-legato"] },
    ];
    expect(runningDynastyFor("chan-legato", [cat()], [], other)).toBe("chan-legato");
  });

  it("is a no-op when the map has not loaded — never deletes the section", () => {
    // A failed or in-flight read must degrade to the previous behaviour exactly.
    const withMap = resolveRunningWorkflow("chan-legato", [cat()], [[]], []);
    const without = resolveRunningWorkflow("chan-legato", [cat()], [[]]);
    expect(withMap).toEqual(without);
    expect(without.dynastySlug).toBe("chan-legato");
  });

  it("still states NO running workflow when the map does not name the version either", () => {
    expect(
      resolveRunningWorkflow("chan-unknown-v3", [prodCatalogue], [[prodGroup]], prodMemberships),
    ).toEqual({ dynastySlug: null, dynastyName: null });
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

  it("measures a VISIT-led scope on its VISITS, never on its replies", () => {
    // Plenty of replies and no visit at all is NOT measured on a campaign that buys
    // visits — the pair decides which count the row stands on.
    const visitRows = [
      row({ workflowDynastySlug: "cheap", outcomePair: "visit", websiteClicks: 300, cpcCents: 120 }),
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
    expect(workflowOutcomeCount(visitRows[0])).toBe(300);
    expect(workflowOutcomeCostCents(visitRows[0])).toBe(120);
    expect(workflowOutcomeCount(visitRows[1])).toBe(0);
    expect(workflowOutcomeCostCents(visitRows[1])).toBeNull();
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
