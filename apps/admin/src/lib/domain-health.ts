import type { InstantlyAccountHealthRow } from "@/lib/api";

/**
 * Domain-level verdict for the Instantly sending fleet: which sending domains
 * are spent (delete them and stop paying), which are on their way out, and
 * which still work.
 *
 * A domain is the unit you actually cancel — mailboxes are sold per domain and
 * a dead one keeps billing — so the account table alone cannot answer "what do
 * I turn off this month". This module groups the accounts by domain, grades
 * each one, and rolls the accounts up into one verdict per domain.
 *
 * Type-only import above, so this module carries no runtime `@` alias import
 * and is unit-testable (vitest does not resolve `@` in this repo). Keep it that
 * way — a runtime import here turns its tests into resolution failures.
 */

/**
 * The bar both health scores must clear. Instantly's own scores are bimodal in
 * practice (a mailbox is near 100 or near 0), so the exact bar between ~85 and
 * ~95 reclassifies nothing: measured over the whole prod fleet on 2026-08-02,
 * 95 and 85 produce byte-identical verdicts for all 256 accounts. 95 is the
 * stricter of the two and matches the delivery bar instantly-service already
 * gates sending on.
 */
export const HEALTH_BAR = 95;

/** Assumed monthly price of ONE mailbox, by connection provider.
 *
 * Deliberately mailbox-only: a registered domain is not refunded when you stop
 * using it, so the number that answers "what does deleting this save me" is the
 * recurring mailbox subscription and nothing else.
 *
 * Published list prices, read 2026-08-02:
 *   google    — Google Workspace Business Starter, $7.00/user/mo on the annual
 *               plan ($8.40 flexible). workspace.google.com/pricing
 *   microsoft — Microsoft 365 Business Basic, $6.00/user/mo annual.
 *   imap      — Mailforge shared cold-email infrastructure, $3.00/mailbox/mo
 *               on monthly billing ($2-3 annual). mailforge.ai/pricing
 */
export const MAILBOX_MONTHLY_USD: Record<string, number> = {
  google: 7,
  microsoft: 6,
  imap: 3,
};

/**
 * How one mailbox reads.
 *
 * `dead`    — below the bar on a score AND nothing left in its queue. Nobody is
 *             waiting on it, so nothing breaks by removing it.
 * `dying`   — below the bar but still owes emails. It is on its way out, and
 *             deleting it now drops queued sends on the floor.
 * `healthy` — both scores at or above the bar.
 * `ungraded`— a score is absent on the wire. "We could not grade this" is not
 *             "it passed" and not "it failed", so it gets its own answer rather
 *             than a default in either direction.
 */
export type AccountHealthState = "dead" | "dying" | "healthy" | "ungraded";

/**
 * How one domain reads, rolled up from its mailboxes.
 *
 * `to-delete-now`  — every graded mailbox is dead. Cancel it.
 * `to-delete-soon` — NOT ONE mailbox clears the bar, but some still owe emails.
 *                    Let them drain, then cancel.
 * `mixed`          — a healthy mailbox sits next to one that is not. The domain
 *                    is decaying unevenly and needs a look.
 * `healthy`        — every graded mailbox clears the bar.
 * `not-graded`     — no mailbox on it could be graded at all.
 */
export type DomainHealthState =
  | "to-delete-now"
  | "to-delete-soon"
  | "mixed"
  | "healthy"
  | "not-graded";

export interface DomainAccount {
  email: string;
  /** The part before the `@`; the domain is already the row's identity. */
  localPart: string;
  accountType: string | null;
  warmupScore: number | null;
  inboxPct: number | null;
  /** Every un-sent step still queued to this mailbox. */
  queueSize: number;
  state: AccountHealthState;
}

export interface DomainHealthRow {
  domain: string;
  accounts: DomainAccount[];
  state: DomainHealthState;
  /** Distinct connection providers on this domain, in first-seen order. */
  providerTypes: (string | null)[];
  /**
   * Assumed monthly spend across this domain's mailboxes, or null when any
   * mailbox has a provider we have no published rate for. A partial sum would
   * read as the domain's real cost while understating it.
   */
  monthlyCostUsd: number | null;
}

/** Grade one mailbox. See `AccountHealthState` for what each answer means. */
export function accountHealthState(
  warmupScore: number | null,
  inboxPct: number | null,
  queueSize: number,
): AccountHealthState {
  if (warmupScore === null || inboxPct === null) return "ungraded";
  const belowBar = warmupScore < HEALTH_BAR || inboxPct < HEALTH_BAR;
  if (!belowBar) return "healthy";
  return queueSize === 0 ? "dead" : "dying";
}

