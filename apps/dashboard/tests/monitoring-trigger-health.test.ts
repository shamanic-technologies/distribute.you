import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { TriggerHealthSchema, redTriggers, verdictColor, verdictWord, watchedTriggers } from "../src/lib/monitoring/trigger-health";

/**
 * TRIGGER-HEALTH-1028-DASH: campaign-service stopped emailing "Trigger X has been silent for N days" (4 emails on
 * 2026-10-28, 2 of them quiet weeks) and serves the verdict instead (campaign-service #802), read through api-service's
 * staff passthrough onto Monitoring > Triggers > Firing; red on the hub is the alert.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// Captured in-container from campaign-service `GET /internal/ops/trigger-health?days=30`, 2026-10-28 14:21 UTC.
const prod = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "campaign-trigger-health-prod-1028.json"), "utf8"));

describe("Monitoring > Triggers > Firing: campaign-service's read parses as served", () => {
  it("the real production read of 2026-10-28 parses whole: red, Booking call never fired, a 30-day series per trigger", () => {
    const d = TriggerHealthSchema.parse(prod());
    expect(d.status).toBe("red");
    expect(d.days).toBe(30);
    expect(d.triggers.length).toBeGreaterThan(5);
    for (const t of d.triggers) expect(t.byDay).toHaveLength(30);
    const reds = redTriggers(d);
    expect(reds.map((t) => t.triggerId)).toEqual(["booking_call_started"]);
    expect(reds[0].reason).toBe("never_fired");
    expect(reds[0].sentence).toMatch(/^Never fired/);
    expect(reds[0].byDay[reds[0].byDay.length - 1]).toMatchObject({ events: 0, status: "red" });
  });

  it("keeps served order and splits watched from unwatched, never re-grading a verdict", () => {
    const raw = prod();
    raw.triggers.push({ ...raw.triggers[1], triggerId: "old_one", label: "Old one", watched: false, status: null, reason: null, sentence: null, liveCampaigns: 0 });
    raw.triggers.push({ ...raw.triggers[0], triggerId: "quiet_red_unwatched", watched: false });
    const d = TriggerHealthSchema.parse(raw);
    const { watched, unwatched } = watchedTriggers(d);
    expect(watched.map((t) => t.triggerId)).toEqual(prod().triggers.map((t: { triggerId: string }) => t.triggerId));
    expect(unwatched.map((t) => t.triggerId)).toEqual(["old_one", "quiet_red_unwatched"]);
    // An unwatched trigger never turns the page red.
    expect(redTriggers(d).map((t) => t.triggerId)).toEqual(["booking_call_started"]);
  });

  it("an ok read with facts_without_event missing rows and an unknown verdict parses too", () => {
    const raw = prod();
    raw.status = "ok";
    raw.checkedAt = null;
    raw.triggers[2] = { ...raw.triggers[2], status: "unknown", reason: "facts_unreadable", factsWithoutEvent: null };
    raw.triggers[3] = {
      ...raw.triggers[3],
      status: "red",
      reason: "facts_without_event",
      factsWithoutEvent: 3,
      missing: [{ orgId: "o1", brandId: "b1", people: 3, firstReachedAt: "2026-10-27T10:00:00.000Z" }],
    };
    const d = TriggerHealthSchema.parse(raw);
    expect(d.triggers[3].missing[0].people).toBe(3);
  });

  it("refuses a shape it does not know (an unknown verdict)", () => {
    const raw = prod();
    raw.triggers[0].status = "broken";
    expect(TriggerHealthSchema.safeParse(raw).success).toBe(false);
  });

  it("names each verdict and gives it one colour", () => {
    expect(verdictWord("red")).toBe("Red");
    expect(verdictWord("ok")).toBe("OK");
    expect(verdictWord("unknown")).toBe("Unknown");
    expect(verdictWord(null)).toBe("Not checked");
    expect(verdictColor("red")).toBe("var(--data-rose)");
    expect(verdictColor("ok")).toBe("var(--run)");
  });
});

describe("Monitoring > Triggers > Firing: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('triggerHealth: "/campaigns/ops/trigger-health"');
    expect(api).toContain("STAFF_MONITORING_PATHS.triggerHealth");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffTriggerHealth"');
    expect(read("components/v2/monitoring-trigger-health.tsx")).toContain('["staffTriggerHealth", TRIGGER_HEALTH_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("triggers/firing");
    expect(parseMonitoringPath("/triggers/firing")).toEqual({ view: "page", page: "triggers/firing" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "triggers/firing" && <TriggerHealthPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<TriggerHealthTile href={href("triggers/firing")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<TriggerHealthTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("draws the served verdicts, sentences and series in served order: no client sort, no sum, no per-trigger case", () => {
    const src = read("components/v2/monitoring-trigger-health.tsx");
    expect(src).toContain('data.status === "red"');
    expect(src).toContain("t.byDay.map");
    expect(src).toContain("t.sentence");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
    expect(src).not.toMatch(/booking_call_started|lead_event|form_submitted/);
  });
});
