import type { InstantlyAccountHealthRow, InstantlyInfraDomainRow } from "@/lib/api";

/**
 * Domain-level verdict for the Instantly sending fleet: which sending domains
 * are spent (delete them and stop paying), which are held out of cold email on
 * purpose, and which still work.
 *
 * A domain is the unit you actually cancel — mailboxes are sold per domain and
 * a dead one keeps billing — so the account table alone cannot answer "what do
 * I turn off this month". This module groups the accounts by domain, reads each
 * mailbox's verdict OFF THE WIRE, and rolls them up into one verdict per domain.
 *
 * ⚠️ THE VERDICT IS instantly-service's, NEVER RE-DERIVED HERE. This module used
 * to grade each mailbox itself, at its own bar, against `warmupScore` and
 * `inboxPct` — two answers to one question, and the local one had drifted three
 * ways against the fleet it was grading (measured 2026-09-22, 240 of 294
 * mailboxes read dead or dying, 48 of 68 domains offered for deletion):
 *
 *   1. An `in_recovery` mailbox is UNDER the delivery bar BY DEFINITION — that
 *      is what put it in recovery — so re-grading it on delivery reproduced the
 *      gate and called the result a delete verdict. 178 of 198 read dead/dying.
 *      Recovery is instantly-service warming a mailbox back up, not a
 *      cancellation.
 *   2. instantly-service sets `IN_PRODUCTION_WARMUP_DAILY = 0` and Instantly's
 *      health score is a rolling 7-day window, so PROMOTION RESETS THE SCORE
 *      toward 0. The service treats health as an ENTRY bar only, never as
 *      continued membership (its `deriveLifecycle` takes the current status for
 *      exactly this reason). Grading it symmetrically flagged 34 of 88 of the
 *      fleet's best senders as dying while they were being assigned sends.
 *   3. `deactivated_by_user` is the brand estate, pinned out of cold email on
 *      purpose via `instantly_domain_policy`. It read as dead and was offered
 *      for deletion.
 *
 * `lifecycleStatus` is the SAME field the live send path gates on, so the card
 * and the sender can no longer disagree. `lifecycleReason` rides beside it for
 * the hover.
 *
 * Type-only import above, so this module carries no runtime `@` alias import
 * and is unit-testable (vitest does not resolve `@` in this repo). Keep it that
 * way — a runtime import here turns its tests into resolution failures.
 */

/**
 * How one mailbox reads, as instantly-service already decided.
 *
 * `sending`    — `in_production`. Send-eligible; the selector is assigning it
 *                work right now. Never a delete candidate.
 * `recovering` — `in_recovery`. Held out of new sends while the service warms
 *                it back up. It is expected to return, so it is not a
 *                cancellation either.
 * `stopped`    — `deactivated_by_instantly`. The vendor killed it; nothing we
 *                do brings it back. THIS is what "spent" means.
 * `held`       — `deactivated_by_user`. Deliberately out of cold email (a brand
 *                domain, pinned by policy). Excluded from the delete list
 *                entirely rather than graded.
 * `ungraded`   — no lifecycle on the wire. "We could not read this" is not
 *                "it passed" and not "it failed", so it gets its own answer.
 */
export type AccountSendState =
  | "sending"
  | "recovering"
  | "stopped"
  | "held"
  | "ungraded";

/**
 * How one domain reads, rolled up from its mailboxes.
 *
 * `to-delete-now`  — nothing on it will ever send again AND nothing is queued.
 *                    Cancel it.
 * `to-delete-soon` — nothing will ever send again, but emails are still queued
 *                    to it. Let them drain, then cancel.
 * `recovering`     — nothing is sending today, but at least one mailbox is
 *                    being warmed back up. Wait, do not cancel.
 * `mixed`          — a sending mailbox sits beside one that is not.
 * `healthy`        — every mailbox that counts is sending.
 * `held`           — every mailbox is held out of cold email by policy. Not a
 *                    delete candidate at all, and not a fault.
 * `not-graded`     — no mailbox on it carried a lifecycle.
 */
export type DomainHealthState =
  | "to-delete-now"
  | "to-delete-soon"
  | "recovering"
  | "mixed"
  | "healthy"
  | "held"
  | "not-graded";

/** The domain verdicts that mean "stop paying for this". */
export const DELETE_STATES: readonly DomainHealthState[] = [
  "to-delete-now",
  "to-delete-soon",
];

export interface DomainAccount {
  email: string;
  /** The part before the `@`; the domain is already the row's identity. */
  localPart: string;
  accountType: string | null;
  /** The producer's own lifecycle token, rendered verbatim where it is labelled. */
  lifecycleStatus: string | null;
  /** The producer's machine reason for that lifecycle, for the hover. Null when it stated none. */
  lifecycleReason: string | null;
  /** Instantly's Health Score, DISPLAYED only. Nothing here grades on it. */
  warmupScore: number | null;
  /** Measured inbox placement, DISPLAYED only. Nothing here grades on it. */
  inboxPct: number | null;
  /** Every un-sent step still queued to this mailbox. */
  queueSize: number;
  state: AccountSendState;
}

