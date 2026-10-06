"use client";

/**
 * The credit a new org adds before its campaigns start (owner 2026-10-06): prepaid, no
 * free trial. A first amount picked from the choices or typed (at least $100), and an
 * OPTIONAL automatic reload: when the credit falls under a threshold (at least $5), add
 * an amount (at least $100). The wall and the dashboard walk's launch both draw it; the
 * charge itself is theirs (`payTopup`).
 */

import { useState } from "react";
import {
  DEFAULT_RELOAD_THRESHOLD_USD,
  RELOAD_CHOICES_USD,
  TOPUP_CHOICES_USD,
  parseReloadThresholdUsd,
  parseTopupUsd,
} from "@/lib/v2/get-started";

export interface TopupChoice {
  topupUsd: number;
  reload: { thresholdUsd: number; amountUsd: number } | null;
}

const OTHER = "other";

/** One amount: a row of choices, then "Other" opening a field. */
function AmountPicker({
  label,
  choices,
  value,
  onChange,
  other,
  onOther,
  problem,
  disabled,
}: {
  label: string;
  choices: readonly number[];
  value: number | typeof OTHER;
  onChange: (v: number | typeof OTHER) => void;
  other: string;
  onOther: (v: string) => void;
  problem: string | null;
  disabled: boolean;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {choices.map((usd) => (
          <button
            key={usd}
            type="button"
            role="radio"
            aria-checked={value === usd}
            disabled={disabled}
            onClick={() => onChange(usd)}
            className={`${value === usd ? "k-btn-strong" : "k-btn"} tabular-nums`}
          >
            ${usd.toLocaleString("en-US")}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={value === OTHER}
          disabled={disabled}
          onClick={() => onChange(OTHER)}
          className={value === OTHER ? "k-btn-strong" : "k-btn"}
        >
          Other
        </button>
      </div>
      {value === OTHER && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="k-fg2 text-[13px]">$</span>
          <input
            autoFocus
            className={`k-input w-24 px-2 text-right tabular-nums ${problem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
            inputMode="numeric"
            value={other}
            onChange={(e) => onOther(e.target.value)}
            disabled={disabled}
            aria-label={`${label}, other amount in dollars`}
            aria-invalid={problem !== null}
          />
        </div>
      )}
      {problem && <p className="mt-1 text-[12px] text-[var(--data-rose)]">{problem}</p>}
    </div>
  );
}

/** The picked amount, or the reason the typed one cannot be used. */
function amountOf(value: number | typeof OTHER, other: string): { usd: number } | { problem: string } {
  return value === OTHER ? parseTopupUsd(other) : { usd: value };
}

export function PrepaidTopup({
  busy,
  disabled = false,
  matchNote,
  cta,
  onPay,
}: {
  busy: boolean;
  disabled?: boolean;
  /** The match, in billing's figures for this org. */
  matchNote: string;
  /** The button's words for an amount ("Add $100 and launch"). */
  cta: (usd: number) => string;
  onPay: (choice: TopupChoice) => void;
}) {
  const [first, setFirst] = useState<number | typeof OTHER>(TOPUP_CHOICES_USD[0]);
  const [firstOther, setFirstOther] = useState("");
  const [reloadOn, setReloadOn] = useState(false);
  const [threshold, setThreshold] = useState(String(DEFAULT_RELOAD_THRESHOLD_USD));
  const [reload, setReload] = useState<number | typeof OTHER>(RELOAD_CHOICES_USD[0]);
  const [reloadOther, setReloadOther] = useState("");
  const [shown, setShown] = useState(false);

  const firstParsed = amountOf(first, firstOther);
  const thresholdParsed = parseReloadThresholdUsd(threshold);
  const reloadParsed = amountOf(reload, reloadOther);
  const problem = (p: { usd: number } | { problem: string }) => (shown && "problem" in p ? p.problem : null);
  const off = busy || disabled;

  function submit() {
    setShown(true);
    if ("problem" in firstParsed) return;
    if (reloadOn && ("problem" in thresholdParsed || "problem" in reloadParsed)) return;
    onPay({
      topupUsd: firstParsed.usd,
      reload:
        reloadOn && "usd" in thresholdParsed && "usd" in reloadParsed
          ? { thresholdUsd: thresholdParsed.usd, amountUsd: reloadParsed.usd }
          : null,
    });
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="k-label mb-2">Add credit</p>
        <AmountPicker
          label="Credit to add"
          choices={TOPUP_CHOICES_USD}
          value={first}
          onChange={(v) => {
            setFirst(v);
            setShown(false);
          }}
          other={firstOther}
          onOther={setFirstOther}
          problem={problem(firstParsed)}
          disabled={off}
        />
        {matchNote && <p className="k-fg2 mt-2 text-[12.5px] leading-5">{matchNote}</p>}
      </div>
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={reloadOn} onChange={(e) => setReloadOn(e.target.checked)} disabled={off} />
          Reload automatically
        </label>
        {reloadOn && (
          <div className="mt-2 grid gap-2 pl-6">
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="k-fg2">When credit falls under $</span>
              <input
                className={`k-input w-16 px-2 text-right tabular-nums ${problem(thresholdParsed) ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={off}
                aria-label="Reload when credit falls under, in dollars"
              />
              {problem(thresholdParsed) && <span className="w-full text-[12px] text-[var(--data-rose)]">{problem(thresholdParsed)}</span>}
            </div>
            <div>
              <p className="k-fg2 mb-1.5 text-[13px]">add</p>
              <AmountPicker
                label="Credit each reload adds"
                choices={RELOAD_CHOICES_USD}
                value={reload}
                onChange={setReload}
                other={reloadOther}
                onOther={setReloadOther}
                problem={problem(reloadParsed)}
                disabled={off}
              />
            </div>
          </div>
        )}
      </div>
      <button type="button" className="k-cta k-btn-accent w-full" onClick={submit} disabled={off}>
        {busy ? "Opening the card form..." : "usd" in firstParsed ? cta(firstParsed.usd) : "Add credit and launch"}
      </button>
    </div>
  );
}
