import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deprecatedPartsWords, performanceByTab } from "../src/lib/research/performance";
import { parseResearchPath, researchCatalogHref, RESEARCH_TABS } from "../src/lib/research/research";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("Research Performance tab (owner 2026-10-23, RESEARCH-PERFORMANCE-1023)", () => {
  it("is the 4th tab of a pipe and has its own route", () => {
    expect(RESEARCH_TABS).toEqual(["workflows", "templates", "models", "performance"]);
    expect(parseResearchPath("cold-email-positive-reply/performance")).toEqual({ view: "performance", pipe: "cold-email-positive-reply" });
    expect(parseResearchPath("cold-email-positive-reply/performance/x").view).toBe("missing");
    expect(researchCatalogHref("/r", "cold-email-website-visit", "performance")).toBe("/r/cold-email-website-visit/performance");
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
    expect(deprecatedPartsWords(["workflow", "template"])).toBe("Workflow deprecated · Template deprecated");
    expect(deprecatedPartsWords([])).toBeNull();
  });

  it("the page never re-derives a combination's status", () => {
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).toContain("performanceByTab(rows)");
    expect(page).toContain("deprecatedPartsWords(row.deprecatedParts)");
    for (const banned of ["combinationStatus", "modelStatus", "useModelStatuses", "useTemplateStatuses", "useDynastyStatuses"]) expect(page).not.toContain(banned);
  });

  it("the page renders served figures, never sorts or divides", () => {
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).not.toMatch(/\.sort\(/);
    expect(page).toContain("useResearchPerformance(basis)");
    expect(src("src/app/(authed)/api/research/[basis]/[part]/route.ts")).toContain('"performance"');
    expect(src("src/components/v2/research-page.tsx")).toContain("<V2ResearchPerformanceView");
  });
});
