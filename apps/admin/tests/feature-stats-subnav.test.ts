import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildWorkflowPerfRows,
  WORKFLOW_PERF_SORT_KEYS,
} from "../src/lib/feature-stats-workflow-rows";
import {
  cmpValues,
  fmtCount,
  fmtUsd,
  growth7d,
  latestCost,
  nextSort,
  usd2,
} from "../src/lib/feature-stats-format";
import { OBJECTIVES, SALES_OBJECTIVE } from "../src/lib/feature-stats-objectives";

const ROUTE = join(
  __dirname,
  "../src/app/(authed)/(dashboard)/feature-stats/sales-cold-email-outreach",
);
const read = (p: string) => readFileSync(p, "utf8");

const layout = read(join(ROUTE, "layout.tsx"));
const economics = read(join(ROUTE, "page.tsx"));
const details = read(join(ROUTE, "details/page.tsx"));
const workflows = read(join(ROUTE, "workflows/page.tsx"));
const sidebar = read(join(__dirname, "../src/components/feature-stats/feature-stats-sidebar.tsx"));
const contextSidebar = read(join(__dirname, "../src/components/context-sidebar.tsx"));

describe("feature-stats: the page is split into sub-pages", () => {
  it("ships all three routes", () => {
    expect(existsSync(join(ROUTE, "page.tsx"))).toBe(true);
    expect(existsSync(join(ROUTE, "details/page.tsx"))).toBe(true);
    expect(existsSync(join(ROUTE, "workflows/page.tsx"))).toBe(true);
  });

  it("mounts the second sidebar BESIDE the page body, not in place of it", () => {
    expect(layout).toContain("FeatureStatsSidebar");
    // Row on desktop = the Platform sidebar, this sub-nav, then the body.
    expect(layout).toContain("md:flex-row");
    expect(layout).toContain("{children}");
  });

  it("keeps the Platform sidebar rendering: the route stays at nav level `app`", () => {
    // `getNavigationLevel` only leaves the `app` level for /orgs and /features
    // paths, so /feature-stats keeps AppLevelSidebar — that is what makes this
    // a SECOND column instead of a replacement. A `feature-stats` branch added
    // there would silently drop the Platform nav.
    expect(contextSidebar).not.toContain('segments[0] === "feature-stats"');
  });

  it("splits the two original sections rather than duplicating them", () => {
    // Economics owns the ticker cards; details owns the trend chart + selector.
    expect(economics).toContain("OutcomeCard");
    expect(economics).not.toContain("CartesianGrid");
    expect(details).toContain("CartesianGrid");
    expect(details).not.toContain("OutcomeCard");
  });

  it("defines the money format ONCE — no page redeclares the shared helpers", () => {
    for (const src of [economics, details, workflows]) {
      expect(src).not.toContain("const usd2 =");
      expect(src).not.toContain("function fmtUsd");
      expect(src).not.toContain("function Sparkline");
      expect(src).not.toContain("function SortableTh");
    }
  });

  it("reuses the exported sidebar primitives instead of a second copy", () => {
    expect(contextSidebar).toContain("export function SidebarSection");
    expect(contextSidebar).toContain("export function SidebarLink");
    expect(sidebar).toContain('from "@/components/context-sidebar"');
    expect(sidebar).not.toContain("<aside");
  });

  it("lists Economics / Cost details / Workflow in the sub-nav", () => {
    expect(sidebar).toContain('label: "Economics"');
    expect(sidebar).toContain('label: "Cost details"');
    expect(sidebar).toContain('label: "Workflow"');
    expect(sidebar).toContain("`${basePath}/details`");
    expect(sidebar).toContain("`${basePath}/workflows`");
  });
});