export interface DomainHealthRow {
  domain: string;
  accounts: DomainAccount[];
  state: DomainHealthState;
  /** Distinct connection providers on this domain, in first-seen order. */
  providerTypes: (string | null)[];
  /**
   * What this domain actually costs, measured — the vendors we buy from and
   * what they charge us, not a list price guessed from the connection
   * protocol. Null when nothing prices it; never a substitute figure.
   *
   * Split because "what do I save by cancelling" has two answers:
   * `recurringCents` stops the moment you cancel, while `renewalCents` is
   * already paid until `renewalAt` and is only avoided at that date.
   */
  cost: DomainCost | null;
  /** Vendors that report this domain (`gandi`, `primeforge`, …), not the connection protocol. */
  vendors: string[];
  /** When the registration lapses, and whether it renews itself. */
  expiresAt: string | null;
  autorenew: boolean | null;
}

export interface DomainCost {
  /** Stops billing the moment the domain is cancelled. Null when nothing recurring. */
  recurringCents: number | null;
  /** The yearly registration avoided at `renewalAt`. Null when nothing to renew. */
  renewalCents: number | null;
  renewalAt: string | null;
  currency: string;
  /** `api` (the vendor told us) or `rate-card` (a versioned local row). */
  source: string | null;
}

/**
 * Read one mailbox's verdict off the producer's own lifecycle token.
 *
 * NOTHING is computed here: the map is total over the four states
 * instantly-service documents, and an unknown or absent token is `ungraded`
 * rather than folded into a default. A token the producer adds later therefore
 * reads as "we could not grade this" — which is true — instead of silently
 * joining whichever bucket happened to be the fallback.
 */
export function accountSendState(lifecycleStatus: string | null): AccountSendState {
  switch (lifecycleStatus) {
    case "in_production":
      return "sending";
    case "in_recovery":
      return "recovering";
    case "deactivated_by_instantly":
      return "stopped";
    case "deactivated_by_user":
      return "held";
    default:
      return "ungraded";
  }
}

/**
 * Roll a domain's mailboxes up into one verdict.
 *
 * "To delete" means NOTHING ON THIS DOMAIN WILL EVER SEND AGAIN — not "it
 * scored under a bar". So a mailbox the vendor killed is the only thing that
 * can put a domain on the delete list, a mailbox being warmed back up keeps it
 * off, and a mailbox we pinned out of cold email on purpose is not a verdict
 * about the domain at all.
 *
 * `held` mailboxes are dropped before the live read rather than counted as a
 * pass or a fail: a brand domain excluded from cold email by policy says
 * nothing about whether the rest of the domain works. A domain where EVERY
 * mailbox is held reads `held`, which is its own answer and never a delete.
 *
 * Ungraded mailboxes are excluded for the same reason — a domain is graded on
 * what we could actually read, and one where we read nothing says so.
 *
 * The branches are ordered and exhaustive: every combination lands somewhere,
 * so no domain can fall out of all the tabs.
 */
export function domainHealthState(
  accounts: readonly { state: AccountSendState; queueSize: number }[],
): DomainHealthState {
  const graded = accounts.filter((a) => a.state !== "ungraded");
  if (graded.length === 0) return "not-graded";
  if (graded.every((a) => a.state === "held")) return "held";

  const live = graded.filter((a) => a.state !== "held");
  if (live.every((a) => a.state === "sending")) return "healthy";
  if (live.some((a) => a.state === "sending")) return "mixed";
  // Nothing sending today. A mailbox on its way back is not a cancellation.
  if (live.some((a) => a.state === "recovering")) return "recovering";

  // Every live mailbox was stopped by the vendor: this domain is genuinely
  // spent. Only the queue decides whether deleting it drops work on the floor.
  const queued = live.reduce((sum, a) => sum + a.queueSize, 0);
  return queued === 0 ? "to-delete-now" : "to-delete-soon";
}

/**
 * Merge every inventory row a domain has into one cost.
 *
 * A domain can be reported by more than one vendor — the registrar sells the
 * name while the mail host sells the mailboxes — so the rows are summed rather
 * than picked between. Two vendors billing the same domain in different
 * currencies would need an FX rate nobody here owns, so that reports null
 * rather than a wrong sum.
 *
 * A row the vendor stopped reporting, or one it cancelled, contributes nothing:
 * we are no longer paying for it, so there is nothing to save by deleting it.
 */
