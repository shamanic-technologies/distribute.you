import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accountHealthState,
  buildDomainHealthRows,
  domainHealthState,
  mergeDomainCost,
  DOMAIN_TABS,
  HEALTH_BAR,
  type AccountHealthState,
} from "../src/lib/domain-health";
import type { InstantlyInfraDomainRow } from "@/lib/api";

/** One inventory row as instantly-service serves it. */
function infra(
  overrides: Partial<InstantlyInfraDomainRow> = {},
): InstantlyInfraDomainRow {
  return {
    domain: "example.com",
    provider: "primeforge",
    expiresAt: null,
    autorenew: null,
    cancelledAt: null,
    absentSince: null,
    vendorMailboxes: 0,
    monthlyCostCents: null,
    currency: "USD",
    costSource: "rate-card",
    recurringMonthlyCents: null,
    renewalCents: null,
    renewalAt: null,
    ...overrides,
  };
}

/**
 * The Instantly audit's domain card answers "which sending domains do I cancel
 * this month". Two things it must never do: leave a domain out of every tab
 * (the roll-up has to be exhaustive), and state a cost or a verdict it cannot
 * actually support.
 */

type Row = Parameters<typeof buildDomainHealthRows>[0][number];

function acct(over: Partial<Row> & { email: string }): Row {
  const base = {
    status: "active",
    warmupScore: 100,
    warmupLimit: null,
    dailyLimit: 45,
    blocked: false,
    blockReason: null,
    lifecycleStatus: "in_production",
    lifecycleReason: null,
    lifecycleUpdatedAt: null,
    inboxPlacement: { inboxPct: 100, spamPct: 0, missingPct: 0, testedAt: "2026-08-01T00:00:00Z" },
    sentYesterday: 0,
    sentToday: 0,
    queueSize: 0,
    queuedSequences: 0,
    queuedFirstUnsent: 0,
    queuedFirstUnsentSequences: 0,
    queuedNextToday: 0,
    queuedNextTomorrow: 0,
    queuedNextLater: 0,
    accountType: "imap",
  };
  // `domain` defaults to the address's own host, so a fixture only states it
  // when it is deliberately absent.
  const domain =
    "domain" in over ? over.domain : (over.email.split("@")[1] ?? null);
  return { ...base, ...over, domain } as Row;
}

describe("account grading", () => {
  it("needs BOTH scores at the bar to call a mailbox healthy", () => {
    expect(accountHealthState(100, 100, 0)).toBe("healthy");
    expect(accountHealthState(HEALTH_BAR, HEALTH_BAR, 0)).toBe("healthy");
    // A perfect health score does not rescue a mailbox landing in spam.
    expect(accountHealthState(100, 40, 0)).toBe("dead");
    expect(accountHealthState(40, 100, 0)).toBe("dead");
  });

  it("separates dead from dying by what the mailbox still owes", () => {
    // Nothing queued: nobody is waiting on it, so it can go now.
    expect(accountHealthState(20, 20, 0)).toBe("dead");
    // Still draining: deleting it now would drop queued sends.
    expect(accountHealthState(20, 20, 7)).toBe("dying");
  });

  it("a queue never makes a below-bar mailbox read healthy", () => {
    expect(accountHealthState(10, 10, 500)).toBe("dying");
  });

  it("answers ungraded when a score is absent, never a pass or a fail", () => {
    expect(accountHealthState(null, 100, 0)).toBe("ungraded");
    expect(accountHealthState(100, null, 0)).toBe("ungraded");
    expect(accountHealthState(null, null, 0)).toBe("ungraded");
  });
});

describe("domain roll-up", () => {
  it("is exhaustive — every combination lands in a tab", () => {
    const states: AccountHealthState[] = ["dead", "dying", "healthy", "ungraded"];
    const tabKeys = new Set(DOMAIN_TABS.map((t) => t.key));
    // Every non-empty combination of up to three mailboxes.
    for (const a of states) {
      expect(tabKeys.has(domainHealthState([a]))).toBe(true);
      for (const b of states) {
        expect(tabKeys.has(domainHealthState([a, b]))).toBe(true);
        for (const c of states) {
          expect(tabKeys.has(domainHealthState([a, b, c]))).toBe(true);
        }
      }
    }
  });

  it("reads the four verdicts as specified", () => {
    expect(domainHealthState(["dead", "dead"])).toBe("to-delete-now");
    expect(domainHealthState(["healthy", "healthy"])).toBe("healthy");
    expect(domainHealthState(["dead", "healthy"])).toBe("mixed");
    expect(domainHealthState(["dying", "dying"])).toBe("to-delete-soon");
  });

  it("covers the gap a dead-plus-dying domain would otherwise fall through", () => {
    // No healthy mailbox, so it is not mixed; not all dead, so it is not
    // deletable yet. This combination matched none of the original four rules.
    expect(domainHealthState(["dead", "dying"])).toBe("to-delete-soon");
  });

  it("never calls a domain deletable while one mailbox still clears the bar", () => {
    // "To delete soon" promises the whole domain is on its way out. One live
    // mailbox makes it a decision instead — prod's axionmilestone.com is four
    // dying mailboxes beside one at 100/100 with 29 emails queued.
    expect(domainHealthState(["healthy", "dying"])).toBe("mixed");
    expect(domainHealthState(["healthy", "dying", "dying", "dying"])).toBe("mixed");
  });

  it("grades on what it could measure, and says so when it measured nothing", () => {
    expect(domainHealthState(["ungraded", "healthy"])).toBe("healthy");
    expect(domainHealthState(["ungraded", "dead"])).toBe("to-delete-now");
    expect(domainHealthState(["ungraded", "ungraded"])).toBe("not-graded");
    expect(domainHealthState([])).toBe("not-graded");
  });
});

