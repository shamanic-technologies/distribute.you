import { describe, expect, it } from "vitest";
import {
  BUCKETS_BACK,
  BUCKETS_FORWARD,
  COST_GRAINS,
  DELIVERY_BAR_PCT,
  RECOMMENDED_MAILBOXES,
  VENDOR_CONSOLES,
  domainIssues,
  groupIssues,
  liveDomains,
  nextRenewalEvents,
  renewalWindow,
  vendorConsole,
  type EstateDomain,
} from "../src/lib/estate-signals";

/**
 * The three panels above the domains table. Every number they print is a field
 * instantly-service served; what is tested here is which row LEADS, which rows
 * carry a FINDING, and which calendar bucket a payment falls in.
 *
 * The fixtures are shaped from the live `/ops/domains` payload read on
 * 2026-09-22: 74 live domains, autorenew true 16 / false 29 / null 29, Gandi
 * invoicing EUR beside everyone else's USD, 0 renewals in the next 7 days and
 * 28 in the next 7 months.
 */

const NOW = Date.parse("2026-09-22T12:00:00.000Z");

function dom(over: Partial<EstateDomain> & { domain: string }): EstateDomain {
  return {
    provider: "gandi",
    expiresAt: null,
    autorenew: null,
    cancelledAt: null,
    absentSince: null,
    mailboxes: 3,
    addresses: { total: 3, byLifecycle: { in_production: 3 } },
    delivery: { inboxPct: 100 },
    dns: {
      spf: { present: true, allQualifier: "~all" },
      dmarc: { present: true, policy: "reject" },
      dkimSelectors: ["google"],
      mx: ["1 smtp.google.com"],
      errors: {},
    },
    cost: { currency: "EUR", renewalCents: 3838, renewalAt: null, usd: { renewalCents: 4380 } },
    ...over,
  };
}

describe("the live estate", () => {
  it("drops a cancelled or vanished domain — it bills nothing and cannot have a problem", () => {
    const rows = liveDomains([
      dom({ domain: "gone.com", cancelledAt: "2026-05-02T00:00:00Z" }),
      dom({ domain: "vanished.com", absentSince: "2026-07-01T00:00:00Z" }),
      dom({ domain: "real.com" }),
    ]);
    expect(rows.map((r) => r.domain)).toEqual(["real.com"]);
  });
});

