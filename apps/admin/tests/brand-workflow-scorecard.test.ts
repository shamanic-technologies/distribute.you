import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  BRAND_WORKFLOW_SORT_KEYS,
  brandGroupKey,
  buildBrandWorkflowRows,
} from "../src/lib/brand-workflow-rows";
import { fmtPct, fmtRoi } from "../src/lib/feature-stats-format";
import type { WorkflowPerfRow } from "../src/lib/feature-stats-workflow-rows";

const FEATURE_DIR = join(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]",
);
const read = (p: string) => readFileSync(p, "utf8");

const page = read(join(FEATURE_DIR, "workflow-stats/page.tsx"));
const sidebar = read(join(__dirname, "../src/components/context-sidebar.tsx"));
const api = read(join(__dirname, "../src/lib/api.ts"));

describe("brand Workflows scorecard: routing + nav", () => {
  it("ships the route", () => {
    expect(existsSync(join(FEATURE_DIR, "workflow-stats/page.tsx"))).toBe(true);
  });

  it("keeps the workflow EDITOR route, which is a different page", () => {
    expect(existsSync(join(FEATURE_DIR, "workflows/page.tsx"))).toBe(true);
  });

  it("adds the entry at the bottom of the feature-level sidebar", () => {
    expect(sidebar).toContain('id: "workflow-stats"');
    expect(sidebar).toContain("`${basePath}/workflow-stats`");
    // Bottom block: it sits with Feature Settings, after the entity groups.
    expect(sidebar.indexOf('id: "workflow-stats"')).toBeLessThan(
      sidebar.indexOf('id: "feature-settings"'),
    );
  });

  it("stays at the FEATURE nav level — `workflow-stats` is not the settings-level `workflows`", () => {
    // getNavigationLevel sends segments[6] === "workflows" to featureSettings;
    // a `workflow-stats` segment must fall through so the feature sidebar draws.
    expect(sidebar).toContain('segments[6] === "settings" || segments[6] === "workflows"');
    expect(sidebar).not.toContain('segments[6] === "workflow-stats"');
  });

  it("renames the settings-level entry so one nav has no two Workflows", () => {
    expect(sidebar).toContain('label: "Workflow editor"');
    expect(sidebar).toContain('backLabel="Workflow editor"');
  });
});

describe("brand Workflows scorecard: the table", () => {
  it("renders this brand's four realized money columns", () => {
    for (const label of ["ROI", "% CAC", "$ CAC", "Revenue"]) {
      expect(page).toContain(`label="${label}"`);
    }
  });

  it("renders the fleet page's six columns beside them", () => {
    for (const label of [
      "Positive replies",
      "CPPR",
      "Website visits",
      "CPWV",
      "Outreach",
      "$ Invested",
    ]) {
      expect(page).toContain(`label="${label}"`);
    }
  });

  it("labels the two halves apart — one is this brand, the other is everyone", () => {
    expect(page).toContain("This brand");
    expect(page).toContain("All client brands");
  });

  it("computes nothing: no ratio is derived in the browser", () => {
    const body = page.slice(page.indexOf("export default function"));
    expect(body).not.toMatch(/\brow\.\w+[\w.?]*\s*\/\s*row\./);
    expect(body).not.toContain("100 /");
  });

  it("shares the fleet Workflow page's query keys so the two cannot disagree", () => {
    expect(page).toContain('["crossOrgWorkflowCost", featureSlug, "positiveReply"]');
    expect(page).toContain('["crossOrgWorkflowCost", featureSlug, "websiteVisit"]');
    expect(page).toContain('["crossOrgWorkflowOutreach", featureSlug]');
  });

  it("reveals on settle and STATES why the brand columns are blank rather than skeletoning", () => {
    expect(page).toContain("!q.isPending || q.isError");
    expect(page).toContain("brand.isError");
    expect(page).toContain("features-service serves the");
  });

  it("reads the brand figures from features-service, never from a runs/spend join", () => {
    expect(page).toContain("getFeatureRevenueByWorkflow");
    expect(api).toContain('groupBy: "workflowSlug"');
  });
});

