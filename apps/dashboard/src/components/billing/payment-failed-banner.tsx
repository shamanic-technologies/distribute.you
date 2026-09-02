"use client";

import type { PaymentFailure } from "@/lib/payment-failure";
import { paymentFailureAttemptsLine } from "@/lib/payment-failure";
import { formatBillingCents } from "@/lib/format-number";

/**
 * Red banner at the top of Billing while a charge has been refused since the
 * last one that went through.
 *
 * It exists because both halves of that situation were invisible. The refused
 * charges sat in the Payments card as a grey "Incomplete" badge with no reason
 * (and are in fact filtered out of it entirely), and the page's own "Top Up
 * Credits" button renders only while auto-topup is OFF — so an org whose
 * auto-topup card keeps declining saw neither the problem nor any control to
 * fix it.
 *
 * Two sentences, each gated on something we actually know:
 *
 *  - The REASON is Stripe's own cardholder-facing message, verbatim. We do not
 *    map decline codes to prose of our own; Stripe wrote that sentence for the
 *    person holding the card.
 *  - "Your campaigns are stopped" renders only when the balance is actually
 *    exhausted. A declined top-up on an org still holding credit has not
 *    stopped anything, and saying so would be a claim we cannot support.
 *
 * `Retry payment` opens the same embedded-checkout modal a hard 402 opens, at
 * the amount that was refused, so the customer can pay with a different card in
 * one click. `Update card` goes to the provider's own card form.
 */
export function PaymentFailedBanner({
  failure,
  stopped,
  onRetry,
  onUpdateCard,
  updatingCard = false,
}: {
  failure: PaymentFailure;
  /** Balance is exhausted, so the outreach really has stopped. */
  stopped: boolean;
  onRetry: () => void;
  onUpdateCard: () => void;
  updatingCard?: boolean;
}) {
  const attempts = paymentFailureAttemptsLine(failure);

  return (
    <div
      className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-red-800">
              Payment of {formatBillingCents(failure.amountCents)} failed
            </p>
            <p className="mt-0.5 text-red-700">
              {failure.message}
              {attempts ? ` ${attempts}` : ""}
              {stopped ? " Your campaigns are stopped until a payment goes through." : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Retry payment
          </button>
          <button
            onClick={onUpdateCard}
            disabled={updatingCard}
            className="text-sm font-medium text-red-700 underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
          >
            {updatingCard ? "Opening..." : "Update card"}
          </button>
        </div>
      </div>
    </div>
  );
}