describe("vendor consoles", () => {
  it("knows the four vendors instantly-service actually names", () => {
    // Measured over the live estate on 2026-09-22: gandi 40, primeforge 24,
    // instantly-dfy 5, mailforge 5.
    expect(Object.keys(VENDOR_CONSOLES).sort()).toEqual([
      "gandi",
      "instantly-dfy",
      "mailforge",
      "primeforge",
    ]);
  });

  it("pins the exact URLs that were verified to resolve", () => {
    // Every one of these answered on 2026-09-22 (Gandi 302s to its own login
    // with the path preserved; the other three answer 200). They are dashboard
    // ROOTS on purpose: Gandi's console is a catch-all SPA, so a per-domain URL
    // cannot be told apart from a route that does not exist, and a CTA that
    // 404s after a login round-trip is worse than one that lands on the list.
    expect(VENDOR_CONSOLES.gandi.href).toBe("https://admin.gandi.net/domain");
    expect(VENDOR_CONSOLES.primeforge.href).toBe("https://app.primeforge.ai");
    expect(VENDOR_CONSOLES.mailforge.href).toBe("https://app.mailforge.ai");
    expect(VENDOR_CONSOLES["instantly-dfy"].href).toBe("https://app.instantly.ai/app/accounts");
  });

  it("links only https consoles, so no CTA can send an operator to a guess", () => {
    for (const v of Object.values(VENDOR_CONSOLES)) {
      expect(v.href.startsWith("https://")).toBe(true);
      expect(v.logoDomain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
    }
  });

  it("states nothing for a vendor it does not carry, rather than guessing one", () => {
    expect(vendorConsole(null)).toBeNull();
    expect(vendorConsole("a-vendor-nobody-has-read-yet")).toBeNull();
    expect(vendorConsole("gandi")?.label).toBe("Gandi");
  });
});

describe("events", () => {
  const estate = [
    dom({ domain: "techmonastery.org", autorenew: false, expiresAt: "2026-12-12T12:33:01Z" }),
    dom({ domain: "clawdbot.day", autorenew: false, expiresAt: "2027-01-27T01:09:30Z" }),
    dom({ domain: "generative.day", autorenew: true, expiresAt: "2026-12-21T21:33:32Z" }),
    dom({ domain: "kevinlourd.com", autorenew: true, expiresAt: "2026-12-29T08:24:02Z" }),
    dom({ domain: "silent.com", autorenew: null, expiresAt: "2026-10-01T00:00:00Z" }),
  ];

  it("picks the soonest of each KIND, because the two need opposite actions", () => {
    const { ending, renewing } = nextRenewalEvents(estate);
    expect(ending?.domain).toBe("techmonastery.org");
    expect(renewing?.domain).toBe("generative.day");
  });

  it("puts an unknown auto-renew in NEITHER row, and counts it instead", () => {
    // 29 of 74 live domains state no direction. Filing one on either side
    // asserts a direction the vendor never told us — and `silent.com` expires
    // sooner than both real answers, so a lenient filter would lead with it.
    const { ending, renewing, unknownAutorenew } = nextRenewalEvents(estate);
    expect(ending?.domain).not.toBe("silent.com");
    expect(renewing?.domain).not.toBe("silent.com");
    expect(unknownAutorenew).toBe(1);
  });

  it("ignores a domain with no expiry at all — there is no date to act on", () => {
    const { ending } = nextRenewalEvents([
      dom({ domain: "undated.com", autorenew: false, expiresAt: null }),
      dom({ domain: "dated.com", autorenew: false, expiresAt: "2027-06-01T00:00:00Z" }),
    ]);
    expect(ending?.domain).toBe("dated.com");
  });

  it("carries a null price through rather than a zero", () => {
    const { ending } = nextRenewalEvents([
      dom({
        domain: "unpriced.com",
        autorenew: false,
        expiresAt: "2027-06-01T00:00:00Z",
        cost: { currency: null, renewalCents: null, renewalAt: null, usd: { renewalCents: null } },
      }),
    ]);
    expect(ending?.renewalCents).toBeNull();
    expect(ending?.renewalUsdCents).toBeNull();
    expect(ending?.currency).toBeNull();
  });

  it("answers null for an estate that states no date, never a fabricated row", () => {
    const { ending, renewing } = nextRenewalEvents([dom({ domain: "x.com" })]);
    expect(ending).toBeNull();
    expect(renewing).toBeNull();
  });
});

describe("issues", () => {
  it("never grades a domain the sweep has not probed", () => {
    // `dns === null` is "we know nothing about it", the opposite of "its
    // records are absent". The sweep covers the domains we own or send from.
    const issues = domainIssues([dom({ domain: "unprobed.com", dns: null, mailboxes: 5 })]);
    expect(issues.filter((i) => i.kind.startsWith("dns-"))).toHaveLength(0);
  });

  it("separates a missing record from a weak one", () => {
    const missing = domainIssues([
      dom({
        domain: "bare.com",
        dns: {
          spf: { present: false, allQualifier: null },
          dmarc: { present: false, policy: null },
          dkimSelectors: [],
          mx: [],
          errors: {},
        },
        mailboxes: 5,
      }),
    ]);
    expect(missing[0].kind).toBe("dns-missing");
    expect(missing[0].detail).toContain("SPF, DMARC, DKIM, MX");

    const weak = domainIssues([
      dom({
        domain: "soft.com",
        dns: {
          spf: { present: true, allQualifier: "?all" },
          dmarc: { present: true, policy: "none" },
          dkimSelectors: ["google"],
          mx: ["1 mx"],
          errors: {},
        },
        mailboxes: 5,
      }),
    ]);
    expect(weak.map((i) => i.kind)).toEqual(["dns-weak"]);
    expect(weak[0].detail).toContain("SPF and DMARC");
  });

  it("states an unread record as its own finding, never as an absent one", () => {
    const issues = domainIssues([
      dom({
        domain: "flaky.com",
        mailboxes: 5,
        dns: {
          spf: { present: true, allQualifier: "-all" },
          dmarc: { present: true, policy: "reject" },
          dkimSelectors: ["g"],
          mx: ["1 mx"],
          errors: { dmarc: "SERVFAIL" },
        },
      }),
    ]);
    expect(issues.map((i) => i.kind)).toEqual(["dns-unread"]);
  });

  it("splits 'nothing is sending' by CAUSE — the two need opposite actions", () => {
    // A recovery wave is instantly-service doing its job and returns on its
    // own; an idle domain with nothing recovering is stuck and needs a person.
    // 38 of 74 live domains had nothing in production on 2026-09-22 and all but
    // one was the recovery wave, so one finding made a temporary fleet event
    // read as 38 separate emergencies.
    const warming = domainIssues([
      dom({ domain: "warming.com", mailboxes: 5, addresses: { total: 5, byLifecycle: { in_recovery: 5 } } }),
    ]);
    expect(warming.map((i) => i.kind)).toEqual(["mostly-recovering"]);

    const stuck = domainIssues([
      dom({ domain: "stuck.com", mailboxes: 5, addresses: { total: 5, byLifecycle: { deactivated_by_instantly: 5 } } }),
    ]);
    expect(stuck.map((i) => i.kind)).toEqual(["no-mailboxes"]);
  });

  it("ranks a recovery wave BELOW everything a person has to do", () => {
    const issues = domainIssues([
      dom({ domain: "warming.com", mailboxes: 5, addresses: { total: 5, byLifecycle: { in_recovery: 5 } } }),
      dom({ domain: "stuck.com", mailboxes: 5, addresses: { total: 5, byLifecycle: { deactivated_by_instantly: 5 } } }),
    ]);
    expect(issues.map((i) => i.domain)).toEqual(["stuck.com", "warming.com"]);
  });

  it("flags a domain under the per-domain mailbox count, whatever it is doing today", () => {
    const thin = domainIssues([dom({ domain: "thin.com", mailboxes: RECOMMENDED_MAILBOXES - 1 })]);
    expect(thin.some((i) => i.kind === "thin-mailboxes")).toBe(true);
    const full = domainIssues([dom({ domain: "full.com", mailboxes: RECOMMENDED_MAILBOXES })]);
    expect(full.some((i) => i.kind === "thin-mailboxes")).toBe(false);
    // How many mailboxes a domain HOLDS is structural: buying more and waiting
    // for a recovery are two different jobs, so both lines stand.
    const both = domainIssues([
      dom({ domain: "both.com", mailboxes: 2, addresses: { total: 2, byLifecycle: { in_recovery: 2 } } }),
    ]);
    expect(both.map((i) => i.kind).sort()).toEqual(["mostly-recovering", "thin-mailboxes"]);
  });

  it("flags a domain whose mailboxes are mostly being warmed back up", () => {
    const issues = domainIssues([
      dom({
        domain: "warming.com",
        mailboxes: 5,
        addresses: { total: 5, byLifecycle: { in_production: 1, in_recovery: 4 } },
      }),
    ]);
    expect(issues.some((i) => i.kind === "mostly-recovering")).toBe(true);
  });

  it("flags a reputation problem off the measured placement, and only that", () => {
    const bad = domainIssues([
      dom({ domain: "spammy.com", mailboxes: 5, delivery: { inboxPct: DELIVERY_BAR_PCT - 1 } }),
    ]);
    expect(bad.map((i) => i.kind)).toEqual(["reputation"]);
    // Never measured is never a problem.
    const unmeasured = domainIssues([
      dom({ domain: "untested.com", mailboxes: 5, delivery: { inboxPct: null } }),
    ]);
    expect(unmeasured).toHaveLength(0);
  });

  it("never reports a reputation problem on a domain that is not sending", () => {
    // Being under the delivery bar is WHAT PUT those mailboxes in recovery, so
    // the finding would restate the gate as an alert. All 35 sub-bar domains on
    // the live estate are 100% in recovery, so an unscoped rule made this one
    // finding 35 of 117 and buried everything else.
    const issues = domainIssues([
      dom({
        domain: "warming.com",
        mailboxes: 5,
        addresses: { total: 5, byLifecycle: { in_recovery: 5 } },
        delivery: { inboxPct: 0 },
      }),
    ]);
    expect(issues.some((i) => i.kind === "reputation")).toBe(false);
  });

  it("orders findings by urgency, then by domain so a poll cannot shuffle them", () => {
    const issues = domainIssues([
      dom({ domain: "thin.com", mailboxes: 1, delivery: { inboxPct: null } }),
      dom({ domain: "spammy.com", mailboxes: 5, delivery: { inboxPct: 10 } }),
      dom({
        domain: "bare.com",
        mailboxes: 5,
        dns: {
          spf: { present: false, allQualifier: null },
          dmarc: { present: true, policy: "reject" },
          dkimSelectors: ["g"],
          mx: ["1 mx"],
          errors: {},
        },
      }),
    ]);
    expect(issues.map((i) => i.domain)).toEqual(["bare.com", "spammy.com", "thin.com"]);
  });

  it("reports nothing on a healthy live estate", () => {
    expect(domainIssues([dom({ domain: "good.com", mailboxes: 5 })])).toHaveLength(0);
  });
});

describe("grouping", () => {
  it("collapses to one row per kind and keeps the urgency order", () => {
    const groups = groupIssues(
      domainIssues([
        dom({ domain: "thin-a.com", mailboxes: 1 }),
        dom({ domain: "thin-b.com", mailboxes: 2 }),
        dom({
          domain: "bare.com",
          mailboxes: 5,
          dns: {
            spf: { present: false, allQualifier: null },
            dmarc: { present: true, policy: "reject" },
            dkimSelectors: ["g"],
            mx: ["1 mx"],
            errors: {},
          },
        }),
      ]),
    );
    expect(groups.map((g) => g.kind)).toEqual(["dns-missing", "thin-mailboxes"]);
    expect(groups[1].domains).toEqual(["thin-a.com", "thin-b.com"]);
  });

  it("drops nothing — every domain is still named under its kind", () => {
    // A rule that fires on most of the estate is a description of the fleet,
    // not a finding: 61 of 74 live domains hold fewer than five mailboxes
    // because Primeforge sells three-mailbox domains. Grouping stops it burying
    // the four missing-DMARC domains; it must not lose a single one.
    const issues = domainIssues(
      Array.from({ length: 30 }, (_, i) => dom({ domain: `d${i}.com`, mailboxes: 2 })),
    );
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0].domains).toHaveLength(30);
    expect(groups.reduce((n, g) => n + g.domains.length, 0)).toBe(issues.length);
  });

  it("takes each row's line from a real domain rather than re-writing it", () => {
    const groups = groupIssues(domainIssues([dom({ domain: "thin.com", mailboxes: 2 })]));
    expect(groups[0].sample.detail).toContain("2 mailboxes");
  });

  it("answers an empty list for a healthy estate", () => {
    expect(groupIssues([])).toEqual([]);
  });
});

