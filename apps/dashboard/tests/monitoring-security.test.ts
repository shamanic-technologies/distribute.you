import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { SecurityAdvisoriesSchema, statusWord } from "../src/lib/monitoring/security-advisories";

/**
 * SEC-ADVISORIES-MONITORING-1025: a daily audit of every prod repo is stored in features-service (#2083) and read
 * through api-service's staff passthrough (#1382) onto Monitoring > Security > Advisories; red on the hub is the alert.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "features-security-advisories-fixture.json"), "utf8"));

describe("Monitoring > Security: features-service's read parses as served", () => {
  it("the whole payload parses: one red repo first, a missing day with null counts", () => {
    const d = SecurityAdvisoriesSchema.parse(fixture());
    expect(d.status).toBe("red");
    expect(d.repos[0].repo).toBe("api-service");
    expect(d.repos[0].status).toBe("red");
    const gap = d.daily.find((x) => x.day === "2026-10-18")!;
    expect(gap.reported).toBe(false);
    expect(gap.critical).toBeNull();
    expect(d.repos[1].series.find((x) => x.day === "2026-10-18")!.status).toBe("missing");
  });

  it("nothing reported yet parses too (null latest day, no repo)", () => {
    const d = SecurityAdvisoriesSchema.parse({
      ...fixture(),
      status: "red",
      stale: true,
      lastReportAt: null,
      hoursSinceLastReport: null,
      latestDay: null,
      redRepos: [],
      repos: [],
    });
    expect(d.latestDay).toBeNull();
  });

  it("the status word is the producer's own, capitalised", () => {
    expect(statusWord("missing")).toBe("Missing");
    expect(statusWord("red")).toBe("Red");
  });
});

describe("Monitoring > Security: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('securityAdvisories: "/features/audit/security-advisories"');
    expect(api).toContain("STAFF_MONITORING_PATHS.securityAdvisories");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffSecurityAdvisories"');
    expect(read("components/v2/monitoring-security.tsx")).toContain('["staffSecurityAdvisories", SECURITY_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("security/advisories");
    expect(parseMonitoringPath("/security/advisories")).toEqual({ view: "page", page: "security/advisories" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "security/advisories" && <SecurityAdvisoriesPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<SecurityAdvisoriesTile href={href("security/advisories")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<SecurityAdvisoriesTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("the tile and the page render the served verdict and order: no client sort", () => {
    const src = read("components/v2/monitoring-security.tsx");
    expect(src).toContain("data.reason");
    expect(src).not.toMatch(/\.sort\(/);
    // a day without a report is a pale gap, never a zero bar
    expect(src).toContain('state={(d) => (d.reported ? null : "missing")}');
  });
});
