import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OpsAddressesSchema, OpsDomainsSchema, OpsMailboxesSchema } from "../src/lib/monitoring/sending";
import {
  InfraSpendSchema,
  billedNative,
  dailyMaxFor,
  fullDay,
  fullTime,
  fxRateLine,
  isLiveDomain,
  lifecycleCounts,
  money,
  nextRenewalEvents,
  rampReaches,
  tokenWord,
  upcomingRenewals,
  vendorMailboxesWord,
} from "../src/lib/monitoring/details";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}-prod-2026-10-19.json`), "utf8"));

const domains = OpsDomainsSchema.parse(fixture("ops-domains-full"));
const mailboxes = OpsMailboxesSchema.parse(fixture("ops-mailboxes-full"));
const addresses = OpsAddressesSchema.parse(fixture("ops-addresses-full"));
const spend = InfraSpendSchema.parse(fixture("infra-spend"));

describe("entity details: the widened rows parse the WHOLE prod population (2026-10-19)", () => {
  it("every domain, every mailbox, a real 110-row subset of the 252 addresses (whole 252 parsed once at ship)", () => {
    expect(domains.domains.length).toBe(80);
    expect(mailboxes.mailboxes.length).toBe(193);
    expect(addresses.accounts.length).toBe(110);
  });

  it("the new domain fields survive the parse (a too-narrow schema strips them silently)", () => {
    expect(domains.fx?.source).toBe("ecb-eurofxref-daily");
    expect(domains.domains.filter((d) => d.dns === null).length).toBe(1);
    expect(domains.domains.filter((d) => d.dns).length).toBe(79);
    expect(domains.domains.every((d) => d.cost && d.vendorReportsMailboxes !== undefined && d.autorenew !== undefined)).toBe(true);
  });

  it("the new mailbox and address fields survive the parse", () => {
    expect(mailboxes.mailboxes.filter((m) => m.cost).length).toBe(85);
    expect(mailboxes.mailboxes.every((m) => m.volume30d && m.credentialSource)).toBe(true);
    expect(addresses.accounts.every((a) => a.lifecycleHistory && a.rampProjection && a.queuedNextLater !== undefined)).toBe(true);
    expect(addresses.accounts.some((a) => a.googlePlacement?.verdict === "junk")).toBe(true);
    expect(addresses.accounts.some((a) => a.googlePlacement === null)).toBe(true);
  });

  it("infra spend serves its own USD total and 30-day sends", () => {
    expect(spend.monthlyTotalUsdCents).toBe(67771);
    expect(spend.sentLast30d).toBe(31143);
    expect(spend.planSubscriptions.length).toBe(2);
  });
});

describe("entity details: pure helpers select and format, never compute", () => {
  it("money never converts: euros stay euros, USD provenance is dropped", () => {
    expect(money(23223, "EUR")).toBe("€232.23");
    expect(money(null, "USD")).toBeNull();
    expect(billedNative(320, "EUR")).toBe("billed €3.20");
    expect(billedNative(320, "USD")).toBeNull();
  });

  it("the fx line reads the served rate, and says so when none is on record", () => {
    expect(fxRateLine(spend.fx)).toBe("EUR converted at 1 EUR = $1.1253 (ECB reference rate, Oct 16, 2026).");
    expect(fxRateLine(null)).toContain("No EUR to USD rate");
  });

  it("dates read in UTC", () => {
    expect(fullDay("2027-09-13T11:20:16.596Z")).toBe("Sep 13, 2027");
    expect(fullDay("2026-10-25")).toBe("Oct 25, 2026");
    expect(fullTime("2026-10-19T11:22:03.495Z")).toBe("Oct 19, 2026, 11:22 UTC");
    expect(fullDay(null)).toBeNull();
  });

  it("a vendor that never reports mailboxes reads 'not reported', never 0", () => {
    expect(vendorMailboxesWord({ vendorReportsMailboxes: false, vendorMailboxes: 0 })).toBe("Not reported by this vendor");
    expect(vendorMailboxesWord({ vendorReportsMailboxes: true, vendorMailboxes: 3 })).toBe("3");
  });

  it("daily max send = the ramp-aware cap, the configured limit only when the cap is not served", () => {
    expect(dailyMaxFor({ effectiveDailyCap: 14, dailyLimit: 50 })).toBe(14);
    expect(dailyMaxFor({ effectiveDailyCap: undefined, dailyLimit: 50 })).toBe(50);
    expect(dailyMaxFor({ effectiveDailyCap: 0, dailyLimit: 50 })).toBe(0);
  });

  it("lookups: ramp end, lifecycle counts largest first, token words", () => {
    expect(rampReaches([{ date: "2026-10-19", cap: 5 }, { date: "2026-10-25", cap: 50 }])).toEqual({ date: "2026-10-25", cap: 50 });
    expect(rampReaches([])).toBeNull();
    expect(lifecycleCounts({ in_recovery: 2, in_production: 5 })[0]).toEqual(["in_production", 5]);
    expect(tokenWord("delivery_below_bar")).toBe("Delivery below bar");
  });

  it("renewal events select by date on live domains only, unknown auto-renew counted apart", () => {
    const rows = domains.domains;
    const ev = nextRenewalEvents(rows);
    const live = rows.filter(isLiveDomain);
    expect(ev.unknownAutorenew).toBe(live.filter((d) => d.autorenew == null).length);
    for (const e of [ev.ending, ev.renewing]) {
      if (!e) continue;
      const row = live.find((d) => d.domain === e.domain)!;
      expect(row).toBeDefined();
      expect(e.usdCents).toBe(row.cost?.usd.renewalCents ?? null);
    }
    const ahead = upcomingRenewals(rows, new Date("2026-10-19T12:00:00Z"), 8);
    expect(ahead.length).toBeLessThanOrEqual(8);
    expect(ahead.every(isLiveDomain)).toBe(true);
    expect([...ahead].map((d) => d.cost!.renewalAt).join()).toBe([...ahead].map((d) => d.cost!.renewalAt).sort().join());
  });
});

describe("entity details: the component draws served fields only", () => {
  const src = read("components/v2/monitoring-details.tsx");
  const helpers = read("lib/monitoring/details.ts");

  it("exports the blocks the entity pages and the list pages mount", () => {
    for (const name of ["DomainDetails", "MailboxDetails", "AccountDetails", "DomainsEstate", "MailboxesSummary"]) {
      expect(src).toContain(`export function ${name}(`);
    }
  });

  it("reads the SAME list queries as the Monitoring tables and introduces staff roots only", () => {
    expect(src).toContain("useOpsDomains()");
    expect(src).toContain("useOpsMailboxes()");
    expect(src).toContain("useOpsAddresses()");
    expect(src).toContain('["staffInfraSpend"]');
    expect(src).toContain('["staffOpsInfra"]');
  });

  it("sums nothing, converts nothing, never shows an open rate or an em/en dash in copy", () => {
    expect(src).not.toMatch(/\.reduce\(/);
    expect(helpers).not.toMatch(/\.reduce\(/);
    expect(src).not.toMatch(/\* *fx\.rate|fx\.rate *\*/);
    expect(src.toLowerCase()).not.toContain("open rate");
    expect(src).not.toMatch(/[—–]/);
    expect(src).not.toMatch(/border-(l|r|t)-[2-9]/);
  });

  it("monthly cost is the producer's total, the USD twins are read as served", () => {
    expect(src).toContain("s.monthlyTotalUsdCents");
    expect(src).toContain("cost.usd.monthlyCents");
  });

  it("the queue's due-today parts render separately, never an admin-side sum", () => {
    expect(src).not.toContain("queuedFirstDueTodaySequences +");
    expect(src).toContain("a.queuedFirstDueTodaySequences");
    expect(src).toContain("a.queuedNextToday");
  });

  it("states no raw Instantly config: our Instantly workspace has no paid plan, every send goes out over SMTP", () => {
    expect(src).not.toContain("Raw Instantly config");
    expect(src).not.toContain("error.message");
  });
});
