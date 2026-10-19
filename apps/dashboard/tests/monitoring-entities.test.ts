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
  evaluationSeries,
  latestEvaluation,
  scopeQuery,
  underBar,
} from "../src/lib/monitoring/sending";
import { MONITORING_PAGES, SentPerPeriodSchema, monitoringEntityPath, parseMonitoringPath } from "../src/lib/monitoring/monitoring";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}-prod-2026-10-19.json`), "utf8"));

describe("Monitoring > Emails per entity: instantly-service's MAILBOX-MONITORING-1019 reads parse as served (2026-10-19)", () => {
  it("every new read parses (full population checked once at ship: 43 tests, 3,002 seeds in one test, 2,237 queued steps)", () => {
    expect(PlacementAlertsSchema.parse(fixture("ops-placement-alerts")).bar.inboxPctOfFound).toBe(80);
    expect(PlacementTestsSchema.parse(fixture("ops-placement-tests")).tests[0].testId).toMatch(/^seed:/);
    expect(PlacementTestDetailSchema.parse(fixture("ops-placement-test-detail")).missingSeedsListed).toBe(true);
    expect(CapacityDailySchema.parse(fixture("ops-capacity-daily-mailbox")).scope.mailbox).toBe("kevin.l@growdistribute.com");
    expect(ScheduleSchema.parse(fixture("ops-schedule")).days[0].isToday).toBe(true);
    expect(QueuedStepsSchema.parse(fixture("ops-queued-steps-mailbox")).total).toBe(114);
  });

  it("the hub tile: every mailbox's latest judged test, red under the alert's served bar (Google 54.2% on Oct 19 under 80%)", () => {
    const alerts = PlacementAlertsSchema.parse(fixture("ops-placement-alerts"));
    const bar = alerts.bar.inboxPctOfFound;
    const google = latestEvaluation(alerts, "google");
    expect(google?.day).toBe("2026-10-19");
    expect(google?.fleet.inboxPct).toBe(54.2);
    expect(underBar(google!.fleet.inboxPct, bar)).toBe(true);
    // after the automatic cut, what still reaches prospects: the alert's own figure, shown beside it
    expect(google?.allowed.inboxPct).toBe(100);
    const microsoft = latestEvaluation(alerts, "microsoft");
    expect(underBar(microsoft!.fleet.inboxPct, bar)).toBe(false);
    // the series is one provider's days, oldest first
    const days = evaluationSeries(alerts, "google").map((d) => d.day);
    expect([...days].sort()).toEqual(days);
  });

  it("the tile reads the alert's bar, never a typed number", () => {
    const src = read("components/v2/monitoring-sending.tsx");
    const tile = src.slice(src.indexOf("function InboxTile("), src.indexOf("function CutTile("));
    expect(tile).toContain("bar.inboxPctOfFound");
    expect(tile).not.toMatch(/underBar\([^)]*,\s*\d/);
  });

  it("a mailbox's sent per day: the chart draws the served periods, which sum to the served totals per kind (difference zero)", () => {
    const sent = SentPerPeriodSchema.parse(fixture("ops-sent-per-day-mailbox"));
    for (const k of ["toLeads", "manualReplies", "warmup", "warmupReplies", "seeds"] as const) {
      expect(sent.periods.reduce((t, p) => t + p[k], 0) - sent.totals[k]).toBe(0);
    }
  });

  it("every entity page and placement test has a URL, keys round-trip encoded", () => {
    for (const p of ["emails/placement-tests", "emails/warmup", "emails/queued"]) expect(MONITORING_PAGES).toContain(p);
    expect(parseMonitoringPath(`/${monitoringEntityPath("mailbox", "kevin.l@growdistribute.com")}`)).toEqual({ view: "entity", grain: "mailbox", key: "kevin.l@growdistribute.com" });
    expect(parseMonitoringPath("/emails/domains/growdistribute.com")).toEqual({ view: "entity", grain: "domain", key: "growdistribute.com" });
    expect(parseMonitoringPath("/emails/accounts/a%40b.com")).toEqual({ view: "entity", grain: "account", key: "a@b.com" });
    expect(parseMonitoringPath("/emails/placement-tests/seed%3Aabc")).toEqual({ view: "test", testId: "seed:abc" });
    expect(parseMonitoringPath("/emails/mailboxes/%E0%A4%A")).toEqual({ view: "missing", rest: "emails/mailboxes/%E0%A4%A" });
    expect(parseMonitoringPath("/emails/mailboxes")).toEqual({ view: "page", page: "emails/mailboxes" });
  });

  it("a scoped read names its entity in the query; the fleet sends none", () => {
    expect(scopeQuery(null)).toBe("");
    expect(scopeQuery({ grain: "mailbox", key: "a@b.com" })).toBe("mailbox=a%40b.com");
  });

  it("the entity page hands its scope to every read it draws (call sites)", () => {
    const src = read("components/v2/monitoring-entities.tsx");
    const page = src.slice(src.indexOf("export function EntityPage("), src.indexOf("export const entityTitle"));
    for (const call of ["<SentPerDayChart scope={scope}", "<CapacityChart scope={scope}", "<ScheduleChart scope={scope}", "<PlacementTestsTable scope={scope}", "<QueuedStepsTable scope={scope}", "<LatestEmails scope={scope}"]) {
      expect(page).toContain(call);
    }
    const api = read("lib/api.ts");
    for (const r of ["getStaffSentPerPeriod", "getStaffOpsMessages", "getStaffCapacityDaily", "getStaffSchedule", "getStaffPlacementTests", "getStaffQueuedSteps"]) {
      const at = api.indexOf(`export async function ${r}(`);
      expect(api.slice(at, api.indexOf("\n}\n", at))).toContain("scopeQuery(scope)");
    }
  });

  it("every row of the domains, mailboxes and addresses tables opens its own page", () => {
    const src = read("components/v2/monitoring-sending.tsx");
    for (const [fn, grain] of [["DomainsPage", "domain"], ["MailboxesPage", "mailbox"], ["AccountsPage", "account"]] as const) {
      const at = src.indexOf(`export function ${fn}(`);
      expect(src.slice(at, src.indexOf("\n}\n", at))).toContain(`<EntityLink grain="${grain}"`);
    }
  });

  it("queued steps keep the producer's theoretical date (no date maths here)", () => {
    const src = read("components/v2/monitoring-entities.tsx");
    expect(src).not.toMatch(/new Date\([^)]*\)\.(setDate|getTime\(\)\s*\+)/);
    expect(src).toContain("s.theoreticalAt");
  });
});
