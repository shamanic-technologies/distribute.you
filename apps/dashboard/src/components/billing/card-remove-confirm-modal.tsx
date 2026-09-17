"use client";

import { formatBillingCents } from "@/lib/format-number";
import type { CardRemoveConsequence } from "@/lib/card-remove";

/**
 * The customer confirms removing the card BEFORE anything happens to it.
 *
 * Two facts have to be on screen before the click, and neither is guessable from
 * the button's label. We attempt to collect an outstanding balance on this card
 * at the moment they ask, so money can move; and removing the card is what makes
 * the outreach stop, which is the thing they are actually deciding.
 *
 * The settle attempt NEVER gates the removal. That is the owner's rule and it is
 * the same rule the card-change button follows: to require a successful charge
 * before letting someone leave is to hold a customer hostage to the card that is
 * failing, which is exactly the dead end that PR #4195 removed from the other
 * button. So the copy says it outright, rather than letting a failed charge come
 * as a surprise in either direction.
 *
 * What stops is NOT stated as a constant. An org sitting on credit keeps running
 * until it is spent, and telling them their campaigns stop now would be false in
 * the common case, so the sentence is derived per account by
 * `cardRemoveConsequence`. An unreadable balance says so instead of asserting
 * one, because a surface that could not measure the consequence must not claim
 * to know it.
 */
export function CardRemoveConfirmModal({
  settleCents,
  consequence,
  cardLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  /** What we will attempt to collect first, or null when there is nothing. */
  settleCents: number | null;
  /** What removing the card stops, and when. */
  consequence: CardRemoveConsequence;
  /** The card as the customer sees it elsewhere on the page, e.g. "Visa 4242". */
  cardLabel: string | null;
  /** The removal is running. */
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const owed = settleCents === null ? null : formatBillingCents(settleCents);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-remove-confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={pending ? undefined : onCancel}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-xl sm:max-w-md sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-3">
          <h2
            id="card-remove-confirm-title"
            className="text-sm font-semibold text-gray-800"
          >
            {cardLabel ? `Remove ${cardLabel}?` : "Remove your card?"}
          </h2>
        </div>

        <div className="px-5 py-4">
          {owed !== null && (
            <>
              <p className="text-sm text-gray-600">
                You owe {owed}. We charge it to this card now.
              </p>
              {/* Load-bearing: the charge never blocks the removal, and saying so
                  is what stops a failed charge reading as a refusal. */}
              <p className="mt-2 text-sm text-gray-600">
                If that charge does not go through, we remove the card anyway and
                the {owed} stays owed.
              </p>
            </>
          )}

          {consequence.kind === "runs_down" && (
            <p className={`text-sm text-gray-600 ${owed !== null ? "mt-2" : ""}`}>
              Your campaigns keep running on the{" "}
              {formatBillingCents(consequence.availableCents)} of credit you have
              left. Nothing tops it up after that.
            </p>
          )}
          {consequence.kind === "stops_now" && (
            <p className={`text-sm text-gray-600 ${owed !== null ? "mt-2" : ""}`}>
              Nothing goes out after this. Your campaigns stop until you add a
              card.
            </p>
          )}
          {consequence.kind === "unknown" && (
            <p className={`text-sm text-gray-600 ${owed !== null ? "mt-2" : ""}`}>
              We could not read your balance, so we cannot say what this stops.
            </p>
          )}

          <p className="mt-2 text-sm text-gray-600">
            You can add a card again at any time.
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
            {/* Full opacity while running: fading the "Removing..." that signals
                work is what makes a busy button read as a dead one. */}
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className={`rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 ${
                pending ? "cursor-wait" : ""
              }`}
            >
              {pending ? "Removing..." : "Remove card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
