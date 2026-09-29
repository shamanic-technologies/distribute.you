"use client";

import type { CrewTrigger } from "@/lib/v2/crews";

/**
 * What sets a crew off, then what it brings: `[Daily] Positive replies`, or
 * `[⚡ Positive reply] Meetings booked`. A daily crew spends its budget every day; an
 * event crew wakes only when a lead reaches the step it waits for. The chip is the
 * trigger, the words after it are the outcome.
 */
export function CrewTriggerTag({ trigger, className = "" }: { trigger: CrewTrigger; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="k-chip inline-flex shrink-0 items-center gap-1">
        {trigger.kind === "daily" ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1.5" y="2.5" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1.5 5h9M4 1.5v2M8 1.5v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6.8 1 2.5 6.8h3.2L5.2 11l4.3-5.8H6.3L6.8 1Z" fill="currentColor" />
          </svg>
        )}
        {trigger.label}
      </span>
      <span className="truncate">{trigger.outcome}</span>
    </span>
  );
}