describe("buildBrandWorkflowRows", () => {
  const fleet = (slug: string): WorkflowPerfRow => ({
    slug,
    name: `Fleet ${slug}`,
    positiveReplies: 14,
    cpprUsd: 92.8,
    websiteVisits: 52,
    cpwvUsd: 24.9,
    outreach: 638,
    investedUsd: 1299.47,
  });
  const group = (slug: string) => ({
    workflowDynastySlug: slug,
    workflowDynastyName: `Brand ${slug}`,
    headline: { totalPipelineUsd: 4200 },
    costEconomics: {
      totalCostUsd: 1299.47,
      costOfAcquisitionPct: 31,
      costPerAcquisitionUsd: 92.8,
      roiMultiple: 3.2,
    },
  });

  it("joins this brand's money to the fleet benchmark for the same workflow", () => {
    const [row] = buildBrandWorkflowRows([group("wf-a")], [fleet("wf-a")]);
    expect(row.brand).toEqual({
      roiMultiple: 3.2,
      cacPct: 31,
      cacUsd: 92.8,
      pipelineUsd: 4200,
    });
    expect(row.fleet?.cpprUsd).toBe(92.8);
    expect(row.name).toBe("Brand wf-a");
  });

  it("keeps a workflow the brand ran that the fleet read is silent on", () => {
    const [row] = buildBrandWorkflowRows([group("wf-a")], []);
    expect(row.fleet).toBeNull();
    expect(row.brand.roiMultiple).toBe(3.2);
  });

  it("keeps a fleet workflow this brand never ran, with the brand side null", () => {
    const [row] = buildBrandWorkflowRows([], [fleet("wf-z")]);
    expect(row.brand).toEqual({ roiMultiple: null, cacPct: null, cacUsd: null, pipelineUsd: null });
    expect(row.fleet?.slug).toBe("wf-z");
    expect(row.name).toBe("Fleet wf-z");
  });

  it("reads the workflow key under either spelling, preferring the dynasty", () => {
    expect(brandGroupKey({ ...group("wf-a"), workflowSlug: "wf-a-v5" })).toBe("wf-a");
    expect(
      brandGroupKey({
        workflowDynastySlug: null,
        workflowSlug: "wf-b-v2",
        headline: { totalPipelineUsd: null },
        costEconomics: { costOfAcquisitionPct: null, roiMultiple: null },
      }),
    ).toBe("wf-b-v2");
  });

  it("drops a group carrying no workflow key rather than inventing a name", () => {
    const rows = buildBrandWorkflowRows(
      [
        {
          workflowDynastySlug: null,
          workflowSlug: null,
          headline: { totalPipelineUsd: 100 },
          costEconomics: { costOfAcquisitionPct: null, roiMultiple: null },
        },
      ],
      [],
    );
    expect(rows).toHaveLength(0);
  });

  it("emits null (not 0) for an unmeasurable figure so the cell reads —", () => {
    const [row] = buildBrandWorkflowRows(
      [
        {
          workflowDynastySlug: "wf-a",
          headline: { totalPipelineUsd: null },
          costEconomics: { costOfAcquisitionPct: null, roiMultiple: null },
        },
      ],
      [],
    );
    expect(row.brand.roiMultiple).toBeNull();
    expect(row.brand.cacUsd).toBeNull();
    expect(fmtRoi(row.brand.roiMultiple)).toBe("—");
    expect(fmtPct(row.brand.cacPct)).toBe("—");
  });

  it("deduplicates the union — one row per workflow", () => {
    const rows = buildBrandWorkflowRows([group("wf-a")], [fleet("wf-a"), fleet("wf-b")]);
    expect(rows.map((r) => r.slug).sort()).toEqual(["wf-a", "wf-b"]);
  });

  it("exposes a sort key for every displayed column", () => {
    expect(Object.keys(BRAND_WORKFLOW_SORT_KEYS).sort()).toEqual([
      "cacPct",
      "cacUsd",
      "cppr",
      "cpwv",
      "invested",
      "name",
      "outreach",
      "positiveReplies",
      "revenue",
      "roi",
      "websiteVisits",
    ]);
  });

  it("sorts the fleet columns off the fleet half, not the brand half", () => {
    const [row] = buildBrandWorkflowRows([group("wf-a")], [fleet("wf-a")]);
    expect(BRAND_WORKFLOW_SORT_KEYS.invested(row)).toBe(1299.47);
    expect(BRAND_WORKFLOW_SORT_KEYS.revenue(row)).toBe(4200);
  });
});

describe("ROI + percentage format", () => {
  it("prints ONE decimal for ROI, everywhere", () => {
    expect(fmtRoi(11.72)).toBe("11.7×");
    expect(fmtRoi(3)).toBe("3.0×");
  });

  it("renders an unmeasurable figure as — rather than a false zero", () => {
    expect(fmtRoi(null)).toBe("—");
    expect(fmtPct(null)).toBe("—");
    expect(fmtPct(0)).toBe("0.0%");
  });
});