describe("measured cost", () => {
  it("keeps the two savings apart — one stops now, the other only at renewal", () => {
    const cost = mergeDomainCost([
      infra({ recurringMonthlyCents: 45000, renewalCents: 1400, renewalAt: "2027-07-07T00:00:00Z" }),
    ]);

    expect(cost?.recurringCents).toBe(45000);
    expect(cost?.renewalCents).toBe(1400);
    expect(cost?.renewalAt).toBe("2027-07-07T00:00:00Z");
  });

  it("sums a domain reported by two vendors rather than picking one", () => {
    const cost = mergeDomainCost([
      infra({ provider: "gandi", currency: "USD", renewalCents: 3838, renewalAt: "2027-05-01T00:00:00Z" }),
      infra({ provider: "mailforge", currency: "USD", recurringMonthlyCents: 500, renewalCents: 1400, renewalAt: "2027-02-01T00:00:00Z" }),
    ]);

    expect(cost?.renewalCents).toBe(5238);
    expect(cost?.recurringCents).toBe(500);
    // The soonest renewal is the one that forces a decision.
    expect(cost?.renewalAt).toBe("2027-02-01T00:00:00Z");
  });

  it("states nothing rather than blending two currencies", () => {
    expect(
      mergeDomainCost([
        infra({ currency: "EUR", renewalCents: 3838 }),
        infra({ currency: "USD", recurringMonthlyCents: 500 }),
      ]),
    ).toBeNull();
  });

  it("saves nothing on a cancelled or vanished domain — it already bills nothing", () => {
    expect(
      mergeDomainCost([infra({ cancelledAt: "2026-05-02T00:00:00Z", recurringMonthlyCents: 5000 })]),
    ).toBeNull();
    expect(
      mergeDomainCost([infra({ absentSince: "2026-07-01T00:00:00Z", recurringMonthlyCents: 5000 })]),
    ).toBeNull();
  });

  it("states nothing when no vendor prices the domain", () => {
    expect(mergeDomainCost([infra()])).toBeNull();
    expect(mergeDomainCost([])).toBeNull();
  });

  it("marks the source mixed when vendors disagree on where the price came from", () => {
    const cost = mergeDomainCost([
      infra({ costSource: "api", renewalCents: 100 }),
      infra({ costSource: "rate-card", recurringMonthlyCents: 200 }),
    ]);
    expect(cost?.source).toBe("mixed");
  });
});

