"use client";

import { formatBillingCents } from "@/lib/format-number";

/**
 * The customer confirms the charge BEFORE the card page is opened.
 *
 * billing-service settles an outstanding balance on the card already on file
 * when a card session is minted, and it is right to: a customer touching the
 * card that owes money should pay at that moment, which is what Google Ads, Meta
 * and AWS all do. What was wrong is that nothing asked. The click fired a live
 * charge behind a button that only changed its own label, and the settle takes
 * SECONDS on a real card, so the page sat silent long enough for the customer to
 * give up while the money moved anyway.
 *
 * Two jobs, and the second is why this is a modal rather than more copy:
 *
 *   - it names the amount before it is taken, so nothing is a surprise
 *   - it turns the wait into something the customer chose, and then says what is
 *     running while it runs, so the page is no longer a dead button
 *
 * It renders only when there IS something to settle (`cardChangeSettleCents`).
 * An account with nothing owed goes straight through, exactly as before, and is
 * never asked to confirm a charge of nothing.
 */
export function CardChangeConfirmModal({
  settleCents,
  pending,
  onConfirm,
  onCancel,
}: {
  /** What will be charged. The caller only renders this when there is one. */
  settleCents: number;
  /** The charge is running and the card page is being minted behind it. */
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const amount = formatBillingCents(settleCents);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-change-confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={pending ? undefined : onCancel}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-xl sm:max-w-md sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-3">
          <h2
            id="card-change-confirm-title"
            className="text-sm font-semibold text-gray-800"
          >
            Charge {amount} now?
          </h2>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-gray-600">
            You owe {amount}. Opening your card page charges it to the card on
            file first.
          </p>
          {/* Load-bearing: the customer most likely to be here is the one whose
              card is declining, and the page opens for them too. Without this
              sentence the charge reads as a toll on the way in. */}
          <p className="mt-2 text-sm text-gray-600">
            The page opens either way, so you can still replace a card that is
            failing.
          </p>

          {pending && (
            <p className="mt-4 text-xs text-gray-500">
              This takes a few seconds. Please keep this page open.
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
            {/* The in-flight label stays FULL opacity: `disabled:opacity-40`
                would fade the very "Charging..." that signals work, so the
                button would read as dead at the one moment it is busiest. */}
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className={`rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 ${
                pending ? "cursor-wait" : ""
              }`}
            >
              {pending ? `Charging ${amount}...` : "Charge and continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
