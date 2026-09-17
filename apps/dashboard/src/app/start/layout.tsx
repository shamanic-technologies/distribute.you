import type { ReactNode } from "react";

/**
 * The signed-out onboarding column.
 *
 * `max-h-[100svh]` with `overflow-hidden`, not a min-height: a min-height alone
 * leaves the column free to grow past the viewport, so the flex children divide
 * the GROWN height, the card's own scroller never triggers, the page scrolls
 * instead and the CTA rides below the fold at every width at once. `svh` rather
 * than `vh` so the iOS Safari address bar never eats it. Released at `sm:`,
 * where the card becomes a centred floating panel and a hard cap would clip a
 * tall step.
 */
export default function StartLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-h-[100svh] min-h-[100svh] flex-col overflow-hidden bg-white sm:max-h-none sm:overflow-visible sm:bg-gray-50 sm:py-6">
      {children}
    </div>
  );
}