describe("renewal window", () => {
  // The USD twin defaults to the native figure, so bucket sums read plainly.
  const priced = (
    domain: string,
    renewalAt: string | null,
    cents: number | null,
    currency = "EUR",
    usd: number | null = cents,
  ) => dom({ domain, cost: { currency, renewalCents: cents, renewalAt, usd: { renewalCents: usd } } });

  it("centres the window on today, seven buckets either side", () => {
    const w = renewalWindow([priced("a.com", "2026-12-21T00:00:00Z", 3838)], "monthly", NOW);
    expect(w.buckets).toHaveLength(BUCKETS_BACK + 1 + BUCKETS_FORWARD);
    expect(w.buckets.filter((b) => b.isCurrent)).toHaveLength(1);
    expect(w.buckets.find((b) => b.isCurrent)?.key).toBe("2026-09");
  });

  it("says a short window is EMPTY rather than drawing fifteen zero bars", () => {
    // Renewals are yearly events on ~74 domains: prod had 0 in the next 7 days
    // and 0 in the next 7 weeks against 28 in the next 7 months.
    const estate = [priced("a.com", "2026-12-21T00:00:00Z", 3838)];
    expect(renewalWindow(estate, "daily", NOW).empty).toBe(true);
    expect(renewalWindow(estate, "weekly", NOW).empty).toBe(true);
    expect(renewalWindow(estate, "monthly", NOW).empty).toBe(false);
  });

  it("splits past from future on the INSTANT, so one bucket can carry both", () => {
    const w = renewalWindow(
      [
        priced("paid.com", "2026-09-02T00:00:00Z", 1000),
        priced("due.com", "2026-09-30T00:00:00Z", 2000),
      ],
      "monthly", NOW,
    );
    const current = w.buckets.find((b) => b.isCurrent)!;
    expect(current.pastCents).toBe(1000);
    expect(current.futureCents).toBe(2000);
    expect(current.pastCount).toBe(1);
    expect(current.futureCount).toBe(1);
  });

  it("cumulates the FUTURE half on weekly and monthly, and never the past half", () => {
    const w = renewalWindow(
      [
        priced("past.com", "2026-08-10T00:00:00Z", 500),
        priced("soon.com", "2026-11-10T00:00:00Z", 1000),
        priced("later.com", "2026-12-10T00:00:00Z", 2000),
      ],
      "monthly", NOW,
    );
    const byKey = new Map(w.buckets.map((b) => [b.key, b]));
    // Past stays per-bucket: a running total backwards answers nothing.
    expect(byKey.get("2026-08")?.pastCents).toBe(500);
    // Future is a running commitment: 1000 by November, 3000 by December.
    expect(byKey.get("2026-11")?.futureCents).toBe(1000);
    expect(byKey.get("2026-12")?.futureCents).toBe(3000);
  });

  it("keeps the daily grain per-bucket — a cumulative fortnight says nothing", () => {
    const w = renewalWindow(
      [
        priced("a.com", "2026-09-24T00:00:00Z", 1000),
        priced("b.com", "2026-09-26T00:00:00Z", 2000),
      ],
      "daily", NOW,
    );
    const byKey = new Map(w.buckets.map((b) => [b.key, b]));
    expect(byKey.get("2026-09-24")?.futureCents).toBe(1000);
    expect(byKey.get("2026-09-26")?.futureCents).toBe(2000);
  });

  it("blends the whole estate in USD off the served twins, never the native euros", () => {
    const estate = [
      // €38.38 served as $43.80 at the producer's rate.
      priced("gandi.com", "2026-11-01T00:00:00Z", 3838, "EUR", 4380),
      priced("forge.com", "2026-11-01T00:00:00Z", 1400, "USD", 1400),
    ];
    const w = renewalWindow(estate, "monthly", NOW);
    const byKey = new Map(w.buckets.map((b) => [b.key, b]));
    expect(byKey.get("2026-11")?.futureCents).toBe(4380 + 1400);
    expect(byKey.get("2026-11")?.futureCount).toBe(2);
  });

  it("counts a priced renewal with no USD twin instead of summing it as zero", () => {
    // `usd: null` on a priced row = no EUR -> USD rate on record.
    const w = renewalWindow(
      [
        priced("forge.com", "2026-11-01T00:00:00Z", 1400, "USD", 1400),
        priced("gandi.com", "2026-11-01T00:00:00Z", 3838, "EUR", null),
      ],
      "monthly",
      NOW,
    );
    const byKey = new Map(w.buckets.map((b) => [b.key, b]));
    expect(byKey.get("2026-11")?.futureCents).toBe(1400);
    expect(w.unconvertibleInWindow).toBe(1);
    expect(w.unpricedInWindow).toBe(0);
  });

  it("counts an unpriced renewal instead of summing it as zero", () => {
    const w = renewalWindow(
      [
        priced("priced.com", "2026-11-01T00:00:00Z", 3838),
        priced("unpriced.com", "2026-11-01T00:00:00Z", null),
      ],
      "monthly", NOW,
    );
    const byKey = new Map(w.buckets.map((b) => [b.key, b]));
    expect(byKey.get("2026-11")?.futureCents).toBe(3838);
    expect(byKey.get("2026-11")?.futureCount).toBe(1);
    expect(w.unpricedInWindow).toBe(1);
  });

  it("counts a priced renewal with no date — no bucket can hold it", () => {
    const w = renewalWindow([priced("undated.com", null, 3838)], "monthly", NOW);
    expect(w.undated).toBe(1);
    expect(w.empty).toBe(true);
  });

  it("excludes a cancelled domain from every grain", () => {
    const estate = [
      dom({
        domain: "gone.com",
        cancelledAt: "2026-06-01T00:00:00Z",
        cost: {
          currency: "EUR",
          renewalCents: 3838,
          renewalAt: "2026-11-01T00:00:00Z",
          usd: { renewalCents: 4380 },
        },
      }),
    ];
    for (const grain of COST_GRAINS) {
      expect(renewalWindow(estate, grain, NOW).empty).toBe(true);
    }
  });

  it("anchors the weekly grain on a Monday so two polls cannot re-bucket a payment", () => {
    // 2026-09-22 is a Tuesday; its week starts Monday the 21st.
    const w = renewalWindow([priced("a.com", "2026-09-23T00:00:00Z", 100)], "weekly", NOW);
    expect(w.buckets.find((b) => b.isCurrent)?.key).toBe("2026-09-21");
  });
});
