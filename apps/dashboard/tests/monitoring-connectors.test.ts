import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { ConnectorIntakeSchema, connectionName, reasonWords, redConnections, toolName } from "../src/lib/monitoring/connector-intake";

/**
 * CONNECTOR-INTAKE-MONITORING-1028: crm-service serves, per tool a client connected (GoHighLevel, PostHog, Stripe,
 * Clerk), the records the vendor dated per day and a verdict (crm #233), read through api-service's staff passthrough
 * onto Monitoring > Connected tools; red on the hub is the alert. Doc Dinners' GoHighLevel synced "fine" for 8 days
 * while taking in nothing (2026-10-20 to 10-28).
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "crm-connector-intake-fixture.json"), "utf8"));

describe("Monitoring > Connected tools: crm-service's read parses as served", () => {
  it("parses the payload: red, its reasons, a 30-day series per connection", () => {
    const d = ConnectorIntakeSchema.parse(fixture());
    expect(d.status).toBe("red");
    expect(d.connections.every((c) => c.byDay.length === d.days)).toBe(true);
    expect(redConnections(d).map(connectionName)).toContain("Doc Dinners · GoHighLevel");
  });

  it("says a red reason in plain words from the served figures", () => {
    const d = ConnectorIntakeSchema.parse(fixture());
    const ghl = d.connections.find((c) => c.brandName === "Doc Dinners" && c.source === "gohighlevel")!;
    expect(ghl.reasons.map((r) => reasonWords(ghl, r))).toEqual(["nothing new for 8 days, usually never more than 5 days"]);
    expect(reasonWords(ghl, { code: "something_new", text: "As served" })).toBe("As served");
  });

  it("names tools the way people read them, an unknown one as served", () => {
    expect(toolName("gohighlevel")).toBe("GoHighLevel");
    expect(toolName("clerk")).toBe("Clerk");
    expect(toolName("hubspot")).toBe("hubspot");
  });
});

describe("Monitoring > Connected tools: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('connectorIntake: "/crm/ops/connector-intake"');
    expect(api).toContain("STAFF_MONITORING_PATHS.connectorIntake");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffConnectorIntake"');
    expect(read("components/v2/monitoring-connectors.tsx")).toContain('["staffConnectorIntake", CONNECTOR_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("tools/intake");
    expect(parseMonitoringPath("/tools/intake")).toEqual({ view: "page", page: "tools/intake" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "tools/intake" && <ConnectorIntakePage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<ConnectorIntakeTile href={href("tools/intake")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<ConnectorIntakeTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("draws the served verdict and series in served order: no client sort, no sum", () => {
    const src = read("components/v2/monitoring-connectors.tsx");
    expect(src).toContain('c.status === "red"');
    expect(src).toContain("c.byDay.map");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
  });
});
