import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { MonitoringAlertsSchema, brokenAlerts, occurrenceClient, occurrenceWords, reasonWords } from "../src/lib/monitoring/monitoring-alerts";

/**
 * SIGNUP-EMAILS-1111-MONITORING (owner 2026-10-22 « no email in my inbox please »): transactional-email-service records
 * every staff alert instead of emailing it and serves them; Monitoring > Alerts > Raised draws them, red only where the
 * served verdict is broken. The fixture is the prod payload of 2026-11-11 (30 days), client emails and names anonymised.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "transactional-monitoring-alerts-fixture.json"), "utf8"));

describe("Alerts: the served payload parses and reads in plain words", () => {
  it("parses the whole prod population, broken first as served", () => {
    const d = MonitoringAlertsSchema.parse(fixture());
    expect(d.alerts.length).toBe(8);
    expect(brokenAlerts(d).map((a) => a.eventType)).toEqual(["campaign_failing", "provider_credits_exhausted"]);
    // Every occurrence of every type reads as a sentence, never an empty line.
    for (const a of d.alerts) for (const o of a.recent) expect(occurrenceWords(a.eventType, o).what.length).toBeGreaterThan(3);
  });

  it("says which client, which campaign, what happened", () => {
    const d = MonitoringAlertsSchema.parse(fixture());
    const failing = d.alerts.find((a) => a.eventType === "campaign_failing")!;
    const w = occurrenceWords("campaign_failing", failing.recent[0]);
    expect(w.what).toBe("Failed 8 runs in a row since Nov 11, 06:09 UTC");
    expect(w.campaign?.short).toBe("Email Replies 3cfc2aaa");
    expect(occurrenceClient(failing.recent[0], (id) => `brand ${id.slice(0, 4)}`)).toBe("brand f250");
    const credits = d.alerts.find((a) => a.eventType === "provider_credits_exhausted")!;
    expect(occurrenceWords(credits.eventType, credits.recent[0]).what).toBe("Apollo is out of credits");
    const silent = d.alerts.find((a) => a.eventType === "trigger_silent")!;
    expect(occurrenceWords(silent.eventType, silent.recent[0]).what).toMatch(/^Email Pushed Via API silent for 4\.1 days since /);
  });

  it("prints the served reason's time the way people read it", () => {
    expect(reasonWords("Raised 9 times in 30 days, last at 2026-11-11T06:48:54.141Z")).toBe("Raised 9 times in 30 days, last at Nov 11, 06:48 UTC");
  });

  it("an alert type this page does not know still reads from its facts", () => {
    const w = occurrenceWords("brand_new_alert", { raisedAt: "2026-11-11T00:00:00Z", orgId: null, campaignId: null, metadata: { orgId: "x", thing: "broke", count: "3" } });
    expect(w.what).toBe("thing: broke");
    expect(w.detail).toBe("count: 3");
  });
});

describe("Alerts: wired into Monitoring, staff only, red only on the served verdict", () => {
  it("has its page and route", () => {
    expect(MONITORING_PAGES).toContain("alerts/raised");
    expect(parseMonitoringPath("/alerts/raised")).toEqual({ view: "page", page: "alerts/raised" });
  });

  it("reads through the staff gateway path and is never written to disk", () => {
    expect(read("lib/api.ts")).toContain('monitoringAlerts: "/transactional-email/ops/monitoring-alerts"');
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffMonitoringAlerts"');
  });

  it("the hub carries the tile, and the page and tile go red only on the served verdict", () => {
    const hub = read("components/v2/monitoring-page.tsx");
    expect(hub).toContain('<MonitoringAlertsTile href={href("alerts/raised")} />');
    expect(hub).toContain('{view.page === "alerts/raised" && <MonitoringAlertsPage />}');
    const page = read("components/v2/monitoring-alerts.tsx");
    expect(page).toContain('alert.verdict === "broken"');
    expect(page).toContain("brokenAlerts(data)");
  });
});
