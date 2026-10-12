/**
 * The sidebar's budget gauge (owner 2026-10-11): what is left to spend, fixed above the
 * account menu on every v2 brand page, so a customer always sees what using the service
 * costs them. One shape per way of paying, every figure read off billing-service:
 *
 * - prepaid: the spendable balance. No bar, since billing states no "full" amount to fill
 *   one against; a dot says whether campaigns can still spend, and billing's runway says
 *   how many days it lasts at the running daily budgets.
 * - postpaid: spent since the last card charge, out of the spend that triggers the next one
 *   (the same meter the Billing page draws).
 * - subscription: the month's credit left, out of the plan's monthly amount (the trial's
 *   grant while trialing).
 *
 * Nothing here decides money: it picks which served field goes where. Alias-free on
 * purpose, so it carries real unit tests.
 */

import { formatBillingCents, formatCentsAsUsd } from "./format-number";

/** The billing account fields the gauge reads (billing-service `GET /v1/accounts`). */
export interface GaugeAccount {
  payment_mode?: string | null;
  balance_cents: string;
  has_auto_topup: boolean;
  has_payment_method: boolean;
  topup_threshold_cents: number | null;
}

/** The plan read's fields the gauge reads (billing-service `GET /v1/accounts/subscription`). */
export interface GaugeSubscription {
  credits_remaining_cents?: string | null;
  /** The whole trial credit the org was given (welcome advance + trial grant), billing#738. */
  trial_credit_cents?: number | null;
  sending_stopped?: boolean | null;
  subscription: {
    status: string;
    monthly_amount_cents: number;
    next_charge_at: string | null;
    trial_end: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
}

/** billing-service's runway read (`GET /v1/accounts/runway`), prepaid only. */
export interface GaugeRunway {
  state: string;
  days_left: number | null;
  runs_out_at: string | null;
}

/** The runway as one line, or null when billing states no number of days. */
export function runwayLine(runway: GaugeRunway | undefined): string | null {
  if (!runway || runway.state !== "days" || runway.days_left === null) return null;
  if (runway.days_left === 0) return "Runs out today.";
  const date = shortDate(runway.runs_out_at);
  const days = `About ${runway.days_left} day${runway.days_left === 1 ? "" : "s"} left`;
  return date ? `${days} (${date})` : `${days}.`;
}

export type GaugeTone = "ok" | "stopped";

export interface GaugeView {
  /** The k-label over the figure. */
  label: string;
  figure: string;
  /** A bar `value` of `max` (cents), or null when billing states no amount to fill against. */
  meter: { value: number; max: number } | null;
  /** One short line under it. */
  line: string;
  tone: GaugeTone;
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The gauge for one org, or an error string when billing's answer cannot be drawn.
 * `subscription` is only read for a subscription org (undefined while it loads).
 */
export function budgetGaugeView(
  account: GaugeAccount,
  subscription: GaugeSubscription | undefined,
  runway?: GaugeRunway,
): GaugeView | { error: string } | null {
  const mode = account.payment_mode;
  const balance = parseFloat(account.balance_cents);
  if (Number.isNaN(balance)) return { error: `balance_cents is not a number: ${account.balance_cents}` };

  if (mode === "prepaid") {
    if (balance <= 0) {
      return {
        label: "Balance",
        figure: formatBillingCents(Math.max(0, balance)),
        meter: null,
        line: account.has_auto_topup ? "Auto top-up is adding credit." : "Add credit to resume.",
        tone: account.has_auto_topup ? "ok" : "stopped",
      };
    }
    return {
      label: "Balance",
      figure: formatBillingCents(balance),
      meter: null,
      line: runwayLine(runway) ?? (account.has_auto_topup ? "Auto top-up is on." : "Campaigns pause at $0."),
      tone: "ok",
    };
  }

  if (mode === "postpaid") {
    // The credit line is the spend that triggers the next charge (billing's negative floor).
    const line = Math.abs(account.topup_threshold_cents ?? 0);
    if (!account.has_payment_method || !account.has_auto_topup || line === 0) {
      return { label: "Spent", figure: formatCentsAsUsd(Math.max(0, -balance), 2), meter: null, line: "Add a card to run campaigns.", tone: "stopped" };
    }
    if (balance > 0) {
      return { label: "Credit left", figure: formatBillingCents(balance), meter: null, line: `Then billed every ${formatCentsAsUsd(line, 0)}.`, tone: "ok" };
    }
    const spent = Math.max(0, -balance);
    return {
      label: "Spent since last charge",
      figure: formatCentsAsUsd(spent, 2),
      meter: { value: spent, max: line },
      line: `Card charged at ${formatCentsAsUsd(line, 0)}.`,
      tone: "ok",
    };
  }

  if (mode === "subscription") {
    if (!subscription) return null;
    const sub = subscription.subscription;
    if (!sub) return { label: "Monthly plan", figure: "—", meter: null, line: "No plan running.", tone: "stopped" };
    const left = parseFloat(subscription.credits_remaining_cents ?? "");
    if (Number.isNaN(left)) return { error: `credits_remaining_cents is not a number: ${subscription.credits_remaining_cents}` };
    const trialing = sub.status === "trialing";
    // Out of the WHOLE trial credit ($99), never the trial grant row alone ($69 beside a $30 advance).
    if (trialing && !subscription.trial_credit_cents) {
      return { error: `trialing plan without trial_credit_cents: ${String(subscription.trial_credit_cents)}` };
    }
    const max = trialing ? subscription.trial_credit_cents! : sub.monthly_amount_cents;
    const stopped = subscription.sending_stopped === true || left <= 0;
    const when = sub.cancel_at_period_end
      ? shortDate(sub.current_period_end)
      : trialing
        ? shortDate(sub.trial_end)
        : shortDate(sub.next_charge_at);
    const verb = sub.cancel_at_period_end ? "Ends" : trialing ? "Trial ends" : "Renews";
    return {
      label: trialing ? "Trial credit left" : "Credit left this month",
      figure: formatBillingCents(Math.max(0, left)),
      meter: { value: Math.max(0, left), max },
      line: stopped
        ? "Sending stopped."
        : `of ${formatCentsAsUsd(max, 0)}${when ? ` · ${verb} ${when}` : ""}`,
      tone: stopped ? "stopped" : "ok",
    };
  }

  return { error: `unknown payment_mode: ${String(mode)}` };
}
