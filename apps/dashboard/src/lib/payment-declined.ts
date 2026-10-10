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
// A stop reason is HISTORY (why that campaign stopped, then); the hold is billing's
// CURRENT state. A status pill may state the history. A notice telling the customer
// to act ("add a card") speaks only while billing blocks the org NOW
// (`billingHoldKind`): an org that moved to prepaid or added a card keeps the old
// reason on its stopped campaigns and must not be told to add a card (2026-10-10).
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
 * billing's payment outlook, the two fields that say whether the org is held NOW.
 * Served by the dashboard's own `/api/orgs/payment-hold` (billing's
 * `GET /internal/accounts/by-org/:orgId/payment-outlook`).
 */
export interface BillingHoldOutlook {
  state: string;
  blockedReason: string | null;
}

/**
 * Is the org held over payment RIGHT NOW, and which way? Billing's verdict, read,
 * never re-derived: `charge_blocked` is the state campaign-service stops campaigns
 * and refuses starts on. billing's own reason picks the words: no chargeable card is
 * "add a card", every other block (declined, unusable, retries exhausted, card
 * country unsupported) is "fix billing". Any other state (a prepaid org is never
 * blocked) is null.
 */
export function billingHoldKind(outlook: BillingHoldOutlook): PaymentHoldKind | null {
  if (outlook.state !== "charge_blocked") return null;
  return outlook.blockedReason === "no_chargeable_card" ? "no_payment_method" : "declined";
}

/**
 * Was this scope stopped over payment, by the campaigns' own record? Nothing in it
 * runs, and at least one campaign carries a payment stop reason. HISTORY only: a stop
 * reason stays on the campaign after the org added a card or moved to prepaid, so this
 * alone never tells the customer to act. It says whether billing is worth asking.
 */
export function scopeStoppedOverPayment(campaigns: readonly StatusWithReason[]): boolean {
  if (campaigns.some((c) => isRunningStatus(c.status))) return false;
  return campaigns.some((c) => paymentHoldKind(c) !== null);
}

/**
 * Does this scope need the "fix your payment" notice, and which one?
 *
 * Both have to hold. Billing blocks the org NOW (`billingHold`, from
 * `billingHoldKind`), and the scope was stopped over payment with NOTHING running (a
 * start is refused while billing holds the org, so one running campaign proves the
 * hold cleared, and a scope with no payment stop has nothing to say "paused" about).
 * The kind is billing's, never the campaign's old reason: a campaign stopped for
 * having no card, in an org whose card is now declined, needs "fix billing".
 */
export function scopePaymentHold(
  campaigns: readonly StatusWithReason[],
  billingHold: PaymentHoldKind | null,
): PaymentHoldKind | null {
  if (!billingHold) return null;
  if (!scopeStoppedOverPayment(campaigns)) return null;
  return billingHold;
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
