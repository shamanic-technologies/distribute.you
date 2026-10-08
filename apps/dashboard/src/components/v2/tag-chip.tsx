"use client";

import type { TimelineIcon, TimelineTag, TimelineTone } from "@/lib/timeline-tags";

/**
 * The coloured tag of the Unibox and the person page: a soft tint of its tone, an icon, a word.
 * Tones follow the Unibox families (won green, hot amber, lost rose, a reply teal).
 */
export const TONE_COLOR: Record<TimelineTone, string> = {
  won: "var(--run)",
  hot: "var(--data-amber)",
  lost: "var(--data-rose)",
  reply: "var(--data-teal)",
  neutral: "var(--fg-3)",
};

export const ICON_PATH: Record<TimelineIcon, string> = {
  sent: "M2.5 8 13.5 2.5 10 13.5 7.5 9z M7.5 9l6-6.5",
  reply: "M6.5 4 3 7.5 6.5 11 M3 7.5h6a4 4 0 0 1 4 4v1",
  visit: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z M2.5 8h11 M8 2.5c1.6 1.6 2.3 3.4 2.3 5.5S9.6 11.9 8 13.5C6.4 11.9 5.7 10.1 5.7 8S6.4 4.1 8 2.5z",
  meeting: "M3 4h10v9H3z M3 7h10 M5.5 2.5v3 M10.5 2.5v3",
  money: "M8 2.5v11 M10.8 5.2C10.3 4.5 9.3 4 8 4 6.6 4 5.5 4.8 5.5 6s1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.3 0-2.3-.5-2.8-1.2",
  lost: "M4.5 4.5l7 7 M11.5 4.5l-7 7",
  dot: "M8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  flame: "M8 14c-2.5 0-4.5-1.8-4.5-4.3C3.5 6.5 7 5.5 7 2c2.6 1.5 5.5 4.3 5.5 7.7C12.5 12.2 10.5 14 8 14z M8 14c-1.1 0-2-.9-2-2.1 0-1.5 2-2.4 2-3.9 1.2.8 2 1.9 2 3.9 0 1.2-.9 2.1-2 2.1z",
  check: "M3.5 8.5l3 3 6-7",
  snow: "M8 2v12 M2.8 5l10.4 6 M2.8 11l10.4-6 M6.5 2.8 8 4l1.5-1.2 M6.5 13.2 8 12l1.5 1.2",
};

/** A timeline item's tag: what happened, in its family's colour, with an icon. */
export function TagChip({ tag }: { tag: TimelineTag }) {
  const color = TONE_COLOR[tag.tone];
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d={ICON_PATH[tag.icon]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {tag.label}
    </span>
  );
}
