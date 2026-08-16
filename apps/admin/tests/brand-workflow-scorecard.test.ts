import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  BRAND_WORKFLOW_SORT_KEYS,
  brandGroupKey,
  buildBrandWorkflowRows,
} from "../src/lib/brand-workflow-rows";
import { fmtPct, fmtRoi } from "../src/lib/feature-stats-format";

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

  it("renders the volume and outcome-cost columns, same order, beside them", () => {
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

  it("is brand-scoped end to end — no cross-brand half, no fleet reads", () => {
    expect(page).toContain("This brand");
    expect(page).not.toContain("All client brands");
    expect(page).not.toContain("getCrossOrgWorkflowCostPerOutcome");
    expect(page).not.toContain("getCrossOrgWorkflowOutreach");
    expect(page).not.toContain("crossOrgWorkflowCost");
    expect(page).not.toContain("buildWorkflowPerfRows");
  });

  it("computes nothing: no ratio is derived in the browser", () => {
    const body = page.slice(page.indexOf("export default function"));
    expect(body).not.toMatch(/\brow\.\w+[\w.?]*\s*\/\s*row\./);
    expect(body).not.toContain("100 /");
  });

  it("reveals on settle and STATES why the columns are blank rather than skeletoning", () => {
    expect(page).toContain("brand.isPending && !brand.isError");
    expect(page).toContain("brand.isError");
    expect(page).toContain("features-service serves the");
    // The five the producer does not break down per workflow yet.
    expect(page).toContain("engagementMissing");
  });

  it("reads the brand figures from features-service, never from a runs/spend join", () => {
    expect(page).toContain("getFeatureRevenueByWorkflow");
    // The parameter the producer actually deployed (features-service #772).
    expect(api).toContain('groupBy: "workflow"');
    expect(api).not.toContain('groupBy: "workflowSlug"');
  });
});

describe("buildBrandWorkflowRows", () => {
  const group = (slug: string) => ({
    workflowDynastySlug: slug,
    workflowDynastyName: `Brand ${slug}`,
    headline: { totalPipelineUsd: 4200 },
    costEconomics: {
      actualCostUsd: 1299.47,
      costOfAcquisitionPct: 31,
      costPerAcquisitionUsd: 92.8,
      roiMultiple: 3.2,
    },
    recipientsContacted: 638,
    recipientsClicked: 52,
    recipientsRepliesPositive: 14,
    spend: { cpprCents: 9280, totalCpcCents: 2490 },
  });

  it("carries every column off THIS brand's group", () => {
    const [row] = buildBrandWorkflowRows([group("wf-a")]);
    expect(row).toEqual({
      slug: "wf-a",
      name: "Brand wf-a",
      roiMultiple: 3.2,
      cacPct: 31,
      cacUsd: 92.8,
      pipelineUsd: 4200,
      positiveReplies: 14,
      cpprUsd: 92.8,
      websiteVisits: 52,
      cpwvUsd: 24.9,
      outreach: 638,
      investedUsd: 1299.47,
    });
  });

  it("prints the BILLED spend the return divides by, not the committed total", () => {
    // ROI rides actualCostUsd; a $ Invested column showing anything else would
    // make the row contradict its own ROI.
    const [row] = buildBrandWorkflowRows([
      { ...group("wf-a"), costEconomics: { ...group("wf-a").costEconomics, actualCostUsd: 800 } },
    ]);
    expect(row.investedUsd).toBe(800);
  });

  it("still fills $ Invested from the pre-rename spelling", () => {
    const g = group("wf-a");
    const [row] = buildBrandWorkflowRows([
      { ...g, costEconomics: { ...g.costEconomics, actualCostUsd: null, totalCostUsd: 512 } },
    ]);
    expect(row.investedUsd).toBe(512);
  });

  it("joins the DEPLOYED shape — a dynasty group listing its folded versions", () => {
    // features-service #772: a group is a dynasty, keyed workflowDynastySlug,
    // carrying workflowSlugs. Upgrading to v2 is one row, not two.
    const [row] = buildBrandWorkflowRows([
      { ...group("wf-a"), workflowSlugs: ["wf-a-v1", "wf-a-v2"] },
    ]);
    expect(row.slug).toBe("wf-a");
    expect(row.roiMultiple).toBe(3.2);
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
    const rows = buildBrandWorkflowRows([
      {
        workflowDynastySlug: null,
        workflowSlug: null,
        headline: { totalPipelineUsd: 100 },
        costEconomics: { costOfAcquisitionPct: null, roiMultiple: null },
      },
    ]);
    expect(rows).toHaveLength(0);
  });

  it("emits null (not 0) for an unmeasurable figure so the cell reads —", () => {
    const [row] = buildBrandWorkflowRows([
      {
        workflowDynastySlug: "wf-a",
        headline: { totalPipelineUsd: null },
        costEconomics: { costOfAcquisitionPct: null, roiMultiple: null },
      },
    ]);
    expect(row.roiMultiple).toBeNull();
    expect(row.cacUsd).toBeNull();
    expect(fmtRoi(row.roiMultiple)).toBe("—");
    expect(fmtPct(row.cacPct)).toBe("—");
  });

  it("leaves the volume columns null while the producer answers them brand-wide only", () => {
    // Absent per-workflow ≠ zero outreach: the cell reads —, and the page says why.
    const [row] = buildBrandWorkflowRows([
      {
        workflowDynastySlug: "wf-a",
        headline: { totalPipelineUsd: 4200 },
        costEconomics: { costOfAcquisitionPct: 31, roiMultiple: 3.2 },
      },
    ]);
    expect(row.outreach).toBeNull();
    expect(row.positiveReplies).toBeNull();
    expect(row.websiteVisits).toBeNull();
    expect(row.cpprUsd).toBeNull();
    expect(row.cpwvUsd).toBeNull();
  });

  it("deduplicates — one row per workflow dynasty", () => {
    const rows = buildBrandWorkflowRows([group("wf-a"), group("wf-a"), group("wf-b")]);
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

  it("sorts every column off this brand's own figure", () => {
    const [row] = buildBrandWorkflowRows([group("wf-a")]);
    expect(BRAND_WORKFLOW_SORT_KEYS.invested(row)).toBe(1299.47);
    expect(BRAND_WORKFLOW_SORT_KEYS.revenue(row)).toBe(4200);
    expect(BRAND_WORKFLOW_SORT_KEYS.outreach(row)).toBe(638);
    expect(BRAND_WORKFLOW_SORT_KEYS.cppr(row)).toBe(92.8);
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
