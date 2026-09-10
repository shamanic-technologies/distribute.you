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
  collapseWorkflowCatalogue,
  runningDynastyFor,
  fleetComparison,
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
    requiredProviders: [{ name: "anthropic", domain: "anthropic.com" }],
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
  it("is the UNION of the catalogue and the revenue groups", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [cat({ workflowDynastySlug: "chan-offered", workflowSlug: "chan-offered", workflowDynastyName: "Offered" })],
      groups: [grp({ workflowDynastySlug: "chan-retired", workflowDynastyName: "Retired" })],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows.map((r) => r.workflowDynastySlug).sort()).toEqual([
      "chan-offered",
      "chan-retired",
    ]);
  });

  it("marks a group with no catalogue entry as RETIRED and keeps its figures", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [],
      groups: [grp()],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows[0].retired).toBe(true);
    expect(rows[0].committedCostUsd).toBe(25);
    expect(rows[0].outreach).toBe(383);
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

  it("puts the RUNNING workflow first, however expensive it is", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [
        cat({ workflowDynastySlug: "a", workflowSlug: "a", workflowDynastyName: "A" }),
        cat({ workflowDynastySlug: "b", workflowSlug: "b", workflowDynastyName: "B" }),
      ],
      groups: [
        grp({ workflowDynastySlug: "a", workflowSlugs: ["a"], cpprCents: 9000 }),
        grp({ workflowDynastySlug: "b", workflowSlugs: ["b"], cpprCents: 100 }),
      ],
      campaignWorkflowSlug: "a",
      isLearning,
    });
    expect(rows.map((r) => r.workflowDynastySlug)).toEqual(["a", "b"]);
    expect(rows[0].running).toBe(true);
  });

  it("ranks measured rows cheapest-first and sinks learning / unpriced ones", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [
        cat({ workflowDynastySlug: "never-run", workflowSlug: "never-run", workflowDynastyName: "Never" }),
      ],
      groups: [
        grp({ workflowDynastySlug: "dear", workflowSlugs: ["dear"], workflowDynastyName: "Dear", cpprCents: 800 }),
        grp({ workflowDynastySlug: "cheap", workflowSlugs: ["cheap"], workflowDynastyName: "Cheap", cpprCents: 100 }),
        grp({
          workflowDynastySlug: "thin",
          workflowSlugs: ["thin"],
          workflowDynastyName: "Thin",
          cpprCents: 1,
          recipientsRepliesPositive: 2,
        }),
      ],
      campaignWorkflowSlug: null,
      isLearning,
    });
    // A learning row's price is deliberately not shown, so it must not be ranked on
    // it — a $0.01 cost standing on two replies would otherwise take the top row.
    expect(rows.map((r) => r.workflowDynastySlug)).toEqual([
      "cheap",
      "dear",
      "thin",
      "never-run",
    ]);
  });

  it("dedupes providers by domain and drops the nameless", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [
        cat({
          requiredProviders: [
            { name: "anthropic", domain: "anthropic.com" },
            { name: "anthropic-2", domain: "anthropic.com" },
            { name: "apollo", domain: null },
            { name: "", domain: "x.com" },
          ],
        }),
      ],
      groups: [],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows[0].providers).toEqual([
      { name: "anthropic", domain: "anthropic.com" },
      { name: "apollo", domain: null },
    ]);
  });

  it("falls back to the slug when neither source names the dynasty", () => {
    const rows = buildCampaignWorkflowRows({
      catalogue: [],
      groups: [grp({ workflowDynastyName: null })],
      campaignWorkflowSlug: null,
      isLearning,
    });
    expect(rows[0].workflowDynastyName).toBe("chan-legato");
  });
});

describe("fleetComparison", () => {
  const fleet = [
    { workflowDynastySlug: "a", workflowDynastyName: "A", spentUsd: 10, costPerOutcomeUsd: 100 },
    { workflowDynastySlug: "b", workflowDynastyName: "B", spentUsd: 10, costPerOutcomeUsd: 300 },
    { workflowDynastySlug: "c", workflowDynastyName: "C", spentUsd: 10, costPerOutcomeUsd: 200 },
  ];

  it("takes the MEDIAN, never the mean — one absurd rate must not move it", () => {
    const skewed = [...fleet, { workflowDynastySlug: "d", workflowDynastyName: "D", spentUsd: 1, costPerOutcomeUsd: 100000 }];
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
      { workflowDynastySlug: "a", workflowDynastyName: "A", spentUsd: 0, costPerOutcomeUsd: null },
    ]);
    expect(out.mine).toBeNull();
    expect(out.median).toBeNull();
    expect(out.best).toBeNull();
  });

  it("answers NULL for a workflow the fleet does not carry, without inventing one", () => {
    expect(fleetComparison("missing", fleet).mine).toBeNull();
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
