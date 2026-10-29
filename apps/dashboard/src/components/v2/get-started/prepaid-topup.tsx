"use client";

/**
 * The credit a new org adds before its campaigns start (owner 2026-10-06): prepaid, no
 * free trial. A first amount picked from the choices or typed (at least $100). The
 * automatic reload is REQUIRED (owner 2026-10-11): when the credit falls under
 * `DEFAULT_RELOAD_THRESHOLD_USD`, the same amount is added again; there is no switch, here
 * or in Billing (a customer who wants to stop removes their card or stops their campaigns).
 * The statements of `spendConsentLines` are ticked before the button turns on. The
 * wall and the dashboard walk's launch both draw it; the charge itself is theirs (`payTopup`).
 */

import { useState } from "react";
import {
  AT_COST_DEFAULT_RELOAD_USD,
  AT_COST_DEFAULT_THRESHOLD_USD,
  AT_COST_TOPUP_CHOICES_USD,
  DEFAULT_RELOAD_THRESHOLD_USD,
  TOPUP_CHOICES_USD,
  atCostCheckout,
  parseTopupUsd,
} from "@/lib/v2/get-started";
import { monthlyLimitToSave } from "@/lib/v2/monthly-limit";
import { consentRecord, spendConsentLines, type PaymentConsentRecord } from "@/lib/v2/spend-consent";
import { SpendConsent, allTicked } from "./spend-consent";

