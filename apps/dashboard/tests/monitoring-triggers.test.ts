import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { TriggerReportsSchema, reasonName, triggerName } from "../src/lib/monitoring/trigger-reports";

/**
 * TRIGGER-REPORTS-MONITORING-1027: crm-service serves whether each trigger report (form, WhatsApp number, positive
 * reply, account event) reached its campaign (crm #214), read through api-service's staff passthrough (#1386) onto
 * Monitoring > Triggers > Reports; red on the hub is the alert. The fixture is the real production read of 2026-10-27
 * 13:48 UTC (7 WhatsApp numbers and 2 positive replies stuck on "offer_unknown").
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "crm-trigger-reports-fixture.json"), "utf8"));

describe("Monitoring > Triggers: crm-service's read parses as served", () => {
  it("the whole production payload parses: red, its stuck reports and reasons, a daily series per trigger", () => {
    const d = TriggerReportsSchema.parse(fixture());
    expect(d.status).toBe("red");
    expect(d.stuckAfterMinutes).toBe(15);
    expect(d.triggers.map((t) => t.trigger)).toEqual(["form_submitted", "whatsapp_number_given", "positive_reply_received", "account_event"]);
    const wa = d.triggers[1];
    expect(wa.status).toBe("red");
    expect(wa.stuck).toBe(7);
    expect(wa.stuckReports[0].reason).toBe("offer_unknown");
    // a stuck report not tried yet carries no reason: null, never a guess
    expect(d.triggers[2].stuckByReason.some((b) => b.reason === null)).toBe(true);
  });

  it("names triggers and reasons the way people read them, an unknown one as served", () => {
    expect(triggerName("whatsapp_number_given")).toBe("WhatsApp number given");
    expect(triggerName("something_new")).toBe("something_new");
    expect(reasonName(null)).toBe("Not sent yet");
    expect(reasonName("offer_unknown")).toBe("No offer to report it on");
  });
});

describe("Monitoring > Triggers: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('triggerReports: "/crm/ops/trigger-reports"');
    expect(api).toContain("STAFF_MONITORING_PATHS.triggerReports");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffTriggerReports"');
    expect(read("components/v2/monitoring-triggers.tsx")).toContain('["staffTriggerReports", TRIGGER_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("triggers/reports");
    expect(parseMonitoringPath("/triggers/reports")).toEqual({ view: "page", page: "triggers/reports" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "triggers/reports" && <TriggerReportsPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<TriggerReportsTile href={href("triggers/reports")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<TriggerReportsTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("draws the served verdict and series in served order: no client sort, no sum", () => {
    const src = read("components/v2/monitoring-triggers.tsx");
    expect(src).toContain('t.status === "red"');
    expect(src).toContain("t.stuckReports.map");
    expect(src).toContain("t.byDay.map");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
  });
});
