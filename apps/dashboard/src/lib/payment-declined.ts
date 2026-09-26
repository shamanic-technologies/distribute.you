// A campaign campaign-service stopped because the org cannot be charged.
//
// campaign-service stops every ongoing campaign of an org billing reports as
// blocked, stamps the reason on each, and refuses every start for that org until
// billing clears it. Two reasons, two fixes: `payment_declined` (the bank refused
// the card: pay what is owed and add a card that works) and `no_payment_method`
// (the org has no card at all, because the customer removed it: add one). Nothing
// resumes on its own; the customer starts the campaigns again.
//
// So a stopped campaign carries one of three stories, and the customer must be
// able to tell them apart at a glance: somebody paused it, the card was declined,
// or there is no card. Every surface that states a campaign's status reads this
// module for the last two, so the words and the colour are stated once.
//
// Alias-free on purpose (only relative imports), so it carries real unit tests.

import { isRunningStatus } from "./campaign-controls";
import { paymentHoldKindForStopReason, type PaymentHoldKind } from "./payment-hold-reason";

export {
  NO_PAYMENT_METHOD_STOP_REASON,
  PAYMENT_DECLINED_STOP_REASON,
  type PaymentHoldKind,
} from "./payment-hold-reason";

/** The pill's words for a campaign stopped over payment. */
export const PAYMENT_HOLD_LABEL: Record<PaymentHoldKind, string> = {
  declined: "Paused: payment declined",
  no_payment_method: "Paused: no payment method",
};

/** The notice's heading. */
export const PAYMENT_HOLD_TITLE: Record<PaymentHoldKind, string> = {
  declined: "Campaigns paused: payment declined",
  no_payment_method: "Campaigns paused: no payment method",
};

/** What the customer has to do, in one sentence. Shown beside the link to Billing. */
export const PAYMENT_HOLD_NOTE: Record<PaymentHoldKind, string> = {
  declined:
    "Your card was declined, so we paused your campaigns. Pay your outstanding balance and add a card that works, then start them again.",
  no_payment_method:
    "There is no payment method on your account, so we paused your campaigns. Add a card, then start them again.",
};

/** The row-level line in the controls modal. */
export const PAYMENT_HOLD_ROW_NOTE: Record<PaymentHoldKind, string> = {
  declined:
    "Paused because your card was declined, not by anyone on your team. It can be started again once your balance is paid and a working card is on file.",
  no_payment_method:
    "Paused because there is no payment method on your account, not by anyone on your team. It can be started again once a card is on file.",
};

/**
 * Amber, a warning the customer can act on, from the closed set `html.dark`
 * remaps. Red would read as a fault of ours; grey reads as a pause somebody chose.
 */
export const PAYMENT_HOLD_STYLE = "bg-amber-50 text-amber-700 border-amber-200";

export interface StatusWithReason {
  status: string;
  stopReason?: string | null;
}

/** Why this campaign is stopped over payment, or null (running, or paused by a person). */
export function paymentHoldKind(c: StatusWithReason): PaymentHoldKind | null {
  if (isRunningStatus(c.status)) return null;
  return paymentHoldKindForStopReason(c.stopReason);
}

/**
 * Does this scope need the "fix your payment" notice, and which one?
 *
 * Only while NOTHING in it runs. A start is refused for as long as billing holds
 * the org, so a single running campaign proves the hold has cleared; the rest were
 * left stopped by the customer's own choice (or not restarted yet) and a notice
 * saying otherwise would then be false. A declined card outranks a missing one: it
 * also owes money, so it is the fuller instruction.
 */
export function scopePaymentHold(campaigns: readonly StatusWithReason[]): PaymentHoldKind | null {
  if (campaigns.some((c) => isRunningStatus(c.status))) return null;
  return strongestPaymentHold(campaigns.map(paymentHoldKind));
}

/**
 * One kind for several held rows. A declined card outranks a missing one: it also
 * owes money, so it is the fuller instruction. Null when none is held.
 */
export function strongestPaymentHold(
  kinds: readonly (PaymentHoldKind | null)[],
): PaymentHoldKind | null {
  if (kinds.includes("declined")) return "declined";
  if (kinds.includes("no_payment_method")) return "no_payment_method";
  return null;
}

/**
 * campaign-service's own sentence for a refused start, when the refusal is one it
 * wrote for a person.
 *
 * It answers 409 with `reason: "payment_declined"` or `"no_payment_method"` while
 * the org is held, and 502 `reason: "billing_unavailable"` when it cannot read
 * billing, each with an `error` written in customer English to be rendered
 * verbatim. Anything else is not this refusal, and the caller keeps its own
 * message. Read off the STATUS and the machine `reason`, never off the English.
 */
export function campaignStartRefusalMessage(
  status: number | null,
  body: Record<string, unknown> | null | undefined,
): string | null {
  if (!body || typeof body.error !== "string" || body.error.trim() === "") return null;
  if (status === 409 && typeof body.reason === "string" && paymentHoldKindForStopReason(body.reason))
    return body.error;
  if (status === 502 && body.reason === "billing_unavailable") return body.error;
  return null;
}