export interface TopupChoice {
  topupUsd: number;
  /** Always set: the reload is required (owner 2026-10-11). */
  reload: { thresholdUsd: number; amountUsd: number };
  /** The statements as ticked, for billing's record. */
  consent: PaymentConsentRecord;
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

/** One whole-dollar field of the at-cost checkout, with its own problem under it. */
function DollarField({
  label,
  value,
  onChange,
  problem,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  problem: string | null;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="k-fg2 text-[12.5px]">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="k-fg2 text-[13px]">$</span>
        <input
          className={`k-input w-24 px-2 text-right tabular-nums ${problem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={problem !== null}
        />
      </span>
      {problem && <span className="text-[12px] text-[var(--data-rose)]">{problem}</span>}
    </label>
  );
}

/**
 * The at-cost checkout (owner 2026-10-29, every org created since): the first top-up
 * (at least $10), then the automatic reload: under $X (at least $5), add $Y (at least
 * $X + $10). Required, one step, one payment. No match, nothing free.
 */
function AtCostTopup({
  busy,
  disabled,
  monthlyLimit,
  cta,
  onPay,
}: {
  busy: boolean;
  disabled: boolean;
  monthlyLimit?: string | null;
  cta: (usd: number) => string;
  onPay: (choice: TopupChoice) => void;
}) {
  const [first, setFirst] = useState<number | typeof OTHER>(AT_COST_TOPUP_CHOICES_USD[0]);
  const [firstOther, setFirstOther] = useState("");
  const [threshold, setThreshold] = useState(String(AT_COST_DEFAULT_THRESHOLD_USD));
  const [reload, setReload] = useState(String(AT_COST_DEFAULT_RELOAD_USD));
  const [ticked, setTicked] = useState([false, false]);
  const [shown, setShown] = useState(false);

  const checked = atCostCheckout({ topup: first === OTHER ? firstOther : String(first), threshold, reload });
  const off = busy || disabled;
  const topupUsd = checked.values?.topupUsd ?? AT_COST_TOPUP_CHOICES_USD[0];
  const limit = monthlyLimit === undefined ? null : monthlyLimitToSave(monthlyLimit, { kind: "prepaid", topupUsd });
  const lines = spendConsentLines({
    arm: {
      kind: "prepaid",
      topupUsd,
      reload: {
        thresholdUsd: checked.values?.thresholdUsd ?? AT_COST_DEFAULT_THRESHOLD_USD,
        amountUsd: checked.values?.reloadUsd ?? AT_COST_DEFAULT_RELOAD_USD,
      },
      ...(limit && "usd" in limit ? { limitUsd: limit.usd } : {}),
    },
  });

  function submit() {
    setShown(true);
    if (!checked.values || !allTicked(ticked)) return;
    onPay({
      topupUsd: checked.values.topupUsd,
      reload: { thresholdUsd: checked.values.thresholdUsd, amountUsd: checked.values.reloadUsd },
      consent: consentRecord(lines, new Date(), navigator.userAgent),
    });
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="k-label mb-2">Add credit</p>
        <AmountPicker
          label="Credit to add"
          choices={AT_COST_TOPUP_CHOICES_USD}
          value={first}
          onChange={(v) => {
            setFirst(v);
            setShown(false);
          }}
          other={firstOther}
          onOther={setFirstOther}
          problem={shown || first !== OTHER ? checked.problems.topup : null}
          disabled={off}
        />
      </div>
      <div>
        <p className="k-label mb-2">Automatic reload</p>
        <div className="flex flex-wrap items-start gap-4">
          <DollarField label="When my credit falls under" value={threshold} onChange={setThreshold} problem={checked.problems.threshold} disabled={off} />
          <DollarField label="Add" value={reload} onChange={setReload} problem={checked.problems.reload} disabled={off} />
        </div>
      </div>
      <SpendConsent lines={lines} ticked={ticked} onChange={setTicked} disabled={off} />
      <button
        type="button"
        className="k-cta k-btn-accent gs-glow w-full justify-center"
        onClick={submit}
        disabled={off || !allTicked(ticked) || !checked.values}
      >
        {busy ? "Opening the card form..." : checked.values ? cta(checked.values.topupUsd) : "Add credit and launch"}
      </button>
    </div>
  );
}

function MatchTopup({
  busy,
  disabled = false,
  matchNote,
  monthlyLimit,
  cta,
  onPay,
}: {
  busy: boolean;
  disabled?: boolean;

  /** The monthly limit typed at the campaign step (null while untouched); absent where none is set. */
  monthlyLimit?: string | null;
  /** The match, in billing's figures for this org. */
  matchNote: string;
  /** The button's words for an amount ("Pay $100 + get $100 free"). */
  cta: (usd: number) => string;
  onPay: (choice: TopupChoice) => void;
}) {
  const [first, setFirst] = useState<number | typeof OTHER>(TOPUP_CHOICES_USD[0]);
  const [firstOther, setFirstOther] = useState("");
  const [ticked, setTicked] = useState([false, false]);
  const [shown, setShown] = useState(false);

  const firstParsed = amountOf(first, firstOther);
  const problem = shown && "problem" in firstParsed ? firstParsed.problem : null;
  const off = busy || disabled;
  // Until a valid amount is typed, the statement names the smallest one we take.
  const topupUsd = "usd" in firstParsed ? firstParsed.usd : TOPUP_CHOICES_USD[0];
  // The limit the wall saves before the charge, named in the reload statement.
  const limit = monthlyLimit === undefined ? null : monthlyLimitToSave(monthlyLimit, { kind: "prepaid", topupUsd });
  const lines = spendConsentLines({
    arm: { kind: "prepaid", topupUsd, ...(limit && "usd" in limit ? { limitUsd: limit.usd } : {}) },
  });

  function submit() {
    setShown(true);
    if ("problem" in firstParsed || !allTicked(ticked)) return;
    onPay({
      topupUsd: firstParsed.usd,
      reload: { thresholdUsd: DEFAULT_RELOAD_THRESHOLD_USD, amountUsd: firstParsed.usd },
      consent: consentRecord(lines, new Date(), navigator.userAgent),
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

/**
 * The wall's and the dashboard walk's credit step: the at-cost checkout for an org
 * billing serves `prepaid_at_cost`, else the older offer's (match, unchanged).
 */
export function PrepaidTopup(props: {
  busy: boolean;
  disabled?: boolean;
  /** billing serves this org the prepaid at cost offer: its own checkout, no match. */
  atCost?: boolean;
  monthlyLimit?: string | null;
  matchNote: string;
  cta: (usd: number) => string;
  onPay: (choice: TopupChoice) => void;
}) {
  const { atCost = false, ...rest } = props;
  if (atCost) {
    return <AtCostTopup busy={rest.busy} disabled={rest.disabled ?? false} monthlyLimit={rest.monthlyLimit} cta={rest.cta} onPay={rest.onPay} />;
  }
  return <MatchTopup {...rest} />;
}