describe("buildDomainHealthRows", () => {
  it("groups by domain and leads with what is still bleeding every month", () => {
    const rows = buildDomainHealthRows(
      [
        acct({ email: "a@cheap.com", accountType: "imap" }),
        acct({ email: "b@pricey.com", accountType: "google" }),
        acct({ email: "c@pricey.com", accountType: "google" }),
      ],
      [
        infra({ domain: "cheap.com", recurringMonthlyCents: 500 }),
        infra({ domain: "pricey.com", recurringMonthlyCents: 9000 }),
      ],
    );
    expect(rows.map((r) => r.domain)).toEqual(["pricey.com", "cheap.com"]);
    expect(rows[0].cost?.recurringCents).toBe(9000);
    expect(rows[0].accounts).toHaveLength(2);
  });

  it("ranks a recurring cost above a renewal already paid until next year", () => {
    const rows = buildDomainHealthRows(
      [
        acct({ email: "a@gandi.com", accountType: "imap" }),
        acct({ email: "b@slots.com", accountType: "google" }),
      ],
      [
        // A big renewal, but not due until 2027 — a diary entry, not an urgency.
        infra({ domain: "gandi.com", provider: "gandi", renewalCents: 16800, renewalAt: "2027-05-19T00:00:00Z" }),
        // Small, but leaving the account every single month.
        infra({ domain: "slots.com", recurringMonthlyCents: 450 }),
      ],
    );
    expect(rows.map((r) => r.domain)).toEqual(["slots.com", "gandi.com"]);
  });

  it("sorts an unstateable cost last instead of treating it as zero", () => {
    const rows = buildDomainHealthRows(
      [
        acct({ email: "a@unknown.com", accountType: null }),
        acct({ email: "b@known.com", accountType: "imap" }),
      ],
      [infra({ domain: "known.com", recurringMonthlyCents: 300 })],
    );
    expect(rows.map((r) => r.domain)).toEqual(["known.com", "unknown.com"]);
    expect(rows[1].cost).toBeNull();
  });

  it("carries the vendor and the expiry the accounts table cannot know", () => {
    const rows = buildDomainHealthRows(
      [acct({ email: "a@growthagency.dev", accountType: "imap" })],
      [
        infra({
          domain: "growthagency.dev",
          provider: "gandi",
          expiresAt: "2027-02-03T00:00:00Z",
          autorenew: false,
          renewalCents: 3838,
          currency: "EUR",
        }),
      ],
    );
    expect(rows[0].vendors).toEqual(["gandi"]);
    expect(rows[0].expiresAt).toBe("2027-02-03T00:00:00Z");
    expect(rows[0].autorenew).toBe(false);
    expect(rows[0].cost?.currency).toBe("EUR");
  });

  it("still grades every domain when the inventory is unavailable", () => {
    // The money degrades to a dash; the verdict reads health and must survive.
    const rows = buildDomainHealthRows([acct({ email: "a@x.com", accountType: "imap" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cost).toBeNull();
    expect(rows[0].state).toBeDefined();
  });

  it("drops a row with no domain — there is nothing to bill or cancel", () => {
    const rows = buildDomainHealthRows([
      acct({ email: "broken", domain: null }),
      acct({ email: "ok@real.com" }),
    ]);
    expect(rows.map((r) => r.domain)).toEqual(["real.com"]);
  });

  it("carries the verdict through from the mailboxes", () => {
    const dead = { warmupScore: 10, inboxPct: 10 };
    const rows = buildDomainHealthRows([
      acct({
        email: "a@spent.com",
        warmupScore: dead.warmupScore,
        inboxPlacement: {
          inboxPct: dead.inboxPct,
          spamPct: 90,
          missingPct: 0,
          testedAt: "2026-08-01T00:00:00Z",
        },
        queueSize: 0,
      }),
      acct({
        email: "b@spent.com",
        warmupScore: dead.warmupScore,
        inboxPlacement: {
          inboxPct: dead.inboxPct,
          spamPct: 90,
          missingPct: 0,
          testedAt: "2026-08-01T00:00:00Z",
        },
        queueSize: 0,
      }),
    ]);
    expect(rows[0].state).toBe("to-delete-now");
    expect(rows[0].accounts.every((a) => a.state === "dead")).toBe(true);
  });

  it("lists each distinct provider on the domain once", () => {
    const rows = buildDomainHealthRows([
      acct({ email: "a@mix.com", accountType: "google" }),
      acct({ email: "b@mix.com", accountType: "imap" }),
      acct({ email: "c@mix.com", accountType: "google" }),
    ]);
    expect(rows[0].providerTypes).toEqual(["google", "imap"]);
  });
});

describe("the card renders the verdict, not a second opinion", () => {
  const CARD = join(__dirname, "../src/components/audit/domain-health-card.tsx");
  const card = readFileSync(CARD, "utf8");

  it("shares the accounts table's query so the two cannot disagree", () => {
    expect(card).toContain('["instantlyAccountHealth"]');
  });

  it("colours every cell by the verdict, never by a raw score band", () => {
    // A chip coloured on the score while the pill beside it states the verdict
    // is the same row contradicting itself.
    expect(card).toContain("ACCOUNT_TONE[account.state]");
    expect(card).toContain("DOMAIN_PILL[row.state]");
    expect(card).not.toContain("warmupScore >= ");
    expect(card).not.toContain("inboxPct >= ");
  });

  it("renders an unstateable cost as a dash, never a zero", () => {
    expect(card).toContain("row.cost?.recurringCents == null");
    expect(card).toContain("row.cost?.renewalCents == null");
  });

  it("carries the currency with every figure instead of assuming dollars", () => {
    expect(card).toContain("money(");
    // A hardcoded dollar sign would misprice the whole Gandi estate, which
    // invoices in euros.
    expect(card).not.toMatch(/\$\$\{/);
  });

  it("states no price of its own — every rate comes from the measured inventory", () => {
    expect(card).not.toContain("MAILBOX_MONTHLY_USD");
    expect(card).not.toMatch(/google: *[0-9]|imap: *[0-9]|microsoft: *[0-9]/);
  });

  it("totals only the recurring half — renewals are already paid", () => {
    expect(card).toContain("recurring in this tab");
  });

  it("takes the bar from the one module that defines it", () => {
    expect(card).toContain("HEALTH_BAR");
    expect(card).not.toMatch(/=== *95|< *95/);
  });
});
