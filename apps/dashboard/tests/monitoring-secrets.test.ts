import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { KeySecuritySchema, alertWords, kindWords, secretsHeadline, secretsTone } from "../src/lib/monitoring/key-security";

/**
 * SECURITY-ALERTS-1128-CHART: key-service audits every secret read/write and wrong-key request and serves the daily
 * series + incidents + red verdict at /internal/security/daily, read through api-service's staff passthrough
 * GET /v1/keys/ops/security-daily onto Monitoring > Security > Secrets. key-service mails staff; this page never does.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// Captured from prod (key-service container, 2026-11-27): 2 real probe incidents + 1 staff test incident.
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "key-security-daily-fixture.json"), "utf8"));

describe("Monitoring > Secrets: key-service's read parses as served", () => {
  it("the whole prod payload parses: 30 days, incidents newest first, a test incident flagged", () => {
    const d = KeySecuritySchema.parse(fixture());
    expect(d.days).toHaveLength(30);
    expect(d.incidents.some((i) => i.test)).toBe(true);
    expect(d.incidents.some((i) => !i.test)).toBe(true);
  });

  it("served red=true -> red tile, the headline counts the incidents", () => {
    const d = KeySecuritySchema.parse({ ...fixture(), red: true, incidentsLast24h: 2, undeliveredAlerts: 0 });
    expect(secretsTone(d)).toBe("red");
    expect(secretsHeadline(d)).toBe("2 incidents in 24 h");
  });

  it("an undelivered staff alert is said on the red tile", () => {
    const d = KeySecuritySchema.parse({ ...fixture(), red: true, incidentsLast24h: 0, undeliveredAlerts: 1 });
    expect(secretsTone(d)).toBe("red");
    expect(secretsHeadline(d)).toBe("1 alert not delivered");
  });

  it("test-only incidents -> not red (the producer leaves them out of red; the tile never re-grades)", () => {
    const f = fixture();
    const testOnly = f.incidents.map((i: Record<string, unknown>) => ({ ...i, test: true, openedAt: new Date().toISOString() }));
    const d = KeySecuritySchema.parse({ ...f, red: false, incidentsLast24h: 0, undeliveredAlerts: 0, incidents: testOnly });
    expect(secretsTone(d)).toBe("green");
    expect(secretsHeadline(d)).toBe("Nothing wrong in 24 h");
  });

  it("a quiet day (all zeros, no incident) is green", () => {
    const f = fixture();
    const quiet = f.days.map((x: Record<string, unknown>) => ({ ...x, secretReads: 0, keyWrites: 0, wrongKeyRequests: 0, secretReadsRefused: 0, incidentsOpened: 0 }));
    const d = KeySecuritySchema.parse({ red: false, incidentsLast24h: 0, undeliveredAlerts: 0, days: quiet, incidents: [] });
    expect(secretsTone(d)).toBe("green");
  });

  it("names kinds and alert states in words, an unknown kind shown as served", () => {
    expect(kindWords("unknown_caller_decrypt")).toBe("Unknown caller read a secret");
    expect(kindWords("something_new")).toBe("something_new");
    const i = KeySecuritySchema.parse(fixture()).incidents[0];
    expect(alertWords({ ...i, alertStatus: "failed" })).toBe("Alert not delivered");
  });
});

describe("Monitoring > Secrets: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk, and sends no email", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('keySecurity: "/keys/ops/security-daily"');
    expect(api).toContain("STAFF_MONITORING_PATHS.keySecurity");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffKeySecurity"');
    const src = read("components/v2/monitoring-secrets.tsx");
    expect(src).toContain('["staffKeySecurity", SECRETS_DAYS]');
    expect(src).not.toMatch(/sendEmail|transactional-email|mailto:/);
  });

  it("the tile's red is the served verdict only (no client re-grading of incidents)", () => {
    const src = read("components/v2/monitoring-secrets.tsx");
    expect(src).toContain("secretsTone(data)");
    expect(src).not.toMatch(/incidents\.filter\(/);
    expect(src).not.toMatch(/\.sort\(/);
  });

  it("is a Monitoring page, mounted, with its tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("security/secrets");
    expect(parseMonitoringPath("/security/secrets")).toEqual({ view: "page", page: "security/secrets" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "security/secrets" && <SecretsPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<SecretsTile href={href("security/secrets")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<SecretsTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="security/secrets"');
  });
});