/**
 * Roll a domain's mailboxes up into one verdict.
 *
 * Ungraded mailboxes are excluded from the roll-up rather than counted as a
 * pass or a fail: a domain is graded on what we could actually measure, and a
 * domain where we measured nothing says so.
 *
 * The branches are ordered and exhaustive — every combination lands somewhere,
 * so no domain can fall out of all four tabs.
 */
export function domainHealthState(
  states: AccountHealthState[],
): DomainHealthState {
  const graded = states.filter((s) => s !== "ungraded");
  if (graded.length === 0) return "not-graded";
  if (graded.every((s) => s === "dead")) return "to-delete-now";
  if (graded.every((s) => s === "healthy")) return "healthy";
  // One survivor is enough to make the domain a decision rather than a
  // cancellation: a live mailbox next to a spent one is a domain to look at,
  // not one to switch off. "To delete soon" therefore means NOT ONE mailbox
  // clears the bar — otherwise a domain still landing in inboxes would sit in
  // a tab whose whole promise is that it is on its way out.
  if (graded.some((s) => s === "healthy")) return "mixed";
  // Nothing healthy and not all dead: still draining, cancel once it has.
  return "to-delete-soon";
}

/**
 * What this domain's mailboxes cost per month, or null when a provider on it
 * has no published rate.
 */
export function domainMonthlyCostUsd(
  accountTypes: (string | null)[],
): number | null {
  let total = 0;
  for (const type of accountTypes) {
    const rate = type === null ? undefined : MAILBOX_MONTHLY_USD[type];
    if (rate === undefined) return null;
    total += rate;
  }
  return total;
}

/**
 * Group the account-health rows by sending domain and grade each one.
 *
 * Rows carrying no domain are dropped: the whole card is keyed on the domain,
 * and a malformed address has none to bill or cancel.
 *
 * Sorted by monthly cost descending — the card exists to answer "what do I turn
 * off", so the most expensive domain leads. Domains whose cost we cannot state
 * sort last, then by name so the order is stable.
 */
export function buildDomainHealthRows(
  rows: InstantlyAccountHealthRow[],
): DomainHealthRow[] {
  const byDomain = new Map<string, InstantlyAccountHealthRow[]>();
  for (const row of rows) {
    const domain = row.domain?.trim();
    if (!domain) continue;
    const bucket = byDomain.get(domain);
    if (bucket) bucket.push(row);
    else byDomain.set(domain, [row]);
  }

  const out: DomainHealthRow[] = [];
  for (const [domain, group] of byDomain) {
    const accounts: DomainAccount[] = group
      .map((row) => {
        const inboxPct = row.inboxPlacement?.inboxPct ?? null;
        return {
          email: row.email,
          localPart: row.email.split("@")[0] ?? row.email,
          accountType: row.accountType,
          warmupScore: row.warmupScore,
          inboxPct,
          queueSize: row.queueSize,
          state: accountHealthState(row.warmupScore, inboxPct, row.queueSize),
        };
      })
      .sort((a, b) => a.localPart.localeCompare(b.localPart));

    const providerTypes: (string | null)[] = [];
    for (const account of accounts) {
      if (!providerTypes.includes(account.accountType)) {
        providerTypes.push(account.accountType);
      }
    }

    out.push({
      domain,
      accounts,
      state: domainHealthState(accounts.map((a) => a.state)),
      providerTypes,
      monthlyCostUsd: domainMonthlyCostUsd(accounts.map((a) => a.accountType)),
    });
  }

  return out.sort((a, b) => {
    const ac = a.monthlyCostUsd;
    const bc = b.monthlyCostUsd;
    if (ac !== bc) {
      if (ac === null) return 1;
      if (bc === null) return -1;
      return bc - ac;
    }
    return a.domain.localeCompare(b.domain);
  });
}

/** Tab order, widest blast radius first. `not-graded` is last and only shown when it has rows. */
export const DOMAIN_TABS: { key: DomainHealthState; label: string }[] = [
  { key: "to-delete-now", label: "To delete now" },
  { key: "to-delete-soon", label: "To delete soon" },
  { key: "mixed", label: "Mix state" },
  { key: "healthy", label: "Healthy" },
  { key: "not-graded", label: "Not graded" },
];
