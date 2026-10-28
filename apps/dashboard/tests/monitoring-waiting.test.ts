import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { StuckOccurrencesSchema, waitReasonName, waitingPerson } from "../src/lib/monitoring/stuck-occurrences";

/**
 * REACTIVE-THROUGHPUT-1028: campaign-service stopped emailing `trigger_occurrence_stuck` (48 emails on 2026-10-28 about
 * people simply queued behind a newsletter burst) and serves the verdict instead (campaign-service #797), read through
 * api-service's staff passthrough onto Monitoring > Triggers > Prospects waiting; red on the hub is the alert.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "campaign-stuck-occurrences-fixture.json"), "utf8"));

describe("Monitoring > Prospects waiting: campaign-service's read parses as served", () => {
  it("the whole payload parses: red, the stuck people with campaign and reasons, queued apart, a daily series", () => {
    const d = StuckOccurrencesSchema.parse(fixture());
    expect(d.status).toBe("red");
    expect(d.stuck).toBeGreaterThan(0);
    expect(typeof d.queued).toBe("number");
    expect(d.stuckOccurrences[0].campaignName).toBeTruthy();
    expect(d.stuckOccurrences.some((o) => o.person === null)).toBe(true);
    expect(Object.keys(d.byDay[0]).sort()).toEqual(["answered", "answeredLate", "day", "failed", "skipped", "waiting"]);
  });

  it("the real production read of 2026-10-28 parses whole (ok, people queued, a daily series)", () => {
    const d = StuckOccurrencesSchema.parse(JSON.parse(readFileSync(join(__dirname, "fixtures", "campaign-stuck-occurrences-prod-1028.json"), "utf8")));
    expect(d.status).toBe("ok");
    expect(d.queued).toBeGreaterThan(0);
    expect(d.byDay.length).toBeGreaterThan(0);
  });

  it("an ok read with nobody stuck parses too", () => {
    const d = StuckOccurrencesSchema.parse({ ...fixture(), status: "ok", stuck: 0, stuckByReason: [], stuckOccurrences: [] });
    expect(d.status).toBe("ok");
  });

  it("names reasons and people in plain words, an unknown reason as served", () => {
    expect(waitReasonName("failure_backoff")).toBe("Campaign failing, waiting to retry");
    expect(waitReasonName("something_new")).toBe("something new");
    expect(waitingPerson({ person: { name: null, email: "a@b.co", phone: null } })).toBe("a@b.co");
    expect(waitingPerson({ person: null })).toBeNull();
  });
});

describe("Monitoring > Prospects waiting: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain("STAFF_MONITORING_PATHS.stuckOccurrences");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffStuckOccurrences"');
    expect(read("components/v2/monitoring-waiting.tsx")).toContain('["staffStuckOccurrences", WAITING_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("triggers/waiting");
    expect(parseMonitoringPath("/triggers/waiting")).toEqual({ view: "page", page: "triggers/waiting" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "triggers/waiting" && <ProspectsWaitingPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<ProspectsWaitingTile href={href("triggers/waiting")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<ProspectsWaitingTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("draws the served verdict, list and series in served order: no client sort, no sum", () => {
    const src = read("components/v2/monitoring-waiting.tsx");
    expect(src).toContain('data.status === "red"');
    expect(src).toContain("data.stuckOccurrences.map");
    expect(src).toContain("data.byDay.map");
    expect(src).toContain("d.answeredLate");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
  });
});
