import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LifecycleRulesSchema,
  OpsAddressesSchema,
  OpsDomainsSchema,
  OpsMailboxesSchema,
  OpsMessagesSchema,
  SeedPlacementDailySchema,
  SenderHealthSchema,
  latestMeasured,
  latestSenderHealthDay,
  underBar,
} from "../src/lib/monitoring/sending";
import { MONITORING_PAGES, SentPerPeriodSchema, parseMonitoringPath } from "../src/lib/monitoring/monitoring";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}-prod-2026-10-19.json`), "utf8"));

describe("Monitoring > Emails: instantly-service's reads parse as served in prod (2026-10-19)", () => {
  it("every ops read parses (full population checked once at ship: 80 domains, 193 mailboxes, 252 addresses)", () => {
    expect(SeedPlacementDailySchema.parse(fixture("ops-seed-placement-daily")).days.length).toBe(30);
    expect(SenderHealthSchema.parse(fixture("ops-sender-health")).current?.day).toBe("2026-10-19");
    expect(LifecycleRulesSchema.parse(fixture("ops-lifecycle-rules")).bars.deliveryPctBar).toBe(90);
    expect(OpsDomainsSchema.parse(fixture("ops-domains")).domains.length).toBe(4);
    expect(OpsMailboxesSchema.parse(fixture("ops-mailboxes")).mailboxes.length).toBe(4);
    expect(OpsAddressesSchema.parse(fixture("ops-addresses")).accounts.length).toBe(4);
    expect(OpsMessagesSchema.parse(fixture("ops-messages")).messages.length).toBe(4);
  });

  it("the Google tile reads the latest measured day, red under the producer's bar (32.3% on Oct 19 under 90%)", () => {
    const seed = SeedPlacementDailySchema.parse(fixture("ops-seed-placement-daily"));
    const bar = LifecycleRulesSchema.parse(fixture("ops-lifecycle-rules")).bars.deliveryPctBar;
    const google = latestMeasured(seed.days, "google");
    expect(google?.day).toBe("2026-10-19");
    expect(google?.cell.inboxPct).toBe(32.3);
    expect(underBar(google!.cell.inboxPct, bar)).toBe(true);
    // per mailbox vendor, as served: the fleet figure mixes vendors that land very differently
    expect(google?.byVendor.map((v) => v.vendor).sort()).toEqual(["gandi", "primeforge"]);
    // a provider never tested reads null (a dash), never 0%
    expect(latestMeasured(seed.days.map((d) => ({ ...d, microsoftConsumer: { ...d.microsoftConsumer, inboxPct: null } })), "microsoftConsumer")).toBeNull();
    expect(underBar(null, bar)).toBe(false);
    expect(underBar(90, bar)).toBe(false);
    expect(underBar(89.9, bar)).toBe(true);
  });

  it("the mailboxes-cut tile reads the latest day a dispatch tick wrote", () => {
    const health = SenderHealthSchema.parse(fixture("ops-sender-health"));
    const latest = latestSenderHealthDay(health);
    expect(latest?.day).toBe("2026-10-19");
    expect(latest?.mostlySpamMailboxes?.google).toBe(119);
  });

  it("sent per day: the chart draws the served periods, which sum to the served totals (difference zero)", () => {
    const sent = SentPerPeriodSchema.parse(fixture("ops-sent-per-day"));
    for (const k of ["toLeads", "manualReplies", "warmup", "warmupReplies", "seeds"] as const) {
      expect(sent.periods.reduce((t, p) => t + p[k], 0) - sent.totals[k]).toBe(0);
    }
    expect(sent.periods[sent.periods.length - 1].inProgress).toBe(true);
  });
});

describe("Monitoring > Emails: pages and hub", () => {
  it("every Emails page parses", () => {
    for (const p of ["emails/inbox-providers", "emails/domains", "emails/mailboxes", "emails/accounts"]) {
      expect(MONITORING_PAGES).toContain(p);
      expect(parseMonitoringPath(`/${p}`)).toEqual({ view: "page", page: p });
    }
  });

  it("the hub opens on the sending health, then Research's groups of collapsible rows; every page is reachable", () => {
    const page = read("components/v2/monitoring-page.tsx");
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf("<SendingHealthTiles />")).toBeGreaterThan(-1);
    expect(hub.indexOf("<SendingHealthTiles />")).toBeLessThan(hub.indexOf("<Section "));
    for (const group of [">Sending</SectionTitle>", ">Money</SectionTitle>", ">Copilot</SectionTitle>"]) expect(hub).toContain(group);
    const section = page.slice(page.indexOf("function Section("), page.indexOf("function Card("));
    expect(section).toContain("<HubSectionBlock");
    expect(section).toContain("hub.open.has(section)");
    for (const p of MONITORING_PAGES) {
      expect(hub.includes(`href={href("${p}")}`) || hub.includes(`page="${p}"`)).toBe(true);
    }
    expect(hub).toContain("<SentPerDayChart />");
    expect(hub).toContain("<LatestEmails />");
  });

  it("the bar is instantly-service's, never a number typed here; nothing summed or averaged", () => {
    const src = read("components/v2/monitoring-sending.tsx");
    expect(src).toContain("rules.data?.bars.deliveryPctBar");
    expect(src).not.toMatch(/\b(90|0\.9)\b/);
    // a mailbox vendor is never called a provider on screen: providers are the receiving side
    expect(src).not.toMatch(/>[^<]*(Primeforge|Mailforge)[^<]*provider/i);
  });

  it("today is the producer's inProgress day, read 'so far'", () => {
    const charts = read("components/v2/monitoring-emails.tsx");
    const fn = charts.slice(charts.indexOf("export function SentPerDayChart("), charts.indexOf("export function EmailsCharts("));
    expect(fn).toContain('["staffSentPerPeriod", "day"]');
    expect(fn).toContain('progressWord="so far"');
    expect(charts).toContain("shown.inProgress && ` · ${progressWord}`");
  });

  it("reads go through the staff gateway paths and are never written to disk", () => {
    const api = read("lib/api.ts");
    for (const k of ["seedPlacementDaily", "senderHealth", "lifecycleRules", "opsDomains", "opsMailboxes", "opsAddresses", "opsMessages"]) {
      expect(api).toContain(`STAFF_MONITORING_PATHS.${k}`);
    }
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    for (const root of ["staffSeedPlacementDaily", "staffSenderHealth", "staffLifecycleRules", "staffOpsDomains", "staffOpsMailboxes", "staffOpsAddresses", "staffOpsMessages"]) {
      expect(sensitive).toContain(`"${root}"`);
    }
  });
});