describe("feature-stats: the Workflow page", () => {
  it("renders the six asked-for columns", () => {
    for (const label of [
      "Positive replies",
      "CPPR",
      "Website visits",
      "CPWV",
      "Outreach",
      "$ Invested",
    ]) {
      expect(workflows).toContain(`label="${label}"`);
    }
  });

  it("prints served fields only — no cost is divided in the browser", () => {
    const body = workflows.slice(workflows.indexOf("export default function"));
    expect(body).not.toMatch(/\brow\.\w+\s*\/\s*row\./);
    expect(body).not.toContain("investedUsd /");
  });

  it("labels the volume column with contacts, never a run count", () => {
    expect(workflows).toContain("not a count of workflow runs");
    expect(workflows).not.toContain("completedRuns");
  });

  it("reveals on settle so one failing read cannot skeleton the page forever", () => {
    expect(workflows).toContain("isPending && !replies.isError");
    expect(workflows).toContain("isPending && !visits.isError");
    expect(workflows).toContain("isPending && !outreach.isError");
  });

  it("shares the Cost details page's per-objective query keys (one fetch, two pages)", () => {
    expect(workflows).toContain('["crossOrgWorkflowCost", FEATURE_SLUG, "positiveReply"]');
    expect(details).toContain('["crossOrgWorkflowCost", FEATURE_SLUG, objective]');
  });
});

describe("buildWorkflowPerfRows", () => {
  const replyRow = {
    workflowDynastySlug: "wf-a",
    workflowDynastyName: "Workflow A",
    spentUsd: 209.88,
    observedClicks: 1,
    observedPositiveReplies: 2,
    costPerOutcomeUsd: 104.94,
    recentCostPerOutcomeUsd: null,
  };
  const visitRow = {
    workflowDynastySlug: "wf-a",
    workflowDynastyName: "Workflow A",
    spentUsd: 209.88,
    observedClicks: 1,
    observedPositiveReplies: 2,
    costPerOutcomeUsd: 209.88,
    recentCostPerOutcomeUsd: null,
  };
  const outreachRow = {
    workflow: { workflowDynastySlug: "wf-a", workflowDynastyName: "Workflow A" },
    stats: { recipientsContacted: 638, recipientsSent: 587, completedRuns: 14963 },
  };

  it("joins the three reads on the dynasty slug", () => {
    const [row] = buildWorkflowPerfRows([replyRow], [visitRow], [outreachRow]);
    expect(row).toEqual({
      slug: "wf-a",
      name: "Workflow A",
      positiveReplies: 2,
      cpprUsd: 104.94,
      websiteVisits: 1,
      cpwvUsd: 209.88,
      outreach: 638,
      investedUsd: 209.88,
    });
  });

  it("takes CPPR from the reply read and CPWV from the visit read, never the other way round", () => {
    const [row] = buildWorkflowPerfRows([replyRow], [visitRow], []);
    expect(row.cpprUsd).toBe(replyRow.costPerOutcomeUsd);
    expect(row.cpwvUsd).toBe(visitRow.costPerOutcomeUsd);
  });

  it("never reports the run count as outreach", () => {
    const [row] = buildWorkflowPerfRows([replyRow], [visitRow], [outreachRow]);
    expect(row.outreach).toBe(638);
    expect(row.outreach).not.toBe(14963);
  });

  it("keeps a workflow that only one source knows about, with nulls elsewhere", () => {
    const rows = buildWorkflowPerfRows([], [], [outreachRow]);
    expect(rows).toHaveLength(1);
    expect(rows[0].outreach).toBe(638);
    expect(rows[0].cpprUsd).toBeNull();
    expect(rows[0].investedUsd).toBeNull();
    // No name on any cost read → falls back to the slug, never an empty cell.
    expect(rows[0].name).toBe("Workflow A");
  });

  it("falls back to the slug when no source carries a name", () => {
    const rows = buildWorkflowPerfRows([], [], [
      { workflow: { workflowDynastySlug: "wf-z" }, stats: {} },
    ]);
    expect(rows[0].name).toBe("wf-z");
    expect(rows[0].outreach).toBeNull();
  });

  it("emits null (not 0) for an absent figure, so the cell reads —", () => {
    const rows = buildWorkflowPerfRows(
      [{ ...replyRow, costPerOutcomeUsd: null }],
      [],
      [],
    );
    expect(rows[0].cpprUsd).toBeNull();
    expect(fmtUsd(rows[0].cpprUsd)).toBe("—");
    expect(fmtCount(rows[0].outreach)).toBe("—");
  });

  it("deduplicates the union — one row per dynasty", () => {
    const rows = buildWorkflowPerfRows([replyRow], [visitRow], [outreachRow]);
    expect(rows).toHaveLength(1);
  });

  it("exposes a sort key for every displayed column", () => {
    expect(Object.keys(WORKFLOW_PERF_SORT_KEYS).sort()).toEqual([
      "cppr",
      "cpwv",
      "invested",
      "name",
      "outreach",
      "positiveReplies",
      "websiteVisits",
    ]);
  });
});

