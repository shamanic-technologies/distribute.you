"use client";

import type { ReactNode } from "react";

/**
 * The ONE selectable card of the Sales path page (Steps and Channels alike): on = the
 * `k-card-on` fill + ring, a check and full-weight text; off = plain surface, muted text,
 * an empty circle. Both sections render this, so they cannot drift apart.
 */
export function SelectCard({
  on,
  onClick,
  mark,
  title,
  sub,
}: {
  on: boolean;
  onClick: () => void;
  mark: ReactNode;
  title: string;
  sub?: string | null;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`k-card flex items-center gap-2.5 p-3 text-left transition-[box-shadow,background-color] duration-150 active:scale-[0.99] ${on ? "k-card-on" : "k-hover"}`}
    >
      {mark}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] ${on ? "k-fg font-semibold" : "k-fg3"}`}>{title}</span>
        {sub && <span className="k-fg3 block truncate text-[11.5px]">{sub}</span>}
      </span>
      {on ? (
        <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] text-white">✓</span>
      ) : (
        <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border border-[var(--line-strong)]" />
      )}
    </button>
  );
}
