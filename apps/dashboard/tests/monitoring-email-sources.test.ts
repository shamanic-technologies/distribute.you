import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { EMAIL_PATHS, EmailSourcesSchema, emailsFound, todayRow, withoutApolloPct } from "../src/lib/monitoring/email-sources";

/**
 * APOLLO-ZERO-COST-1119: owner 2026-11-19, Apollo's paid reveal is the last resort. apollo-service serves the daily
 * series `GET /internal/stats/email-sources/daily?days=N` (emails found per day by path), read through api-service's
 * staff passthrough onto Monitoring > Cost > Email sources. A high Apollo share is normal; red only when unreadable.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// PROD-CAPTURED 2026-11-19 from apollo-service in-container (first day with stock reuses and format guesses).
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "apollo-email-sources-prod-1119.json"), "utf8"));

describe("Monitoring > Cost > Email sources: apollo-service's read parses as served", () => {
  it("the prod body parses whole: 30 days oldest first, today last", () => {
    const d = EmailSourcesSchema.parse(fixture());
    expect(d.days).toHaveLength(30);
    expect(d.days[0].day < d.days[29].day).toBe(true);
    const today = todayRow(d)!;
    expect(today.day).toBe("2026-11-19");
    expect(emailsFound(today)).toBe(today.apolloReveals + today.tregFinds + today.stockReuses + today.formatGuesses);
  });

  it("prints the complement of the served apolloShare, null on a day with no email", () => {
    const d = EmailSourcesSchema.parse(fixture());
    const today = todayRow(d)!;
    expect(withoutApolloPct(today)).toBeCloseTo((1 - today.apolloShare!) * 100, 10);
    expect(withoutApolloPct({ ...today, apolloShare: null })).toBeNull();
    expect(withoutApolloPct({ ...today, apolloShare: 1 })).toBe(0);
  });

  it("refuses a body missing a served field", () => {
    const raw = fixture();
    delete raw.days[0].tregFinds;
    expect(EmailSourcesSchema.safeParse(raw).success).toBe(false);
  });

  it("stacks the paths in the owner's order, Apollo (paid) last", () => {
    expect(EMAIL_PATHS.map((p) => p.label)).toEqual(["Our stock", "Format guess", "treg", "Apollo (paid)"]);
    expect(new Set(EMAIL_PATHS.map((p) => p.color)).size).toBe(4);
    expect(EMAIL_PATHS.map((p) => p.color)).not.toContain("var(--data-rose)");
  });
});

describe("Monitoring > Cost > Email sources: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('STAFF_EMAIL_SOURCES_PATH = "/apollo/ops/email-sources/daily"');
    expect(api).toContain("${STAFF_EMAIL_SOURCES_PATH}?days=${days}");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffEmailSources"');
  });

  it("is a Monitoring page, mounted, with its tile above the collapsible rows and a card in Cost", () => {
    expect(MONITORING_PAGES).toContain("cost/email-sources");
    expect(parseMonitoringPath("/cost/email-sources")).toEqual({ view: "page", page: "cost/email-sources" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "cost/email-sources" && <EmailSourcesPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<EmailSourcesTile href={href("cost/email-sources")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<EmailSourcesTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="cost/email-sources"');
  });

  it("is red only when the read fails, never for a high Apollo share; computes nothing but the complement", () => {
    const src = read("components/v2/monitoring-email-sources.tsx");
    expect(src.match(/--data-rose/g)).toHaveLength(1);
    expect(src).toContain('q.isError && !data');
    expect(src).not.toMatch(/\.sort\(/);
  });
});
