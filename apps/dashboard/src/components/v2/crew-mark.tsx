"use client";

import type { CrewGlyph } from "@/lib/v2/crews";

/**
 * A crew's mark, drawn the way Keel draws an agent: a soft tile in the crew's colour
 * with one geometric glyph. The glyph + colour pair is fixed per crew (`lib/v2/crews`),
 * so a crew reads the same in the sidebar, the tables and its own card.
 */
export function CrewMark({
  color,
  glyph,
  size = 16,
}: {
  color: string;
  glyph: CrewGlyph;
  size?: number;
}) {
  const g = Math.round(size * 0.56);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[5px]"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
      }}
      aria-hidden="true"
    >
      <svg width={g} height={g} viewBox="0 0 10 10">
        {glyph === "ring" && <circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />}
        {glyph === "diamond" && <path d="M5 .8 9.2 5 5 9.2.8 5Z" fill="currentColor" />}
        {glyph === "arc" && <path d="M1.8 8.4V5a3.2 3.2 0 0 1 6.4 0v3.4" fill="none" stroke="currentColor" strokeWidth="2" />}
        {glyph === "triangle" && <path d="M5 1.2 9.4 8.8H.6Z" fill="currentColor" />}
        {glyph === "hex" && <path d="M5 .6 9 2.9v4.2L5 9.4 1 7.1V2.9Z" fill="currentColor" />}
        {glyph === "square" && <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="currentColor" />}
      </svg>
    </span>
  );
}
