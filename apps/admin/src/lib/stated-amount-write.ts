/**
 * What a STATED MONTHLY AMOUNT is, in words a person reads — and what stops one
 * being written.
 *
 * A stated amount says "a human says this brand is worth $X per month, between
 * these dates". It exists because an AGENCY's daily budget is an allocation
 * decision — somebody decides how their discretionary cash is spread across
 * their brands — so nothing derivable from the product can answer what that
 * customer is worth. Only a person can, and this is where they say it.
 *
 * features-service OWNS the rules. It refuses a malformed range and it refuses
 * a range OVERLAPPING another for the same (org, brand), with a 409 whose reason
 * is written for a person. Everything here is either (a) turning that refusal
 * into the sentence to show, or (b) catching the obvious mistakes before a
 * round trip so typing is pleasant. The server's answer always decides; nothing
 * in this file is a second source of truth for what is legal.
 *
 * Deliberately ALIAS-FREE — no `@/…` import, nothing but this file — so it
 * carries REAL unit tests rather than source-substring guards. Keep it that way.
 */

/** A date the two bounds are written in: a UTC calendar day, inclusive. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface StatedAmountDraft {
  orgId: string;
  brandId: string;
  /** As typed. A string so a half-typed "1." is not coerced into a number mid-keystroke. */
  amount: string;
  /** Empty string = leave this end OPEN, which is a real statement, not a missing value. */
  startDate: string;
  endDate: string;
  note: string;
}

export const EMPTY_STATED_AMOUNT_DRAFT: StatedAmountDraft = {
  orgId: "",
  brandId: "",
  amount: "",
  startDate: "",
  endDate: "",
  note: "",
};

/**
 * The refusal to show, from the HTTP status and the response body.
 *
 * Never the thrown error's `message`: on the conflict that matters it is the
 * machine token `stated_amount_conflict`, while the sentence a person needs is
 * the body's `reason`. Takes plain values rather than the error object so this
 * module stays alias-free — the caller extracts `err.status` / `err.body`.
 */
export function statedAmountErrorMessage(status: number | null, body: unknown): string {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const code = typeof b.error === "string" ? b.error : null;
  const reason = typeof b.reason === "string" ? b.reason : null;

  if (status === 409) {
    // The producer names the row it collided with. Two amounts in force on one
    // day is two answers to one question, so the reason IS the whole message.
    return reason ?? "Another stated amount already covers part of that period for this brand.";
  }
  if (status === 404) {
    return "That stated amount no longer exists — someone removed it. Reload to see the current list.";
  }
  if (status === 400) {
    // A 400 here is the producer rejecting the range or the amount, and its own
    // sentence is better than anything this side could invent.
    return reason ?? code ?? "That amount or those dates were refused.";
  }
  if (status === 403) {
    return "You are not on the staff list for this.";
  }
  return "Could not save the stated amount. Try again, and check the service is up if it keeps failing.";
}

/**
 * The obvious mistake in a draft, or null when there is nothing to say.
 *
 * Comfort only — every one of these is also refused by features-service, which
 * is what actually decides. What it must NOT do is invent a rule the server does
 * not have: an EMPTY bound is legal (it means open), a zero amount is legal (a
 * real answer), and overlap is not checked here at all because only the server
 * holds the other rows.
 */
export function statedAmountDraftProblem(draft: StatedAmountDraft): string | null {
  if (!draft.brandId || !draft.orgId) return "Pick a brand first.";

  const amount = Number(draft.amount);
  if (draft.amount.trim() === "" || !Number.isFinite(amount)) {
    return "Say how much per month, in dollars.";
  }
  if (amount < 0) return "A monthly amount cannot be negative.";

  if (draft.startDate !== "" && !ISO_DAY.test(draft.startDate)) {
    return "The start date must be a calendar day (YYYY-MM-DD), or empty for “since the first day this brand spent”.";
  }
  if (draft.endDate !== "" && !ISO_DAY.test(draft.endDate)) {
    return "The end date must be a calendar day (YYYY-MM-DD), or empty for “still running”.";
  }
  if (draft.startDate !== "" && draft.endDate !== "" && draft.endDate < draft.startDate) {
    return "The end date is before the start date.";
  }
  return null;
}

/**
 * The draft as the producer's body. An empty bound becomes an explicit `null`,
 * never an omitted key: on a PATCH an omitted key KEEPS the stored value while
 * `null` OPENS that end, so clearing a date has to be sent as null to mean what
 * the person did.
 */
export function statedAmountBody(draft: StatedAmountDraft): {
  orgId: string;
  brandId: string;
  amountUsd: number;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
} {
  return {
    orgId: draft.orgId,
    brandId: draft.brandId,
    amountUsd: Number(draft.amount),
    startDate: draft.startDate === "" ? null : draft.startDate,
    endDate: draft.endDate === "" ? null : draft.endDate,
    note: draft.note.trim() === "" ? null : draft.note.trim(),
  };
}

/**
 * The period in words. Each open end has a MEANING and states it — an empty
 * bound is a decision the person made, so rendering it as a dash would hide
 * what they said.
 */
export function termLabel(startDate: string | null, endDate: string | null): string {
  const from = startDate === null ? "Since this brand’s first day of spend" : `From ${startDate}`;
  const to = endDate === null ? "ongoing" : `to ${endDate}`;
  return `${from}, ${to}`;
}

/**
 * Is a stated amount in force TODAY? Used only to sort and mark the list — the
 * figures on the cards come from the producer, which resolves this itself.
 * A null start is treated as in force: its real lower bound is the brand's first
 * billed day, which this side does not hold, and that day is always in the past.
 */
export function isInForceToday(startDate: string | null, endDate: string | null, today: string): boolean {
  if (startDate !== null && today < startDate) return false;
  if (endDate !== null && today > endDate) return false;
  return true;
}
