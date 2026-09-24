import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accountSendState,
  buildDomainHealthRows,
  domainHealthState,
  mergeDomainCost,
  DELETE_STATES,
  DOMAIN_TABS,
  type AccountSendState,
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
    vendorReportsMailboxes: true,
    monthlyCostCents: null,
    currency: "USD",
    costSource: "rate-card",
    recurringMonthlyCents: null,
    renewalCents: null,
    renewalAt: null,
    ...overrides,
    // The USD twin mirrors the native figures unless a test states its own.
    usd: {
      monthlyCostCents: overrides.monthlyCostCents ?? null,
      costPerEmailCents: null,
      recurringMonthlyCents: overrides.recurringMonthlyCents ?? null,
      renewalCents: overrides.renewalCents ?? null,
      ...overrides.usd,
    },
  };
}

/**
 * The Instantly audit's domain card answers "which sending domains do I cancel
 * this month". Three things it must never do: leave a domain out of every tab
 * (the roll-up has to be exhaustive), state a cost it cannot support, and offer
 * a domain for deletion on a mailbox that is still sending or still coming back.
 *
 * The verdict is instantly-service's `lifecycleStatus`, never a score
 * comparison of ours — see the module header for the three ways the local grade
 * had drifted against the fleet it was grading.
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

describe("reading the producer's verdict", () => {
  it("maps each documented lifecycle to exactly one send state", () => {
    expect(accountSendState("in_production")).toBe("sending");
    expect(accountSendState("in_recovery")).toBe("recovering");
    expect(accountSendState("deactivated_by_instantly")).toBe("stopped");
    expect(accountSendState("deactivated_by_user")).toBe("held");
  });

  it("answers ungraded for an absent or unknown lifecycle, never a default", () => {
    // A token the producer adds later must read as "we could not grade this",
    // which is true, rather than silently joining whichever bucket was the
    // fallback.
    expect(accountSendState(null)).toBe("ungraded");
    expect(accountSendState("unclassified")).toBe("ungraded");
    expect(accountSendState("some_future_state")).toBe("ungraded");
  });

  it("grades on the lifecycle ALONE — no score can move the answer", () => {
    // The whole point of the rewrite. A promoted mailbox's health score resets
    // toward 0 (instantly-service sets IN_PRODUCTION_WARMUP_DAILY = 0 and the
    // score is a rolling 7-day window), and being under the delivery bar is
    // what recovery MEANS. Neither may change the verdict.
    const rows = buildDomainHealthRows([
      acct({
        email: "fresh@promoted.com",
        lifecycleStatus: "in_production",
        warmupScore: 0,
        inboxPlacement: { inboxPct: 0, spamPct: 100, missingPct: 0, testedAt: "2026-09-01T00:00:00Z" },
      }),
    ]);
    expect(rows[0].accounts[0].state).toBe("sending");
    expect(rows[0].state).toBe("healthy");
  });
});

describe("domain roll-up", () => {
  const at = (state: AccountSendState, queueSize = 0) => ({ state, queueSize });

  it("is exhaustive — every combination lands in a tab", () => {
    const states: AccountSendState[] = ["sending", "recovering", "stopped", "held", "ungraded"];
    const tabKeys = new Set(DOMAIN_TABS.map((t) => t.key));
    for (const a of states) {
      expect(tabKeys.has(domainHealthState([at(a)]))).toBe(true);
      for (const b of states) {
        expect(tabKeys.has(domainHealthState([at(a), at(b)]))).toBe(true);
        for (const c of states) {
          // Run each combination with and without a queue, since the queue is
          // the only thing that splits the two delete verdicts.
          expect(tabKeys.has(domainHealthState([at(a), at(b), at(c)]))).toBe(true);
          expect(tabKeys.has(domainHealthState([at(a), at(b), at(c, 9)]))).toBe(true);
        }
      }
    }
  });

  it("only a vendor-stopped mailbox can put a domain on the delete list", () => {
    expect(domainHealthState([at("stopped"), at("stopped")])).toBe("to-delete-now");
    // Still owes emails: let them drain before cancelling.
    expect(domainHealthState([at("stopped"), at("stopped", 7)])).toBe("to-delete-soon");
  });

  it("never offers a domain with a SENDING mailbox for deletion", () => {
    // The single worst outcome: cancelling a domain the selector is assigning
    // work to right now.
    const deletes = new Set<string>(DELETE_STATES);
    expect(deletes.has(domainHealthState([at("sending")]))).toBe(false);
    expect(deletes.has(domainHealthState([at("sending"), at("stopped")]))).toBe(false);
    expect(deletes.has(domainHealthState([at("sending", 400), at("stopped")]))).toBe(false);
    expect(domainHealthState([at("sending"), at("stopped")])).toBe("mixed");
    expect(domainHealthState([at("sending"), at("sending")])).toBe("healthy");
  });

  it("never offers a RECOVERING domain for deletion — it is coming back", () => {
    // 198 of 294 prod mailboxes were in recovery on 2026-09-22. Being under the
    // delivery bar is what put them there, so re-grading on delivery reproduced
    // the gate and called the result a cancellation.
    const deletes = new Set<string>(DELETE_STATES);
    expect(domainHealthState([at("recovering")])).toBe("recovering");
    expect(domainHealthState([at("recovering"), at("stopped")])).toBe("recovering");
    expect(deletes.has(domainHealthState([at("recovering"), at("stopped", 3)]))).toBe(false);
  });

  it("holds a policy-pinned domain out of the delete list entirely", () => {
    // The brand estate, pinned out of cold email via instantly_domain_policy.
    // It is not a fault and it is not a cancellation.
    expect(domainHealthState([at("held")])).toBe("held");
    expect(domainHealthState([at("held"), at("held")])).toBe("held");
  });

  it("drops a held mailbox from the live read rather than grading on it", () => {
    // A held mailbox says nothing about whether the REST of the domain works,
    // so it neither rescues a spent domain nor condemns a working one.
    expect(domainHealthState([at("held"), at("sending")])).toBe("healthy");
    expect(domainHealthState([at("held"), at("stopped")])).toBe("to-delete-now");
    expect(domainHealthState([at("held"), at("recovering")])).toBe("recovering");
  });

  it("grades on what it could read, and says so when it read nothing", () => {
    expect(domainHealthState([at("ungraded"), at("sending")])).toBe("healthy");
    expect(domainHealthState([at("ungraded"), at("stopped")])).toBe("to-delete-now");
    expect(domainHealthState([at("ungraded"), at("ungraded")])).toBe("not-graded");
    expect(domainHealthState([])).toBe("not-graded");
  });

  it("counts the queue over the LIVE mailboxes, not the held ones", () => {
    // A held mailbox's queue is not a reason to delay cancelling the spent
    // mailboxes beside it — nothing is draining through a pinned address.
    expect(domainHealthState([at("held", 500), at("stopped")])).toBe("to-delete-now");
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

  it("sums two currencies in USD off the served twins, never the native cents", () => {
    const cost = mergeDomainCost([
      // €38.38 served as $43.80 at the producer's rate.
      infra({ currency: "EUR", renewalCents: 3838, usd: { monthlyCostCents: null, costPerEmailCents: null, recurringMonthlyCents: null, renewalCents: 4380 } }),
      infra({ currency: "USD", recurringMonthlyCents: 500 }),
    ]);
    expect(cost?.renewalCents).toBe(4380);
    expect(cost?.recurringCents).toBe(500);
    expect(cost?.unconvertible).toBe(false);
  });

  it("marks a priced domain with no USD twin unconvertible, never a zero", () => {
    // `usd: null` on a priced row = no EUR -> USD rate on record.
    const cost = mergeDomainCost([
      infra({ currency: "EUR", renewalCents: 3838, usd: { monthlyCostCents: null, costPerEmailCents: null, recurringMonthlyCents: null, renewalCents: null } }),
    ]);
    expect(cost?.unconvertible).toBe(true);
    expect(cost?.renewalCents).toBeNull();
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
    // A euro renewal reads as the USD twin the producer served beside it.
    expect(rows[0].cost?.renewalCents).toBe(3838);
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
    const rows = buildDomainHealthRows([
      acct({ email: "a@spent.com", lifecycleStatus: "deactivated_by_instantly", queueSize: 0 }),
      acct({ email: "b@spent.com", lifecycleStatus: "deactivated_by_instantly", queueSize: 0 }),
    ]);
    expect(rows[0].state).toBe("to-delete-now");
    expect(rows[0].accounts.every((a) => a.state === "stopped")).toBe(true);
  });

  it("carries the producer's reason through for the hover", () => {
    const rows = buildDomainHealthRows([
      acct({
        email: "a@warming.com",
        lifecycleStatus: "in_recovery",
        lifecycleReason: "delivery_below_bar",
      }),
    ]);
    expect(rows[0].accounts[0].lifecycleStatus).toBe("in_recovery");
    expect(rows[0].accounts[0].lifecycleReason).toBe("delivery_below_bar");
    expect(rows[0].state).toBe("recovering");
  });

  it("reproduces the prod verdict split the old grading got wrong", () => {
    // Measured against /internal/audit/account-health on 2026-09-22: the score
    // grading read 240 of 294 mailboxes as dead or dying and offered 48 of 68
    // domains for deletion. Only a vendor-stopped mailbox can do that now.
    const rows = buildDomainHealthRows([
      // 196 of prod's in_recovery mailboxes carry exactly this reason.
      acct({ email: "a@warming.com", lifecycleStatus: "in_recovery", lifecycleReason: "delivery_below_bar", warmupScore: 12 }),
      // A freshly promoted mailbox: warmup daily is 0, so the rolling score sinks.
      acct({ email: "b@sending.com", lifecycleStatus: "in_production", lifecycleReason: "passed", warmupScore: 8 }),
      // The brand estate, pinned out of cold email by policy.
      acct({ email: "c@brand.com", lifecycleStatus: "deactivated_by_user", lifecycleReason: "brand_domain" }),
      // The only genuinely cancellable shape.
      acct({ email: "d@spent.com", lifecycleStatus: "deactivated_by_instantly", lifecycleReason: "deactivated_by_instantly" }),
    ]);
    const byDomain = new Map(rows.map((r) => [r.domain, r.state]));
    expect(byDomain.get("warming.com")).toBe("recovering");
    expect(byDomain.get("sending.com")).toBe("healthy");
    expect(byDomain.get("brand.com")).toBe("held");
    expect(byDomain.get("spent.com")).toBe("to-delete-now");
    expect(rows.filter((r) => (DELETE_STATES as readonly string[]).includes(r.state))).toHaveLength(1);
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

  it("re-derives no verdict of its own — the scores reach the hover and nothing else", () => {
    // The card may DISPLAY Instantly's scores; it may not compare them. A
    // threshold here would be the bug this rewrite removed, rebuilt one
    // component over.
    expect(card).not.toMatch(/warmupScore\s*[<>]/);
    expect(card).not.toMatch(/inboxPct\s*[<>]/);
    expect(card).toContain("lifecycleLabel(account.lifecycleStatus)");
  });

  it("draws the BILLING vendor, a different concept from the connection protocol", () => {
    expect(card).toContain("<VendorLogo key={v} provider={v} />");
    expect(card).toContain("<ProviderLogo");
  });

  it("renders an unstateable cost as a dash, never a zero", () => {
    expect(card).toContain("row.cost?.recurringCents == null");
    expect(card).toContain("row.cost?.renewalCents == null");
  });

  it("states every figure in USD and names the rate it was converted at", () => {
    expect(card).toContain('currency: "USD"');
    // The rate is read off the served `fx`, never a constant.
    expect(card).toContain("fxRateLine(infra.fx)");
    expect(card).toContain("FX_UNAVAILABLE_NOTE");
    expect(card).not.toMatch(/1\.1[0-9]{2,}/);
    // A priced domain with no USD twin says so rather than printing a dash.
    expect(card).toContain("row.cost?.unconvertible");
  });

  it("states no price of its own — every rate comes from the measured inventory", () => {
    expect(card).not.toContain("MAILBOX_MONTHLY_USD");
    expect(card).not.toMatch(/google: *[0-9]|imap: *[0-9]|microsoft: *[0-9]/);
  });

  it("totals only the recurring half — renewals are already paid", () => {
    expect(card).toContain("recurring in this tab");
  });

  it("holds no bar of its own — the grading module is gone and stays gone", () => {
    expect(card).not.toContain("HEALTH_BAR");
    expect(card).not.toMatch(/=== *9[05]|< *9[05]/);
  });
});