describe("feature-stats shared format", () => {
  it("prints 2 decimals under $10 and whole dollars at/above it", () => {
    expect(usd2(5.784)).toBe("$5.78");
    expect(usd2(11.7)).toBe("$12");
  });

  it("renders a null figure as — rather than a false zero", () => {
    expect(fmtUsd(null)).toBe("—");
    expect(fmtUsd(undefined)).toBe("—");
    expect(fmtUsd(0)).toBe("$0.00");
    expect(fmtCount(null)).toBe("—");
    expect(fmtCount(0)).toBe("0");
  });

  it("sinks nulls to the bottom in both directions", () => {
    expect(cmpValues(null, 3, "asc")).toBe(1);
    expect(cmpValues(null, 3, "desc")).toBe(1);
    expect(cmpValues(3, null, "desc")).toBe(-1);
    expect(cmpValues(1, 2, "desc")).toBeGreaterThan(0);
  });

  it("flips direction on the same key and restarts ascending on a new one", () => {
    expect(nextSort(null, "invested")).toEqual({ key: "invested", dir: "asc" });
    expect(nextSort({ key: "invested", dir: "asc" }, "invested")).toEqual({
      key: "invested",
      dir: "desc",
    });
    expect(nextSort({ key: "invested", dir: "desc" }, "cppr")).toEqual({ key: "cppr", dir: "asc" });
  });

  it("reads the latest BACKED trend point, skipping unbacked tail days", () => {
    const points = [
      { date: "2026-01-01", windowStartDate: "2026-01-01", costPerOutcomeUsd: 10 as number | null, windowOutcomeCount: 1, windowSpentUsd: 10 },
      { date: "2026-01-02", windowStartDate: "2026-01-01", costPerOutcomeUsd: 20 as number | null, windowOutcomeCount: 1, windowSpentUsd: 20 },
      { date: "2026-01-03", windowStartDate: "2026-01-01", costPerOutcomeUsd: null as number | null, windowOutcomeCount: 0, windowSpentUsd: 0 },
    ];
    expect(latestCost(points)).toBe(20);
    expect(latestCost([])).toBeNull();
    expect(latestCost(undefined)).toBeNull();
  });

  it("computes the weekly change against a point about a week back", () => {
    const points = Array.from({ length: 9 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      windowStartDate: "2026-01-01",
      costPerOutcomeUsd: 100 as number | null,
      windowOutcomeCount: 1,
      windowSpentUsd: 100,
    }));
    points[8].costPerOutcomeUsd = 120;
    expect(growth7d(points)).toBeCloseTo(0.2, 5);
    expect(growth7d([])).toBeNull();
  });
});

describe("feature-stats outcome catalogue", () => {
  it("keeps one entry per maximization objective plus the all-time-only Sales row", () => {
    expect(OBJECTIVES.map((o) => o.key)).toEqual([
      "websiteVisit",
      "positiveReply",
      "signup",
      "formSubmission",
      "meetingBooked",
      "purchase",
    ]);
    expect(SALES_OBJECTIVE.key).toBe("sales");
  });

  it("is read by the pages instead of being restated in them", () => {
    for (const src of [economics, details]) {
      expect(src).toContain('from "@/lib/feature-stats-objectives"');
      expect(src).not.toContain('label: "Cost per positive reply"');
    }
  });
});
