/**
 * The free credit this org has been GRANTED, totalled for the reward pill in
 * the top bar.
 *
 * This is the "total gagné" a customer glances at: the welcome gift, the
 * referral credits, a staff bonus, and — once the reward tasks ship — the $1 a
 * completed task pays. Every one of them is money the org received without
 * paying for it, which is exactly the thing the pill claims to count, so the
 * total is the whole grants ledger rather than a hand-picked subset. A subset
 * keyed on a list of reasons would silently stop counting the day billing adds
 * a new one, and the failure would be a number that is quietly too small.
 *
 * It reads the ledger the Billing page already polls, so the pill costs no
 * request of its own.
 *
 * NOT the spendable balance: a grant that has already been burned on outreach
 * still counts here, because the question is what you EARNED, not what is left.
 * The balance lives on Billing and is a different number on purpose.
 *
 * `amountCents` crosses the wire as a STRING — it is a Postgres numeric, and
 * the reader declares it as such. So the sum has to parse, and a value that
 * does not parse is wire-rot: the total goes NULL and the pill renders nothing
 * rather than showing a figure missing however many grants failed. "We could
 * not measure this" and "you have earned $0" are different statements, and only
 * one of them is safe to print beside somebody's money.
 *
 * Alias-free so it carries real unit tests. Do NOT add an `@/…` import.
 */

/** The shape this module needs off a grant row. Structural on purpose: the
 *  full `CreditGrant` lives in the api client, which is not importable here. */
export type GrantAmount = { amountCents: string };

/**
 * Total granted, in cents. `null` means at least one row could not be read —
 * never a zero, which a caller would print.
 *
 * An EMPTY ledger is a real, measured zero: a brand-new org has been granted
 * nothing, and saying so is honest. The caller decides whether a zero is worth
 * a pill.
 */
export function totalGrantedCents(grants: readonly GrantAmount[]): number | null {
  let total = 0;
  for (const grant of grants) {
    // ⚠️ `Number("")` is 0, NOT NaN — and so is `Number("  ")`. A finiteness
    // check alone therefore reads a BLANK amount as a zero-value grant and
    // under-reports the total silently, which is the one failure this function
    // exists to refuse. Reject blank BEFORE parsing.
    const raw = grant.amountCents?.trim?.() ?? "";
    const cents = raw === "" ? Number.NaN : Number(raw);
    if (!Number.isFinite(cents)) {
      console.error("[dashboard] totalGrantedCents: unparseable grant amount", {
        amountCents: grant.amountCents,
      });
      return null;
    }
    total += cents;
  }
  return total;
}

/**
 * The pill's own label: whole dollars, thousand-separated.
 *
 * Whole dollars because every grant in the ledger is a whole-dollar gift by
 * construction ($30 welcome, $500 referral, $1 a task) and cents on a glanceable
 * badge are noise. This is deliberately NOT the billing page's exact-amount
 * formatter: that one exists so a charge is never rounded, and a total of gifts
 * is not a charge.
 */
export function formatGrantedTotal(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}
