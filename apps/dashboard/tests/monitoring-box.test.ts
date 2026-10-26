import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { BoxHealthSchema, containerLabel, memLabel } from "../src/lib/monitoring/box-health";

/**
 * BOX-OVERLOAD-1026-MONITORING: the production box posts a sample every 5 minutes to features-service (#2091), read
 * through api-service's staff passthrough (#1384) onto Monitoring > Box > Load and memory; red on the hub is the alert.
 * The fixture is the real production read of 2026-10-26 (load 27, swap 94% full, sysstat backfill + live samples).
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "features-box-health-fixture.json"), "utf8"));

describe("Monitoring > Box: features-service's read parses as served", () => {
  it("the whole production payload parses: red with its reasons, daily, 48 h and the top containers", () => {
    const d = BoxHealthSchema.parse(fixture());
    expect(d.status).toBe("red");
    expect(d.reasons.length).toBeGreaterThan(0);
    expect(d.thresholds.load5Max).toBe(12);
    expect(d.thresholds.memAvailableMinMb).toBe(1024);
    expect(d.thresholds.swapUsedPctMax).toBe(50);
    expect(d.daily.length).toBeGreaterThan(1);
    expect(d.recent.length).toBeGreaterThan(1);
    expect(d.topContainers.byCpu[0].name).toBe("distribute-postgres-1");
    // a backfilled day carries no OOM count: null, never zero
    expect(d.daily[0].oomKills).toBeNull();
  });

  it("no sample ever parses too (null latest, null load limit, nothing in the series)", () => {
    const f = fixture();
    const d = BoxHealthSchema.parse({
      ...f,
      stale: true,
      minutesSinceLastSample: null,
      thresholds: { ...f.thresholds, load5Max: null },
      latest: null,
      daily: [],
      recent: [],
      topContainers: { ...f.topContainers, sampleCount: 0, byCpu: [], byMemory: [] },
    });
    expect(d.latest).toBeNull();
  });

  it("names a container and a memory figure the way people read them", () => {
    expect(containerLabel("distribute-postgres-1")).toBe("postgres");
    expect(memLabel(1552)).toBe("1.5 GB");
    expect(memLabel(820)).toBe("820 MB");
  });
});

describe("Monitoring > Box: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('boxHealth: "/features/audit/box-health"');
    expect(api).toContain("STAFF_MONITORING_PATHS.boxHealth");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffBoxHealth"');
    expect(read("components/v2/monitoring-box.tsx")).toContain('["staffBoxHealth", BOX_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("box/load");
    expect(parseMonitoringPath("/box/load")).toEqual({ view: "page", page: "box/load" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "box/load" && <BoxHealthPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<BoxHealthTile href={href("box/load")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<BoxHealthTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("renders the served verdict, thresholds and order: no client sort, no re-grading", () => {
    const src = read("components/v2/monitoring-box.tsx");
    expect(src).toContain("data.reasons.map");
    expect(src).toContain('data.status === "red"');
    expect(src).toContain("t.memAvailableMinMb");
    expect(src).toContain("t.swapUsedPctMax");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
  });
});
