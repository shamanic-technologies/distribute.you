"use client";

/**
 * The credit a new org adds before its campaigns start (owner 2026-10-06): prepaid, no
 * free trial. A first amount picked from the choices or typed (at least billing's first
 * top-up minimum). The automatic reload is REQUIRED (owner 2026-10-11): when the balance
 * reaches $0 (owner 2026-11-18), the same amount is added again; there is no switch, here
 * or in Billing (a customer who wants to stop removes their card or stops their campaigns).
 * Every minimum and default is billing's reload rules (`getReloadRules`,
 * RELOAD-RULE-ONE-HOME-1118), read here before the step shows: no number lives in this file.
 * The statements of `spendConsentLines` are ticked before the button turns on. The
 * wall and the dashboard walk's launch both draw it; the charge itself is theirs (`payTopup`).
 */

import { useEffect, useState } from "react";
import { getReloadRules } from "@/lib/api";
import {
  AT_COST_TOPUP_CHOICES_USD,
  TOPUP_CHOICES_USD,
  atCostCheckout,
  parseTopupUsd,
  reloadRulesUsd,
  type ReloadRulesUsd,
} from "@/lib/v2/get-started";
import { Shimmer } from "../ui";
import { monthlyLimitToSave } from "@/lib/v2/monthly-limit";
import { consentRecord, spendConsentLines, type PaymentConsentRecord } from "@/lib/v2/spend-consent";
import { SpendConsent, allTicked } from "./spend-consent";

export interface TopupChoice {
  topupUsd: number;
  /** null = no automatic reload (the at-cost checkout's box unticked, owner 2026-10-29). */
  reload: { amountUsd: number } | null;
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
function amountOf(value: number | typeof OTHER, other: string, minUsd: number): { usd: number } | { problem: string } {
  return value === OTHER ? parseTopupUsd(other, minUsd) : { usd: value };
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
 * The at-cost checkout (owner 2026-10-29, every org created since): the first top-up,
 * then the automatic reload, OPTIONAL and ticked by default: at $0, add $Y (no threshold,
 * owner 2026-11-18: « On ne permet pas de changer cette valeur nulle part »). Each
 * minimum and default is billing's (`rules`). One step, one payment. No match, nothing free.
 */
function AtCostTopup({
  busy,
  disabled,
  monthlyLimit,
  rules,
  cta,
  onPay,
}: {
  busy: boolean;
  disabled: boolean;
  monthlyLimit?: string | null;
  rules: ReloadRulesUsd;
  cta: (usd: number) => string;
  onPay: (choice: TopupChoice) => void;
}) {
  const [first, setFirst] = useState<number | typeof OTHER>(AT_COST_TOPUP_CHOICES_USD[0]);
  const [firstOther, setFirstOther] = useState("");
  const [reload, setReload] = useState(String(rules.defaultReloadUsd));
  const [reloadOn, setReloadOn] = useState(true);
  const [ticked, setTicked] = useState([false, false]);
  const [shown, setShown] = useState(false);

  const checked = atCostCheckout({ topup: first === OTHER ? firstOther : String(first), reload, reloadOn }, rules);
  const off = busy || disabled;
  const topupUsd = checked.values?.topupUsd ?? AT_COST_TOPUP_CHOICES_USD[0];
  const limit = monthlyLimit === undefined ? null : monthlyLimitToSave(monthlyLimit, { kind: "prepaid", topupUsd });
  const lines = spendConsentLines({
    arm: {
      kind: "prepaid",
      topupUsd,
      reload: reloadOn ? { amountUsd: checked.values?.reloadUsd ?? rules.defaultReloadUsd } : null,
      ...(limit && "usd" in limit ? { limitUsd: limit.usd } : {}),
    },
  });

  function submit() {
    setShown(true);
    if (!checked.values || !allTicked(ticked)) return;
    onPay({
      topupUsd: checked.values.topupUsd,
      reload: checked.values.reloadUsd !== null ? { amountUsd: checked.values.reloadUsd } : null,
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
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={reloadOn} onChange={(e) => {
              setReloadOn(e.target.checked);
              // The reload statement changes with it: ticked again on its new words.
              setTicked((t) => [false, t[1]]);
            }} disabled={off} />
          <span className="k-fg font-medium">Reload my credit automatically</span>
        </label>
        {reloadOn && (
          <div className="mt-2 flex flex-wrap items-start gap-4">
            <DollarField label="When my balance reaches $0, add" value={reload} onChange={setReload} problem={checked.problems.reload} disabled={off} />
          </div>
        )}
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
  rules,
  cta,
  onPay,
}: {
  busy: boolean;
  disabled?: boolean;
  /** billing's reload rules for this org: the first top-up minimum. */
  rules: ReloadRulesUsd;

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

  const firstParsed = amountOf(first, firstOther, rules.firstTopupMinUsd);
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
      reload: { amountUsd: firstParsed.usd },
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
 * billing's reload rules for the open org, read once when the credit step shows. null
 * while reading; `failed` when billing could not be asked (the step then says so: it
 * never falls back on a number of its own).
 */
function useReloadRules(): { rules: ReloadRulesUsd | null; failed: boolean } {
  const [state, setState] = useState<{ rules: ReloadRulesUsd | null; failed: boolean }>({ rules: null, failed: false });
  useEffect(() => {
    let live = true;
    getReloadRules()
      .then((r) => {
        if (live) setState({ rules: reloadRulesUsd(r), failed: false });
      })
      .catch((e) => {
        console.error("[get-started] reload rules read failed:", e);
        if (live) setState({ rules: null, failed: true });
      });
    return () => {
      live = false;
    };
  }, []);
  return state;
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
  const { rules, failed } = useReloadRules();
  if (failed) {
    return <p className="text-[12.5px] text-[var(--data-rose)]">We could not load the credit amounts. Reload the page to try again.</p>;
  }
  if (!rules) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Shimmer className="h-7 w-full" />
        <Shimmer className="h-7 w-2/3" />
        <Shimmer className="h-12 w-full" />
      </div>
    );
  }
  if (atCost) {
    return <AtCostTopup busy={rest.busy} disabled={rest.disabled ?? false} monthlyLimit={rest.monthlyLimit} rules={rules} cta={rest.cta} onPay={rest.onPay} />;
  }
  return <MatchTopup {...rest} rules={rules} />;
}
