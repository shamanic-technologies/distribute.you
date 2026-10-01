import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COST_BASIS_COOKIE, costBasisCookieAssignment, costBasisFromCookie } from "../src/lib/v2/cost-basis-cookie";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

describe("staff cost basis: one cookie, user by default", () => {
  it("reads actual only when the cookie says actual", () => {
    expect(costBasisFromCookie(undefined)).toBe("user");
    expect(costBasisFromCookie("")).toBe("user");
    expect(costBasisFromCookie(`a=1; ${COST_BASIS_COOKIE}=actual; b=2`)).toBe("actual");
    expect(costBasisFromCookie(`${COST_BASIS_COOKIE}=nonsense`)).toBe("user");
    expect(costBasisFromCookie(`x${COST_BASIS_COOKIE}=actual`)).toBe("user");
  });
  it("round-trips through its own assignment", () => {
    const set = costBasisCookieAssignment("actual").split(";")[0];
    expect(costBasisFromCookie(set)).toBe("actual");
    expect(costBasisCookieAssignment("user")).toContain("path=/");
  });
  it("a non-staff reader always gets the user basis", () => {
    const hook = read("lib/v2/use-cost-basis.ts");
    expect(hook).toContain('const basis: CostBasis = isStaff ? stored : "user";');
  });
});

describe("the switch sits in the top bar of every page that states costs", () => {
  for (const f of ["components/v2/workflows-page.tsx", "components/v2/workflow-page.tsx", "components/v2/research-page.tsx", "components/v2/research-catalog.tsx"]) {
    it(f, () => {
      const src = read(f);
      const bars = src.match(/<TopBar\b[\s\S]*?\/>/g) ?? [];
      expect(bars.length).toBeGreaterThan(0);
      for (const b of bars) expect(b).toContain("<CostBasisSwitch />");
    });
  }
  it("the workflow page no longer keeps a basis of its own", () => {
    const src = read("components/v2/workflow-page.tsx");
    expect(src).not.toContain('useState<"user" | "actual">');
  });
});

const RESEARCH_ROUTE = join("app", "(authed)", "api", "research", "[basis]", "[part]", "route.ts");

describe("no research snapshot reaches a browser bundle (billed or actual)", () => {
  it("only the staff route imports a research JSON file", () => {
    const importers = walk(SRC).filter((p) => /lib\/research\/(actual\/)?research[\w-]*\.json|\.\/research[\w-]*\.json/.test(readFileSync(p, "utf8")));
    expect(importers.map((p) => p.slice(SRC.length + 1))).toEqual([RESEARCH_ROUTE]);
  });
  it("the route refuses anyone off the staff list", () => {
    const route = read(RESEARCH_ROUTE);
    expect(route).toContain("isAdminEmail(sessionClaims?.email)");
    expect(route).toContain("status: 403");
    expect(route).not.toMatch(/^"use client"/m);
  });
  it("the actual snapshot states its basis", () => {
    const file = JSON.parse(read("lib/research/actual/research.json"));
    expect(file.costBasis).toBe("actual");
    const billed = JSON.parse(read("lib/research/research.json"));
    expect(billed.costBasis).toBe("user");
  });
});

describe("the staff actual-cost reads are never written to disk", () => {
  it("their roots are in the never-persisted set", () => {
    const src = read("lib/persist-cache.ts");
    for (const root of ["workflowRankLadderActual", "campaignWorkflowRevenueActual", "workflowRunsActual"]) {
      expect(src.slice(src.indexOf("export const SENSITIVE_QUERY_ROOTS"), src.indexOf("export const PERSISTABLE_QUERY_ROOTS"))).toContain(`"${root}"`);
    }
  });
  it("a run with unpriced rows states no actual cost rather than its priced part", () => {
    expect(read("components/v2/workflow-page.tsx")).toContain("vendorCents: r.unpricedCostNames.length ? null");
  });
});
