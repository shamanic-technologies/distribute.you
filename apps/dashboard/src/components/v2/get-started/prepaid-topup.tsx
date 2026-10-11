"use client";

/**
 * The credit a new org adds before its campaigns start (owner 2026-10-06): prepaid, no
 * free trial. A first amount picked from the choices or typed (at least $100). The
 * automatic reload is REQUIRED (owner 2026-10-11): when the credit falls under
 * `DEFAULT_RELOAD_THRESHOLD_USD`, the same amount is added again; there is no switch, here
 * or in Billing (a customer who wants to stop removes their card or stops their campaigns).
 * The three statements of `spendConsentLines` are ticked before the button turns on. The
 * wall and the dashboard walk's launch both draw it; the charge itself is theirs (`payTopup`).
 */

import { useState } from "react";
import { DEFAULT_RELOAD_THRESHOLD_USD, TOPUP_CHOICES_USD, parseTopupUsd } from "@/lib/v2/get-started";
import { spendConsentLines } from "@/lib/v2/spend-consent";
import type { SignupLaunchPlan } from "@/lib/v2/signup-campaign";
import { SpendConsent, allTicked } from "./spend-consent";

export interface TopupChoice {
  topupUsd: number;
  /** Always set: the reload is required (owner 2026-10-11). */
  reload: { thresholdUsd: number; amountUsd: number };
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
  plan,
  cta,
  onPay,
}: {
  busy: boolean;
  disabled?: boolean;
  /** The campaign set at the "Your campaign" step: its caps are the first statement's figures. */
  plan: SignupLaunchPlan;
  /** The match, in billing's figures for this org. */
  matchNote: string;
  /** The button's words for an amount ("Pay $100 + get $100 free"). */
  cta: (usd: number) => string;
  onPay: (choice: TopupChoice) => void;
}) {
  const [first, setFirst] = useState<number | typeof OTHER>(TOPUP_CHOICES_USD[0]);
  const [firstOther, setFirstOther] = useState("");
  const [ticked, setTicked] = useState([false, false, false]);
  const [shown, setShown] = useState(false);

  const firstParsed = amountOf(first, firstOther);
  const problem = shown && "problem" in firstParsed ? firstParsed.problem : null;
  const off = busy || disabled;
  const lines = spendConsentLines({
    proactive: plan.proactive.caps.maxBudget,
    reactive: plan.reactive?.caps.maxBudget ?? null,
    // Until a valid amount is typed, the statement names the smallest one we take.
    arm: { kind: "prepaid", topupUsd: "usd" in firstParsed ? firstParsed.usd : TOPUP_CHOICES_USD[0] },
  });

  function submit() {
    setShown(true);
    if ("problem" in firstParsed || !allTicked(ticked)) return;
    onPay({
      topupUsd: firstParsed.usd,
      reload: { thresholdUsd: DEFAULT_RELOAD_THRESHOLD_USD, amountUsd: firstParsed.usd },
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
          problem={problem}
          disabled={off}
        />
        {matchNote && <p className="k-fg2 mt-2 text-[12.5px] leading-5">{matchNote}</p>}
      </div>
      <SpendConsent lines={lines} ticked={ticked} onChange={setTicked} disabled={off} />
      <button type="button" className="k-cta k-btn-accent gs-glow w-full justify-center" onClick={submit} disabled={off || !allTicked(ticked)}>
        {busy ? "Opening the card form..." : "usd" in firstParsed ? cta(firstParsed.usd) : "Add credit and launch"}
      </button>
    </div>
  );
}
