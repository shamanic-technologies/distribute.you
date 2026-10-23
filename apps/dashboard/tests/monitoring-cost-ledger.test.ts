import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import {
  COVERAGE_TARGET_PCT,
  LedgerCheckSchema,
  OutcomeCoverageSchema,
  belowTarget,
  coverageChart,
  headlinePoint,
  rolloutInProgress,
  serviceNames,
  servicesOn,
  tasksOn,
} from "../src/lib/monitoring/cost-ledger";

/**
 * COST-ACCOUNTING-1023-MONITOR: runs-service is the general ledger (v0.47.60). Its two stored reads
 * (outcome coverage, to-the-cent check) are read through the gateway onto Monitoring > Cost ledger;
 * red on the hub is the alert. Fixtures are the prod payloads of 2026-10-23 (no service declares yet).
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
const coverage = () => OutcomeCoverageSchema.parse(fixture("runs-outcome-coverage-prod-2026-10-23.json"));
const check = () => LedgerCheckSchema.parse(fixture("runs-ledger-check-prod-2026-10-23.json"));

describe("Monitoring > Cost ledger: runs-service's reads parse as served in prod (2026-10-23)", () => {
  it("the whole coverage payload parses: fleet, services, tasks", () => {
    const c = coverage();
    expect(c.fleet.length).toBeGreaterThan(1);
    expect(c.services.length).toBeGreaterThan(0);
    expect(c.tasks.length).toBeGreaterThan(0);
  });

  it("the whole ledger check parses, balanced with days still missing", () => {
    const l = check();
    expect(l.balanced).toBe(true);
    expect(l.complete).toBe(false);
    expect(l.daysMissing.length).toBeGreaterThan(0);
    expect(l.mismatches).toEqual([]);
  });

  it("reads ~0% and 'rollout in progress' while no service declares, so the hub is red", () => {
    const c = coverage();
    const at = headlinePoint(c)!;
    expect(at.complete).toBe(true);
    expect(at.day).toBe("2026-10-22");
    expect(Number(at.coveragePct)).toBe(0);
    expect(rolloutInProgress(c)).toBe(true);
    expect(belowTarget(at)).toBe(true);
  });

  it("the first declared dollar ends the rollout; a share at the target is not red; no spend = no verdict", () => {
    const c = coverage();
    const wired = { ...c, services: c.services.map((s, i) => (i === 0 ? { ...s, coveredGrossCents: "1.0000000000" } : s)) };
    expect(rolloutInProgress(wired)).toBe(false);
    const p = c.fleet[0];
    expect(belowTarget({ ...p, coveragePct: String(COVERAGE_TARGET_PCT) })).toBe(false);
    expect(belowTarget({ ...p, coveragePct: "94.99" })).toBe(true);
    expect(belowTarget({ ...p, coveragePct: null })).toBe(false);
    expect(belowTarget(null)).toBe(false);
  });

  it("the chart has one point per served fleet day, each service's served % on its day", () => {
    const c = coverage();
    const pts = coverageChart(c);
    expect(pts.map((p) => p.day)).toEqual(c.fleet.map((p) => p.day));
    const s = c.services[0];
    expect(pts.find((p) => p.day === s.day)!.services[s.serviceName]).toBe(Number(s.coveragePct));
    expect(serviceNames(c)).toContain("instantly-service");
  });

  it("day tables keep the producer's rows for that day only", () => {
    const c = coverage();
    const day = headlinePoint(c)!.day;
    expect(servicesOn(c, day).every((s) => s.day === day)).toBe(true);
    expect(tasksOn(c, day).length).toBe(c.tasks.filter((t) => t.day === day).length);
  });
});

describe("Monitoring > Cost ledger: page and hub", () => {
  it("both pages are mounted, chipped and carded; their red tiles sit above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("ledger/coverage");
    expect(MONITORING_PAGES).toContain("ledger/check");
    expect(parseMonitoringPath("/ledger/check")).toEqual({ view: "page", page: "ledger/check" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "ledger/coverage" && <OutcomeCoveragePage />');
    expect(page).toContain('view.page === "ledger/check" && <LedgerCheckPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<OutcomeCoverageTile href={href("ledger/coverage")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<OutcomeCoverageTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub.indexOf("<LedgerCheckTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="ledger/coverage"');
    expect(hub).toContain('page="ledger/check"');
  });

  it("renders served figures: no client sort, no browser sum or division of money", () => {
    const src = stripComments(read("components/v2/monitoring-cost-ledger.tsx"));
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
    expect(src).toContain("rollout in progress");
    expect(src).toContain("COVERAGE_TARGET_PCT");
    const lib = stripComments(read("lib/monitoring/cost-ledger.ts"));
    expect(lib).not.toMatch(/\.reduce\(|\.sort\(/);
  });

  it("reads the gateway's staff passthroughs, and the roots are never persisted", () => {
    const api = read("lib/api.ts");
    expect(api).toContain("STAFF_COST_LEDGER_PATHS.coverage");
    expect(api).toContain("?rows=false");
    const cache = read("lib/persist-cache.ts");
    const sensitive = cache.slice(cache.indexOf("export const SENSITIVE_QUERY_ROOTS"), cache.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffOutcomeCoverage"');
    expect(sensitive).toContain('"staffLedgerCheck"');
  });
});
