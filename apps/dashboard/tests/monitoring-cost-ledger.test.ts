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
  outcomeShare,
  rolloutInProgress,
  serviceNames,
  servicesOn,
  supportCents,
  supportFunctions,
  supportNotSplit,
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

  it("a payload stored before the support split still parses, and shows no share rather than the old one", () => {
    const c = coverage();
    expect(c.fleet.every((p) => p.outcomeSpendCoveragePct === undefined)).toBe(true);
    expect(headlinePoint(c)).toBeNull();
    expect(rolloutInProgress(c)).toBe(true);
    expect(supportFunctions(c)).toEqual([]);
  });

  it("the first declared dollar ends the rollout; a share at the target is not red; no spend = no verdict", () => {
    const c = coverage();
    const wired = { ...c, services: c.services.map((s, i) => (i === 0 ? { ...s, coveredGrossCents: "1.0000000000" } : s)) };
    expect(rolloutInProgress(wired)).toBe(false);
    const p = c.fleet[0];
    expect(belowTarget({ ...p, outcomeSpendCoveragePct: String(COVERAGE_TARGET_PCT) })).toBe(false);
    expect(belowTarget({ ...p, outcomeSpendCoveragePct: "94.99" })).toBe(true);
    expect(belowTarget({ ...p, outcomeSpendCoveragePct: null })).toBe(false);
    expect(belowTarget(null)).toBe(false);
  });

  it("the chart has one point per served fleet day, each service's served % on its day", () => {
    const c = coverage();
    const pts = coverageChart(c);
    expect(pts.map((p) => p.day)).toEqual(c.fleet.map((p) => p.day));
    const s = c.services[0];
    expect(pts.find((p) => p.day === s.day)!.services[s.serviceName]).toBeNull();
    expect(serviceNames(c)).toContain("instantly-service");
  });

  it("day tables keep the producer's rows for that day only", () => {
    const c = OutcomeCoverageSchema.parse(fixture("runs-outcome-coverage-prod-2026-10-24.json"));
    const day = headlinePoint(c)!.day;
    expect(servicesOn(c, day).every((s) => s.day === day)).toBe(true);
    expect(tasksOn(c, day).length).toBe(c.tasks.filter((t) => t.day === day).length);
  });
});

describe("COST-SUPPORT-1024-DASH: the share reads outcome spend only, support apart (runs-service v0.47.71)", () => {
  const split = () => OutcomeCoverageSchema.parse(fixture("runs-outcome-coverage-prod-2026-10-24.json"));

  it("the 2026-10-24 prod payload parses with the support fields", () => {
    const c = split();
    expect(c.supportComplete).toBe(true);
    expect(c.supportDaysMissing).toEqual([]);
    expect(c.fleet.every((p) => p.outcomeSpendCoveragePct !== undefined && p.supportByFunction !== undefined)).toBe(true);
  });

  it("headline, red bar and chart read outcomeSpendCoveragePct, never coveragePct", () => {
    const c = split();
    const day = c.fleet[c.fleet.length - 2];
    const shifted = { ...c, fleet: c.fleet.map((p) => (p.day === day.day ? { ...p, coveragePct: "40.00", outcomeSpendCoveragePct: "96.00" } : p)) };
    const at = headlinePoint(shifted)!;
    expect(at.day).toBe(day.day);
    expect(belowTarget(at)).toBe(false);
    expect(coverageChart(shifted).find((p) => p.day === day.day)!.fleet).toBe(96);
    const svc = { ...c, services: c.services.map((s, i) => (i === 0 ? { ...s, coveragePct: "1.00", outcomeSpendCoveragePct: "99.00" } : s)) };
    expect(coverageChart(svc).find((p) => p.day === c.services[0].day)!.services[c.services[0].serviceName]).toBe(99);
  });

  it("support is shown per function, in the producer's order, only functions that spent", () => {
    const c = split();
    const d = c.fleet[c.fleet.length - 2].day;
    const marked = {
      ...c,
      fleet: c.fleet.map((p) =>
        p.day === d
          ? { ...p, supportGrossCents: "300.0000000000", supportByFunction: { copilot: { grossCents: "200.0000000000", netCents: "200.0000000000" }, payment_fees: { grossCents: "100.0000000000", netCents: "100.0000000000" }, brand_setup: { grossCents: "0.0000000000", netCents: "0.0000000000" } } }
          : p,
      ),
    };
    expect(supportFunctions(marked).map((f) => f.label)).toEqual(["Payment fees", "Copilot"]);
    const p = marked.fleet.find((x) => x.day === d)!;
    expect(supportCents(p, "copilot")).toBe(200);
    expect(supportCents(p, "retired_product")).toBe(0);
    expect(supportFunctions(c)).toEqual([]);
  });

  it("a day stored before the split is said on the chart (prod served 10-18 and 10-19 so at 13:00 UTC)", () => {
    const c = { ...split(), supportComplete: false, supportDaysMissing: ["2026-10-18", "2026-10-19"] };
    expect(supportNotSplit(c, "2026-10-18")).toBe(true);
    expect(supportNotSplit(c, "2026-10-23")).toBe(false);
    expect(coverageChart(c).find((p) => p.day === "2026-10-19")!.supportNotSplit).toBe(true);
    const src = stripComments(read("components/v2/monitoring-cost-ledger.tsx"));
    expect(src).toContain("Support not split yet on");
    expect(src).toContain("<SupportSection data={data} />");
    expect(src).not.toContain(".coveragePct");
    expect(stripComments(read("components/v2/monitoring-page.tsx"))).not.toContain(".coveragePct");
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
