"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { parseReloadAmountCents, usd } from "@/lib/v2/auto-topup-line";

/**
 * The auto top-up AMOUNT, as text that turns into its field on click (v2 inline edit:
 * blur or Enter saves, Esc drops it, the typed value shows while saving). Owner
 * 2026-11-18: the amount is the client's to change, the $0 threshold is not, and $0
 * turns auto top-up off. The minimum is billing's own: a refusal names it
 * (`minimum_cents`), printed as is.
 */
export function ReloadAmount({
  amountCents,
  onSave,
}: {
  amountCents: number;
  onSave: (cents: number) => Promise<void>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? amountCents;

  const commit = async () => {
    if (text === null) return;
    const cents = parseReloadAmountCents(text);
    if (cents === null) {
      setError("Whole dollars.");
      return;
    }
    setText(null);
    setError(null);
    if (cents === amountCents) return;
    setPending(cents);
    try {
      await onSave(cents);
    } catch (err) {
      console.error("[billing v2] reload amount save failed", { cents, err });
      const min = err instanceof ApiError ? err.body?.minimum_cents : undefined;
      const required = err instanceof ApiError && err.status === 409 && err.body?.code === "auto_topup_required";
      setText(String(cents / 100));
      setError(
        required
          ? "Auto top-up stays on for this account."
          : typeof min === "number"
            ? `$0 or at least ${usd(min)}.`
            : "Not saved. Try again.",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      {text !== null ? (
        <span className="inline-flex items-center rounded-[6px] px-1 ring-1 ring-[var(--line)]">
          $
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Auto top-up amount, dollars"
            value={text}
            size={Math.max(1, text.length)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setText(null);
                setError(null);
              }
            }}
            style={{ font: "inherit" }}
            className="k-fg bg-transparent tabular-nums outline-none"
          />
        </span>
      ) : (
        <button
          type="button"
          title="Change the amount. $0 turns auto top-up off."
          onClick={() => setText(String(shown / 100))}
          className="k-hover k-fg rounded-[6px] px-1 font-medium tabular-nums underline decoration-dotted underline-offset-2"
        >
          {usd(shown)}
        </button>
      )}
      {error && (
        <span role="alert" className="ml-1.5 text-[var(--data-rose)]">
          {error}
        </span>
      )}
    </>
  );
}
