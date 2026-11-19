import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { DistrySpendSchema, cappedToday, todayRow } from "../src/lib/monitoring/distry-spend";

/**
 * DISTRY-SPEND-CHART-1119: chat-service v0.63.194 caps Distry's spend on non-clients ($5 per visitor with no account,
 * $30 a day for all of them) and serves the daily series `GET /internal/copilot/distry-spend/daily?days=N`, read through
 * api-service's staff passthrough onto Monitoring > Copilot > Distry spend on non-clients. Red on the hub = TODAY capped.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// PROD-CAPTURED 2026-11-19 ~16:23 UTC from chat-service in-container (first day of the measure: every day at $0).
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "chat-distry-spend-prod-1119.json"), "utf8"));

describe("Monitoring > Copilot > Distry spend: chat-service's read parses as served", () => {
  it("the prod body parses whole: 30 days oldest first, today last, nothing capped", () => {
    const d = DistrySpendSchema.parse(fixture());
    expect(d.days).toHaveLength(30);
    expect(d.days[0].day < d.days[29].day).toBe(true);
    expect(todayRow(d)?.day).toBe("2026-11-19");
    expect(todayRow(d)?.thresholdUsd).toBe(30);
    expect(cappedToday(d)).toBe(false);
  });

  it("is red only when TODAY's row served alertFired; a capped past day leaves the hub normal", () => {
    const past = fixture();
    past.days[20] = { ...past.days[20], nonClientSpendUsd: 30.4, alertFired: true, alertFiredAt: "2026-11-09T14:02:00.000Z", turnsRefusedByDayCap: 7 };
    expect(cappedToday(DistrySpendSchema.parse(past))).toBe(false);
    const today = fixture();
    today.days[29] = { ...today.days[29], nonClientSpendUsd: 30.1, alertFired: true, alertFiredAt: "2026-11-19T15:00:00.000Z" };
    expect(cappedToday(DistrySpendSchema.parse(today))).toBe(true);
    // Spend over the line but not served alertFired: not re-graded here (the verdict is chat-service's).
    const over = fixture();
    over.days[29] = { ...over.days[29], nonClientSpendUsd: 31 };
    expect(cappedToday(DistrySpendSchema.parse(over))).toBe(false);
  });

  it("refuses a body missing a served field", () => {
    const raw = fixture();
    delete raw.days[0].alertFired;
    expect(DistrySpendSchema.safeParse(raw).success).toBe(false);
  });
});

describe("Monitoring > Copilot > Distry spend: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('STAFF_DISTRY_SPEND_PATH = "/chat/ops/distry-spend/daily"');
    expect(api).toContain("${STAFF_DISTRY_SPEND_PATH}?days=${days}");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffDistrySpend"');
  });

  it("is a Monitoring page, mounted, with its tile above the collapsible rows and a card in Copilot", () => {
    expect(MONITORING_PAGES).toContain("chat/distry-spend");
    expect(parseMonitoringPath("/chat/distry-spend")).toEqual({ view: "page", page: "chat/distry-spend" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "chat/distry-spend" && <DistrySpendPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<DistrySpendTile href={href("chat/distry-spend")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<DistrySpendTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="chat/distry-spend"');
  });

  it("draws a capped day red from the served alertFired, the cap line from the served threshold", () => {
    const src = read("components/v2/monitoring-distry-spend.tsx");
    expect(src).toContain("background: d.alertFired ? RED : BAR");
    expect(src).toContain("d.thresholdUsd / max");
    expect(src).toContain("cappedToday(data)");
    expect(src).not.toMatch(/\.sort\(/);
  });
});