export function mergeDomainCost(rows: InstantlyInfraDomainRow[]): DomainCost | null {
  const live = rows.filter((r) => !r.absentSince && !r.cancelledAt);
  if (live.length === 0) return null;

  const currencies = new Set(live.map((r) => r.currency).filter((c): c is string => c !== null));
  if (currencies.size !== 1) return null;
  const currency = [...currencies][0];

  let recurringCents: number | null = null;
  let renewalCents: number | null = null;
  let renewalAt: string | null = null;
  let source: string | null = null;

  for (const row of live) {
    if (row.recurringMonthlyCents !== null) {
      recurringCents = (recurringCents ?? 0) + row.recurringMonthlyCents;
    }
    if (row.renewalCents !== null) {
      renewalCents = (renewalCents ?? 0) + row.renewalCents;
      // The soonest renewal is the one that forces a decision.
      if (row.renewalAt && (renewalAt === null || row.renewalAt < renewalAt)) {
        renewalAt = row.renewalAt;
      }
    }
    if (row.costSource) {
      source = source === null || source === row.costSource ? row.costSource : "mixed";
    }
  }

  if (recurringCents === null && renewalCents === null) return null;
  return { recurringCents, renewalCents, renewalAt, currency, source };
}

/**
 * Group the account-health rows by sending domain and read each one's verdict.
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
  infraRows: InstantlyInfraDomainRow[] = [],
): DomainHealthRow[] {
  const infraByDomain = new Map<string, InstantlyInfraDomainRow[]>();
  for (const row of infraRows) {
    const bucket = infraByDomain.get(row.domain);
    if (bucket) bucket.push(row);
    else infraByDomain.set(row.domain, [row]);
  }

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
      .map((row) => ({
        email: row.email,
        localPart: row.email.split("@")[0] ?? row.email,
        accountType: row.accountType,
        lifecycleStatus: row.lifecycleStatus,
        lifecycleReason: row.lifecycleReason,
        // Both scores are carried for DISPLAY and are read by nothing that
        // decides anything — see the module header for why grading on them
        // was wrong in both directions.
        warmupScore: row.warmupScore,
        inboxPct: row.inboxPlacement?.inboxPct ?? null,
        queueSize: row.queueSize,
        state: accountSendState(row.lifecycleStatus),
      }))
      .sort((a, b) => a.localPart.localeCompare(b.localPart));

    const providerTypes: (string | null)[] = [];
    for (const account of accounts) {
      if (!providerTypes.includes(account.accountType)) {
        providerTypes.push(account.accountType);
      }
    }

    const infra = infraByDomain.get(domain) ?? [];
    const live = infra.filter((r) => !r.absentSince);

    out.push({
      domain,
      accounts,
      state: domainHealthState(accounts),
      providerTypes,
      cost: mergeDomainCost(infra),
      vendors: [...new Set(live.map((r) => r.provider))].sort(),
      expiresAt:
        live
          .map((r) => r.expiresAt)
          .filter((d): d is string => d !== null)
          .sort()[0] ?? null,
      // False only when every vendor reporting the domain says so; a single
      // unknown keeps it unknown rather than asserting it will not renew.
      autorenew: live.some((r) => r.autorenew === true)
        ? true
        : live.some((r) => r.autorenew === false)
          ? false
          : null,
    });
  }

  // Recurring spend leads: it is the money still leaving every month, so it is
  // what a delete list exists to stop. A renewal already paid until next spring
  // is a diary entry, not an urgency, so it only breaks ties.
  return out.sort((a, b) => {
    const ar = a.cost?.recurringCents ?? 0;
    const br = b.cost?.recurringCents ?? 0;
    if (ar !== br) return br - ar;
    const an = a.cost?.renewalCents ?? 0;
    const bn = b.cost?.renewalCents ?? 0;
    if (an !== bn) return bn - an;
    return a.domain.localeCompare(b.domain);
  });
}

/**
 * Tab order: what to act on first, then what to leave alone.
 *
 * The two delete tabs lead because they are the only ones that save money. A
 * tab with no rows is not offered at all — see the card — so `held` and
 * `not-graded` only appear on a fleet that actually has them.
 */
export const DOMAIN_TABS: { key: DomainHealthState; label: string; blurb: string }[] = [
  {
    key: "to-delete-now",
    label: "To delete now",
    blurb: "Every mailbox was stopped by Instantly and nothing is queued. Cancel it.",
  },
  {
    key: "to-delete-soon",
    label: "To delete soon",
    blurb: "Every mailbox was stopped by Instantly, but emails are still queued. Let them drain first.",
  },
  {
    key: "recovering",
    label: "Recovering",
    blurb: "Not sending today. Instantly-service is warming these back up, so they are not cancellations.",
  },
  {
    key: "mixed",
    label: "Mix state",
    blurb: "A sending mailbox beside one that is not.",
  },
  { key: "healthy", label: "Sending", blurb: "Every mailbox that counts is send-eligible." },
  {
    key: "held",
    label: "Held by us",
    blurb: "Pinned out of cold email on purpose. Never a delete candidate.",
  },
  {
    key: "not-graded",
    label: "Not graded",
    blurb: "No mailbox here carried a lifecycle, so there is nothing to grade.",
  },
];
