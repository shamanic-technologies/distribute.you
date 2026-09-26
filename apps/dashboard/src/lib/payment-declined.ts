// A campaign campaign-service stopped because the org's card could not be charged.
//
// campaign-service (v0.73) stops every ongoing campaign of an org whose payment
// state billing reports as blocked (a declined card, a card from a country that
// cannot be charged automatically), stamps `stopReason: "payment_declined"` on
// each, and refuses every start for that org until billing clears it. Nothing
// resumes on its own: the customer pays what is owed, fixes the card, then starts
// the campaigns again.
//
// So a stopped campaign now carries one of two very different stories, and the
// customer must be able to tell them apart at a glance: somebody paused it, or
// the payment failed and it will stay paused until they act. Every surface that
// states a campaign's status reads this module for the second one, so the words
// and the colour are stated once.
//
// Alias-free on purpose (only a relative import), so it carries real unit tests.

import { isRunningStatus } from "./campaign-controls";

export const PAYMENT_DECLINED_STOP_REASON = "payment_declined";

/** The pill's words for a campaign stopped by a declined payment. */
export const PAYMENT_DECLINED_LABEL = "Paused: payment declined";

/**
 * Amber, a warning the customer can act on, from the closed set `html.dark`
 * remaps. Red would read as a fault of ours; grey reads as a pause somebody chose.
 */
export const PAYMENT_DECLINED_STYLE = "bg-amber-50 text-amber-700 border-amber-200";

/** What the customer has to do, in one sentence. Shown beside the link to Billing. */
export const PAYMENT_DECLINED_NOTE =
  "Your card was declined, so we paused your campaigns. Pay your outstanding balance and add a card that works, then start them again.";

export interface StatusWithReason {
  status: string;
  stopReason?: string | null;
}

/** True when this campaign is stopped AND the reason is the declined payment. */
export function isPaymentDeclinedStop(c: StatusWithReason): boolean {
  return !isRunningStatus(c.status) && c.stopReason === PAYMENT_DECLINED_STOP_REASON;
}

/**
 * Does this scope need the "fix your payment" notice?
 *
 * Only while NOTHING in it runs. A start is refused for as long as billing holds
 * the org, so a single running campaign proves the hold has cleared; the rest were
 * left stopped by the customer's own choice (or not restarted yet) and a notice
 * telling them their card was declined would then be false.
 */
export function scopeHeldByPayment(campaigns: readonly StatusWithReason[]): boolean {
  if (campaigns.some((c) => isRunningStatus(c.status))) return false;
  return campaigns.some(isPaymentDeclinedStop);
}

/**
 * campaign-service's own sentence for a refused start, when the refusal is one it
 * wrote for a person.
 *
 * It answers 409 `reason: "payment_declined"` while the org is held and 502
 * `reason: "billing_unavailable"` when it cannot read billing, each with an
 * `error` written in customer English to be rendered verbatim. Anything else is
 * not this refusal, and the caller keeps its own message. Read off the STATUS and
 * the machine `reason`, never off the English, which is free to change.
 */
export function campaignStartRefusalMessage(
  status: number | null,
  body: Record<string, unknown> | null | undefined,
): string | null {
  if (!body || typeof body.error !== "string" || body.error.trim() === "") return null;
  if (status === 409 && body.reason === "payment_declined") return body.error;
  if (status === 502 && body.reason === "billing_unavailable") return body.error;
  return null;
}
