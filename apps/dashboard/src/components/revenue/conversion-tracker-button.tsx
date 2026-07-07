"use client";

import Link from "next/link";

/**
 * Discreet ghost button shown IN PLACE OF a metric value when the brand's
 * conversion tracker isn't set up yet (the metric has no data to show). One
 * shared component so every untracked outcome card carries the identical CTA.
 *
 * Ghost styling per UX consensus (LogRocket/CXL): a quiet secondary action —
 * transparent fill + full-perimeter 1px border — kept discoverable with strong
 * text contrast (near-black) + a distinct hover/focus affordance so it never
 * reads as inert text. Sits where the value would be, so the card stays scannable.
 */
export function ConversionTrackerButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-900 transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
    >
      Set up conversion tracker
      <span aria-hidden="true">→</span>
    </Link>
  );
}
