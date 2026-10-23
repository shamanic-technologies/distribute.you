import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { combinationStatus, performanceByTab } from "../src/lib/research/performance";
import { parseResearchPath, researchCatalogHref, RESEARCH_TABS } from "../src/lib/research/research";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("Research Performance tab (owner 2026-10-23, RESEARCH-PERFORMANCE-1023)", () => {
  it("is the 4th tab of a pipe and has its own route", () => {
    expect(RESEARCH_TABS).toEqual(["workflows", "templates", "models", "performance"]);
    expect(parseResearchPath("cold-email-positive-reply/performance")).toEqual({ view: "performance", pipe: "cold-email-positive-reply" });
    expect(parseResearchPath("cold-email-positive-reply/performance/x").view).toBe("missing");
    expect(researchCatalogHref("/r", "cold-email-website-visit", "performance")).toBe("/r/cold-email-website-visit/performance");
  });

  it("a combination is Active only when workflow, template and LLM all are", () => {
    expect(combinationStatus({ workflow: "active", template: "active", llm: "active" })).toBe("active");
    expect(combinationStatus({ workflow: "active", template: "deprecated", llm: "active" })).toBe("deprecated");
    expect(combinationStatus({ workflow: "deprecated", template: "active", llm: "active" })).toBe("deprecated");
    expect(combinationStatus({ workflow: "active", template: "active", llm: "deprecated" })).toBe("deprecated");
    // A part not on record blocks nothing; a status not answered yet leaves the row unknown.
    expect(combinationStatus({ workflow: "active", template: null, llm: null })).toBe("active");
    expect(combinationStatus({ workflow: "active", template: undefined, llm: "active" })).toBeNull();
  });

  it("splits rows into tabs in the served order", () => {
    const rows = [{ k: "a", s: "active" as const }, { k: "b", s: "deprecated" as const }, { k: "c", s: "active" as const }];
    const t = performanceByTab(rows, (r) => r.s);
    expect(t.active.map((r) => r.k)).toEqual(["a", "c"]);
    expect(t.deprecated.map((r) => r.k)).toEqual(["b"]);
  });

  it("the page renders served figures, never sorts or divides", () => {
    const page = src("src/components/v2/research-performance.tsx");
    expect(page).not.toMatch(/\.sort\(/);
    expect(page).toContain("useResearchPerformance(basis)");
    expect(src("src/app/(authed)/api/research/[basis]/[part]/route.ts")).toContain('"performance"');
    expect(src("src/components/v2/research-page.tsx")).toContain("<V2ResearchPerformanceView");
  });
});
