import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deprecatedPartsWords, performanceByTab, servedNowReasonWords, untestedCount, visibleRows } from "../src/lib/research/performance";
import { parseResearchPath, researchCatalogHref, RESEARCH_TABS } from "../src/lib/research/research";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("Research Performance tab (owner 2026-10-23, RESEARCH-PERFORMANCE-1023)", () => {
  it("is the 4th tab of an Engine measure and has its own route", () => {
    expect(RESEARCH_TABS).toEqual(["scripts", "templates", "llms", "performance"]);
    expect(parseResearchPath("engines/email_sent~start~conversation/performance")).toEqual({ view: "performance", measure: "email_sent/start/conversation" });
    expect(parseResearchPath("engines/email_sent~start~conversation/performance/x").view).toBe("missing");
    expect(researchCatalogHref("/r", "website_visit/start/website_visit", "performance")).toBe("/r/engines/website_visit~start~website_visit/performance");
  });

  it("splits rows into tabs on the SERVED status, in the served order (RESEARCH-COMBO-STATUS-1023)", () => {
    const rows = [
      { k: "a", status: "active" as const },
      { k: "deepseek-pro", status: "deprecated" as const },
      { k: "c", status: "active" as const },
    ];
    const t = performanceByTab(rows);
    expect(t.active.map((r) => r.k)).toEqual(["a", "c"]);
    expect(t.deprecated.map((r) => r.k)).toEqual(["deepseek-pro"]);
  });

  it("a deprecated row says which part made it so, in plain words", () => {
    expect(deprecatedPartsWords(["llm"])).toBe("LLM retired");
    expect(deprecatedPartsWords(["script", "template"])).toBe("Script deprecated · Template deprecated");
    expect(deprecatedPartsWords([])).toBeNull();
  });

  it("the page never re-derives a combination's status", () => {
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).toContain("performanceByTab(rows)");
    expect(page).toContain("deprecatedPartsWords(row.deprecatedParts)");
    for (const banned of ["combinationStatus", "modelStatus", "useModelStatuses", "useTemplateStatuses", "useScriptWords"]) expect(page).not.toContain(banned);
  });

  it("the page renders served figures, never sorts or divides", () => {
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).not.toMatch(/\.sort\(/);
    expect(page).toContain("useResearchPerformance(basis)");
    expect(src("src/app/(authed)/api/research/[basis]/[part]/route.ts")).toContain('"performance"');
    expect(src("src/components/v2/research-page.tsx")).toContain("<V2ResearchPerformanceView");
  });

  it("hides untested rows by default, the toggle shows them in the served order (PERF-COST-ORDER-1024)", () => {
    const rows = [
      { k: "u1", untested: true },
      { k: "u2", untested: true },
      { k: "a", untested: false },
      { k: "b", untested: false },
    ];
    expect(visibleRows(rows, false).map((r) => r.k)).toEqual(["a", "b"]);
    expect(visibleRows(rows, true).map((r) => r.k)).toEqual(["u1", "u2", "a", "b"]);
    expect(untestedCount(rows)).toBe(2);
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).toContain("useState(false)");
    expect(page).toContain('tab === "active" ? visibleRows(byTab.active, showUntested) : byTab.deprecated');
    expect(page).toContain("Show untested (");
  });

  it("the running combination is servedNow's row in the table's own columns, never re-derived", () => {
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).toContain("served={perf?.servedNow ?? null}");
    expect(page).toContain("<ComboRow row={served.row} nav={nav} />");
    expect(page).toContain("Running now");
    // Both tables share one header and one row component.
    expect(page.match(/<ComboHead /g)?.length).toBe(2);
    expect(servedNowReasonWords("combination_not_listed")).toBe("This combination has no row in the table yet.");
    expect(servedNowReasonWords("no_llm_picked")).toBe("No LLM is picked for this Engine yet.");
    expect(servedNowReasonWords("no_runnable_script")).toBe("No script can run on this Engine right now.");
  });

  it("no estimated or expected figure on a row any more (owner 2026-10-24)", () => {
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).not.toContain("estimated");
    expect(page).not.toContain('tag="expected"');
    expect(src("src/lib/research/performance.ts")).not.toContain("PerformanceEstimate");
  });
});
