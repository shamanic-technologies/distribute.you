"use client";

/**
 * A confirmation that appears where the user is looking, not where they clicked.
 *
 * The dashboard had no toast until the sidebar's invite row lost its button: a
 * one-line row has nowhere to put a "Copied" label, so the confirmation has to
 * live somewhere else on the page. Deliberately small - one message, one tone,
 * no queue, no stacking. A toast system with priorities is a thing to maintain,
 * and nothing here has two things to say at once.
 *
 * `role="status"` + `aria-live="polite"` because the whole point is announcing
 * something the user did not navigate to; without it a screen reader never hears
 * the confirmation and the control reads as dead, which is the exact failure the
 * toast exists to fix.
 *
 * Centred at the bottom rather than bottom-right: the support FAB is pinned to
 * that corner on every dashboard page (see the FAB clearance rule) and a toast
 * landing under it would be the one message the user cannot read.
 */
export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 shadow-lg"
    >
      <svg
        className="h-4 w-4 shrink-0 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-sm font-medium text-white">{message}</span>
    </div>
  );
}
