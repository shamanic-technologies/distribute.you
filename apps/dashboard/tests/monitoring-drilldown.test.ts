import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CapacityDailySchema,
  PlacementAlertsSchema,
  PlacementTestDetailSchema,
  PlacementTestsSchema,
  QueuedStepsSchema,
  ScheduleSchema,
  alertSeries,
  entityPath,
  placementTestPath,
  scopeQuery,
  windowSince,
} from "../src/lib/monitoring/sending";
import { MONITORING_PAGES, SentPerPeriodSchema, parseMonitoringPath } from "../src/lib/monitoring/monitoring";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}-prod-2026-10-19.json`), "utf8"));

describe("Monitoring > Emails drill-down: paths", () => {
  it("one account, mailbox, domain or placement test has its own page, keys round-trip encoded", () => {
    expect(parseMonitoringPath(`/${entityPath("account", "k.lourd+a@x.com")}`)).toEqual({ view: "entity", kind: "account", key: "k.lourd+a@x.com" });
    expect(parseMonitoringPath(`/${entityPath("mailbox", "kevin@x.com")}`)).toEqual({ view: "entity", kind: "mailbox", key: "kevin@x.com" });
    expect(parseMonitoringPath(`/${entityPath("domain", "x.com")}`)).toEqual({ view: "entity", kind: "domain", key: "x.com" });
    expect(parseMonitoringPath(`/${placementTestPath("seed:1f2e")}`)).toEqual({ view: "test", testId: "seed:1f2e" });
    // the list pages stay pages, a malformed key is "missing", never a crash
    expect(parseMonitoringPath("/emails/accounts")).toEqual({ view: "page", page: "emails/accounts" });
    expect(parseMonitoringPath("/emails/accounts/%E0%A4%A")).toEqual({ view: "missing", rest: "emails/accounts/%E0%A4%A" });
    for (const p of ["emails/placement-tests", "emails/warmup", "emails/queued"]) expect(MONITORING_PAGES).toContain(p);
  });

  it("a scope is the producer's account|mailbox|domain filter; the history window starts on a UTC day", () => {
    expect(scopeQuery({})).toBe("");
    expect(scopeQuery({ account: "a+b@x.com" })).toBe("account=a%2Bb%40x.com");
    expect(windowSince(30, new Date("2026-10-19T15:40:00Z"))).toBe("2026-09-20T00:00:00.000Z");
  });
});

describe("Monitoring > Emails drill-down: wiring", () => {
  it("each list row opens its entity page", () => {
    const src = read("components/v2/monitoring-sending.tsx");
    expect(src).toContain('entityPath("domain", d.domain)');
    expect(src).toContain('entityPath("mailbox", m.login)');
    expect(src).toContain('entityPath("account", a.email)');
  });

  it("an entity page holds the four blocks plus its unit events, all scoped at the producer", () => {
    const src = read("components/v2/monitoring-drilldown.tsx");
    const page = src.slice(src.indexOf("export function EntityPage("), src.indexOf("export const entityTitle"));
    for (const block of ["<ScopedSentPerDay scope={scope} />", "<CapacityChart scope={scope} />", "<ScheduleChart scope={scope} />", "<MessagesTable", "<PlacementTestsTable", "<QueuedStepsTable"]) {
      expect(page).toContain(block);
    }
    // the ramp rule is the producer's sentence, the planned date is labelled so
    expect(src).toContain("<RampRule rules={data.rampRules} />");
    expect(src).toContain("title={rules.rule}");
    expect(src).toContain(">Planned date</th>");
    // capacity is slow cold: a skeleton, not an error
    expect(src).toContain("Rebuilding capacity");
  });

  it("the hub tile: every mailbox's tests, red under the alert's served bar; the after-cut figure the alert reads under it", () => {
    // Owner 2026-10-19: 40-60 % spam at Google for weeks, never seen. The after-cut figure read
    // 100 % green that day while every mailbox sat at 54.2 %: the figure is the whole fleet.
    const src = read("components/v2/monitoring-sending.tsx");
    const tile = src.slice(src.indexOf("function InboxTile("), src.indexOf("function CutTile("));
    expect(tile).toContain("usePlacementAlerts()");
    expect(tile).toContain("underBar(latest.fleet.inboxPct, bar)");
    expect(tile).toContain("bar.inboxPctOfFound");
    expect(tile).toContain("latest.allowed.inboxPct");
    expect(tile).not.toContain("deliveryPctBar");
    const verdict = src.slice(src.indexOf("export function useSendingVerdict("), src.indexOf("// ─── Tables"));
    expect(verdict).toContain("underBar(x.latest!.fleet.inboxPct, data.bar.inboxPctOfFound)");
  });

  it("the new reads are staff gateway paths and never written to disk", () => {
    const api = read("lib/api.ts");
    for (const k of ["capacityDaily", "schedule", "queuedSteps", "placementTests", "placementAlerts"]) expect(api).toContain(`STAFF_MONITORING_PATHS.${k}`);
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    for (const root of ["staffSentPerDayScoped", "staffCapacityDaily", "staffSchedule", "staffQueuedSteps", "staffPlacementTests", "staffPlacementTest", "staffPlacementAlerts", "staffOpsMessagesScoped", "staffMessageBody"]) {
      expect(sensitive).toContain(`"${root}"`);
    }
  });
});

describe("Monitoring > Emails drill-down: prod reads (captured in-container 2026-10-19)", () => {
  it("every new read parses as served", () => {
    expect(CapacityDailySchema.parse(fixture("ops-capacity-daily-mailbox")).days.length).toBeGreaterThan(0);
    expect(ScheduleSchema.parse(fixture("ops-schedule-mailbox")).days.length).toBeGreaterThan(0);
    expect(QueuedStepsSchema.parse(fixture("ops-queued-steps-domain")).total).toBeGreaterThanOrEqual(0);
    expect(PlacementTestsSchema.parse(fixture("ops-placement-tests-account")).tests.length).toBeGreaterThan(0);
    expect(PlacementTestDetailSchema.parse(fixture("ops-placement-test")).seeds.length).toBeGreaterThan(0);
  });

  it("sent per day for one mailbox, domain, account: the chart's bars sum to the served totals (difference zero)", () => {
    for (const name of ["ops-sent-per-day-mailbox", "ops-sent-per-day-domain", "ops-sent-per-day-account"]) {
      const sent = SentPerPeriodSchema.parse(fixture(name));
      expect(sent.periods.length).toBe(30);
      for (const k of ["toLeads", "manualReplies", "warmup", "warmupReplies", "seeds"] as const) {
        expect(sent.periods.reduce((t, p) => t + p[k], 0) - sent.totals[k]).toBe(0);
      }
    }
  });

  it("a placement test lists each seed with where it landed, per provider", () => {
    const t = PlacementTestDetailSchema.parse(fixture("ops-placement-test"));
    for (const s of t.seeds) {
      expect(["google", "microsoft", "microsoftConsumer", "other"]).toContain(s.provider);
      expect([null, "inbox", "spam", "missing"]).toContain(s.placement);
    }
  });

  it("the alert series reads the latest measured day per provider as served", () => {
    const alerts = PlacementAlertsSchema.parse(fixture("ops-placement-alerts"));
    const google = alertSeries(alerts, "google");
    expect(google.days.every((d) => d.provider === "google")).toBe(true);
    if (google.latest) expect(google.latest.measured).toBe(true);
  });
});
