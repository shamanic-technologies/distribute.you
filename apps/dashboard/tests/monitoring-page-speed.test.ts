import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { BoxChecksSchema, EXPECTED_BOX_CHECKS } from "../src/lib/monitoring/box-checks";
import { PAGE_SPEED_PREFIX, PAGE_SPEED_WATCHDOG, pageName, pageSpeedDetails, secondsLabel } from "../src/lib/monitoring/page-speed";

/**
 * DASH-SPEED-MONITOR-1110 (owner 2026-11-09 « make every page instant. Why do I have to ask again every day? »): a daily
 * robot times every dashboard v2 page of our own Distribute.you brand and posts one box-checks run per page
 * (`page-speed-<page>`); Monitoring > Box > Page speed draws them, red over 1 s. The fixture is the served shape built
 * from the robot's first run (Today, Companies, People over budget) plus one page under budget.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "features-page-speed-fixture.json"), "utf8"));

describe("Page speed: the served per-page checks parse and read", () => {
  it("parses as box-checks, each page's details through the page-speed reader", () => {
    const d = BoxChecksSchema.parse(fixture());
    expect(d.brokenCount).toBe(3);
    const today = pageSpeedDetails(d.checks[0]);
    expect(today?.warmMs).toBe(21377);
    expect(today?.inAppMs).toBeNull();
    expect(today?.slowestRead?.ms).toBe(49037);
    expect(pageSpeedDetails(d.checks[1])?.inAppFrom).toBe("Today");
    expect(d.checks[3].verdict).toBe("ok");
  });

  it("an unknown details shape reads null, never a made-up figure", () => {
    expect(pageSpeedDetails({ check: "page-speed-x", latestDetails: { warmMs: "fast" } })).toBeNull();
    expect(pageSpeedDetails({ check: "page-speed-x", latestDetails: null })).toBeNull();
  });

  it("names a page and a time the way people read them", () => {
    expect(pageName({ check: "page-speed-companies", label: "Page speed: Companies" })).toBe("Companies");
    expect(pageName({ check: "page-speed-x", label: null })).toBe("page-speed-x");
    expect(secondsLabel(640)).toBe("0.64 s");
    expect(secondsLabel(1000)).toBe("1 s");
    expect(secondsLabel(13100)).toBe("13.1 s");
    expect(secondsLabel(30000, true)).toBe("over 30 s");
  });
});

describe("Page speed: page, hub, and the watchdogs list", () => {
  it("reads only the per-page checks; the watchdogs list leaves them out but keeps the robot's own run", () => {
    const api = read("lib/api.ts");
    expect(api).toContain("export async function getStaffPageSpeed(");
    expect(api).toContain("&prefix=${PAGE_SPEED_PREFIX}");
    expect(api).toContain("&excludePrefix=${PAGE_SPEED_PREFIX}");
    expect(PAGE_SPEED_PREFIX).toBe("page-speed-");
    expect(PAGE_SPEED_WATCHDOG.startsWith(PAGE_SPEED_PREFIX)).toBe(false);
    expect(EXPECTED_BOX_CHECKS[PAGE_SPEED_WATCHDOG]).toBe("Page speed robot");
  });

  it("rides the watchdogs root (never persisted to disk) under its own key", () => {
    expect(read("components/v2/monitoring-page-speed.tsx")).toContain('["staffBoxChecks", "page-speed", PAGE_SPEED_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows and a card in Box", () => {
    expect(MONITORING_PAGES).toContain("box/page-speed");
    expect(parseMonitoringPath("/box/page-speed")).toEqual({ view: "page", page: "box/page-speed" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "box/page-speed" && <PageSpeedPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<PageSpeedTile href={href("box/page-speed")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<PageSpeedTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="box/page-speed"');
  });

  it("draws served rows in the served order: no client sort, no re-grading", () => {
    const src = read("components/v2/monitoring-page-speed.tsx");
    expect(src).toContain("data.checks.map((c)");
    expect(src).toContain('check.verdict === "broken"');
    expect(src).not.toContain(".sort(");
  });
});
