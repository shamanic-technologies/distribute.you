"use client";

import { useRef, useState } from "react";
import { answerLines } from "@/lib/v2/get-started";

/**
 * A short answer shown as bullets; a click turns it into a text area, leaving it turns
 * it back. The text is the source: one line per bullet. Shared by the onboarding's
 * offer steps and the offer page, so both read the same (owner 2026-10-09).
 *
 * `onDone` fires when the reader LEAVES the field (blur), which is where a v2 surface
 * autosaves. Esc puts back the text the field opened with and
 * closes it without `onDone`.
 */
export function EditableAnswer({
  value,
  onValue,
  onDone,
  disabled,
  placeholder,
  label,
}: {
  value: string;
  onValue: (v: string) => void;
  onDone?: () => void;
  disabled: boolean;
  placeholder: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const opened = useRef(value);
  const dropped = useRef(false);
  const lines = answerLines(value);
  if (editing && !disabled)
    return (
      <textarea
        autoFocus
        className="k-input min-h-[96px] w-full resize-y px-2 py-1.5 text-[13px] leading-5"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          dropped.current = true;
          onValue(opened.current);
          setEditing(false);
        }}
        onBlur={() => {
          setEditing(false);
          if (dropped.current) {
            dropped.current = false;
            return;
          }
          onDone?.();
        }}
        aria-label={label}
        placeholder={placeholder}
      />
    );
  return (
    <button
      type="button"
      onClick={() => {
        opened.current = value;
        dropped.current = false;
        setEditing(true);
      }}
      disabled={disabled}
      className={`w-full rounded-lg px-2 py-1.5 text-left ${disabled ? "" : "k-hover cursor-text"}`}
      aria-label={`Edit: ${label}`}
    >
      {lines.length ? (
        <ul className="grid gap-1">
          {lines.map((l, i) => (
            <li key={i} className="k-fg2 flex gap-2 text-[13px] leading-5">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
      ) : (
        <span className="k-fg4 text-[13px]">{placeholder}</span>
      )}
    </button>
  );
}
