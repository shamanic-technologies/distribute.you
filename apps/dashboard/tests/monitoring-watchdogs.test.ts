import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { BoxChecksSchema, EXPECTED_BOX_CHECKS, agoLabel, boxCheckName, cadenceLabel, durationLabel } from "../src/lib/monitoring/box-checks";

/**
 * BOX-WATCHDOGS-1030: every watchdog cron on the production box reports each run to features-service (#2157) instead of
 * emailing Kevin (owner 2026-10-29 « Why do U receive this??? »), read through api-service's staff passthrough onto
 * Monitoring > Box > Watchdogs; red on the hub is the alert. The fixture is the real production read of 2026-10-30: social
 * posting broken (X token refresh), five working, our own org's credit not run yet.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "features-box-checks-fixture.json"), "utf8"));

describe("Monitoring > Box > Watchdogs: features-service's read parses as served", () => {
  it("the whole production payload parses: red, broken first, a not-yet check with nulls", () => {
    const d = BoxChecksSchema.parse(fixture());
    expect(d.status).toBe("red");
    expect(d.brokenCount).toBe(1);
    expect(d.checks[0].verdict).toBe("broken");
    const notYet = d.checks.find((c) => c.verdict === "not_yet");
    expect(notYet?.label).toBeNull();
    expect(notYet?.daily).toEqual([]);
  });

  it("asks for every watchdog the box runs, so a silent one reads not yet", () => {
    expect(Object.keys(EXPECTED_BOX_CHECKS)).toEqual(["deploy-pipeline", "service-health", "workflow-queue", "jev-judgments", "own-org-balance", "social-posting"]);
    expect(boxCheckName({ check: "own-org-balance", label: null })).toBe("Our own org's credit");
    expect(boxCheckName({ check: "deploy-pipeline", label: "Deploy pipeline" })).toBe("Deploy pipeline");
    expect(boxCheckName({ check: "brand-new-check", label: null })).toBe("brand-new-check");
  });

  it("names a cadence and an age the way people read them", () => {
    expect(cadenceLabel(5)).toBe("every 5 min");
    expect(cadenceLabel(60)).toBe("every hour");
    expect(cadenceLabel(360)).toBe("every 6 h");
    expect(cadenceLabel(1440)).toBe("every day");
    expect(cadenceLabel(null)).toBeNull();
    expect(agoLabel(3.3)).toBe("3 min ago");
    expect(agoLabel(130)).toBe("2 h ago");
    expect(durationLabel(4320)).toBe("3 days");
    expect(durationLabel(1080)).toBe("18 h");
  });
});

describe("Monitoring > Box > Watchdogs: page and hub", () => {
  it("reads the staff gateway route with the expected checks, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('boxChecks: "/features/audit/box-checks"');
    expect(api).toContain("STAFF_MONITORING_PATHS.boxChecks}?days=${days}&expect=${expect}");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffBoxChecks"');
    expect(read("components/v2/monitoring-watchdogs.tsx")).toContain('["staffBoxChecks", WATCHDOG_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("box/watchdogs");
    expect(parseMonitoringPath("/box/watchdogs")).toEqual({ view: "page", page: "box/watchdogs" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "box/watchdogs" && <BoxChecksPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<BoxChecksTile href={href("box/watchdogs")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<BoxChecksTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("renders the served checks in the served order with their served reason: no client sort, no re-grading", () => {
    const src = read("components/v2/monitoring-watchdogs.tsx");
    expect(src).toContain("data.checks.map((c)");
    expect(src).toContain("check.reason");
    expect(src).not.toContain(".sort(");
  });
});
