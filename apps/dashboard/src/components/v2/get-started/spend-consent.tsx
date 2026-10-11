"use client";

/**
 * The three statements ticked before the first payment (owner 2026-10-11): the words come
 * from `spendConsentLines`, the pay button beside them stays off until every box is ticked
 * (`allTicked`). Used by the prepaid credit step and the plan's trial step alike.
 */

import type { ConsentLine } from "@/lib/v2/spend-consent";

export function allTicked(ticked: readonly boolean[]): boolean {
  return ticked.length === 3 && ticked.every(Boolean);
}

export function SpendConsent({
  lines,
  ticked,
  onChange,
  disabled,
}: {
  lines: readonly ConsentLine[];
  ticked: readonly boolean[];
  onChange: (next: boolean[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="sr-only">Before you pay</legend>
      {lines.map((line, i) => (
        <label key={i} className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-5">
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={ticked[i] === true}
            onChange={(e) => onChange(ticked.map((t, j) => (j === i ? e.target.checked : t)))}
          />
          <span className="k-fg2">
            {line.text}
            {line.link && (
              <>
                {" "}
                <a className="k-accent-text underline" href={line.link.href} target="_blank" rel="noreferrer">
                  {line.link.label}
                </a>
                .
              </>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
