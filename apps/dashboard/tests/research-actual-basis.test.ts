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
const CONCLUSIONS_ROUTE = join("app", "api", "internal", "research", "conclusions", "route.ts");
// The second service-key reader (social-service reads every measured study, quotable only when a conclusion).
const STUDIES_ROUTE = join("app", "api", "internal", "research", "studies", "route.ts");
// The server-only reader of the live Research file, catalogue and template texts (features-service).
const LIVE_FILE = join("lib", "research", "live-file.ts");

describe("Research keeps no snapshot: every byte is read live, server-side, staff only", () => {
  it("no source file imports a Research JSON, and none is left in the tree", () => {
    const importers = walk(SRC).filter((p) => /research[\w-]*\.json/.test(readFileSync(p, "utf8")));
    expect(importers.map((p) => p.slice(SRC.length + 1))).toEqual([]);
    expect(walk(join(SRC, "lib", "research"), []).some((p) => p.endsWith(".json"))).toBe(false);
  });
  it("the live reader reads the three gateway lines and keeps no fallback", () => {
    const live = read(LIVE_FILE);
    for (const path of ["/v1/features/research?basis=", "/v1/features/research/catalog?basis=", "/v1/features/research/templates"]) expect(live).toContain(path);
    expect(live).not.toMatch(/snapshot\b(?! is kept)/i);
  });
  it("the live reader is imported by server routes only", () => {
    const importers = walk(SRC).filter((p) => readFileSync(p, "utf8").includes('from "@/lib/research/live-file"'));
    expect(importers.map((p) => p.slice(SRC.length + 1)).sort()).toEqual([RESEARCH_ROUTE, CONCLUSIONS_ROUTE, STUDIES_ROUTE].sort());
  });
  it.each([CONCLUSIONS_ROUTE, STUDIES_ROUTE])("the service-key route %s reads the billed file only, behind the service key", (path) => {
    const route = read(path);
    expect(route).toContain("verifyServiceKey(req)");
    expect(route).toContain("status: 401");
    expect(route).toContain('readLiveResearch("user"');
    expect(route).not.toContain("readLiveCatalog");
    expect(route).not.toContain('"actual"');
  });
  it("the route refuses anyone off the staff list, and a failed live read is an error, never an older copy", () => {
    const route = read(RESEARCH_ROUTE);
    expect(route).toContain("isAdminEmail(sessionClaims?.email)");
    expect(route).toContain("status: 403");
    expect(route).toContain("status: 502");
    expect(route).not.toMatch(/^"use client"/m);
  });
  it("the hub marks no study as a snapshot", () => {
    expect(read("components/v2/research-page.tsx")).not.toMatch(/Snapshot|liveReason|source === "/);
    expect(read("components/v2/research-bits.tsx")).not.toContain("snapshot");
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
