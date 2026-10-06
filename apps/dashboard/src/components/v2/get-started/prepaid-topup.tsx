"use client";

/**
 * The credit a new org adds before its campaigns start (owner 2026-10-06): prepaid, no
 * free trial. A first amount picked from the choices or typed (at least $100), and an
 * OPTIONAL automatic reload: when the credit falls under a threshold (at least $5), add
 * an amount (at least $100). The wall and the dashboard walk's launch both draw it; the
 * charge itself is theirs (`payTopup`).
 *
 * The reload starts ticked (owner 2026-10-06): a visitor who set $24/day on $100 of
 * credit would stop in about 4 days. Unticking it while the credit lasts under
 * `RELOAD_OFF_WARNING_DAYS` at the visitor's own daily budget asks first.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_RELOAD_THRESHOLD_USD,
  RELOAD_OFF_WARNING_DAYS,
  creditRunwayDays,
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
  dailyUsd,
  onEditCampaigns,
  cta,
  onPay,
}: {
  busy: boolean;
  disabled?: boolean;
  /** What the campaigns the visitor switched on spend a day, in whole dollars. */
  dailyUsd: number;
  /** Back to the campaigns to lower a budget, offered when the reload is turned off. */
  onEditCampaigns?: () => void;
  /** The match, in billing's figures for this org. */
  matchNote: string;
  /** The button's words for an amount ("Add $100 and launch"). */
  cta: (usd: number) => string;
  onPay: (choice: TopupChoice) => void;
}) {
  const [first, setFirst] = useState<number | typeof OTHER>(TOPUP_CHOICES_USD[0]);
  const [firstOther, setFirstOther] = useState("");
  const [reloadOn, setReloadOn] = useState(true);
  const [askOff, setAskOff] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(String(DEFAULT_RELOAD_THRESHOLD_USD));
  const [reload, setReload] = useState<number | typeof OTHER>(RELOAD_CHOICES_USD[0]);
  const [reloadOther, setReloadOther] = useState("");
  const [shown, setShown] = useState(false);

  const firstParsed = amountOf(first, firstOther);
  const thresholdParsed = parseReloadThresholdUsd(threshold);
  const reloadParsed = amountOf(reload, reloadOther);
  const problem = (p: { usd: number } | { problem: string }) => (shown && "problem" in p ? p.problem : null);
  const off = busy || disabled;

  function toggleReload(next: boolean) {
    if (next) {
      setReloadOn(true);
      return;
    }
    const days = "usd" in firstParsed ? creditRunwayDays(firstParsed.usd, dailyUsd) : null;
    if (days !== null && days < RELOAD_OFF_WARNING_DAYS) setAskOff(days);
    else setReloadOn(false);
  }

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
          <input type="checkbox" checked={reloadOn} onChange={(e) => toggleReload(e.target.checked)} disabled={off} />
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
      {askOff !== null && "usd" in firstParsed && (
        <ReloadOffDialog
          days={askOff}
          creditUsd={firstParsed.usd}
          dailyUsd={dailyUsd}
          onKeep={() => setAskOff(null)}
          onTurnOff={() => {
            setAskOff(null);
            setReloadOn(false);
          }}
          onEditCampaigns={
            onEditCampaigns
              ? () => {
                  setAskOff(null);
                  onEditCampaigns();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Asked before the reload goes off while the credit lasts only a few days. */
function ReloadOffDialog({
  days,
  creditUsd,
  dailyUsd,
  onKeep,
  onTurnOff,
  onEditCampaigns,
}: {
  days: number;
  creditUsd: number;
  dailyUsd: number;
  onKeep: () => void;
  onTurnOff: () => void;
  onEditCampaigns?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The wall behind closes on Escape too: this answer is "keep it", the wall stays.
      e.stopImmediatePropagation();
      onKeep();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onKeep]);

  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  const lasts = days <= 1 ? "about a day" : `about ${days} days`;
  return createPortal(
    <div className="v2-root fixed inset-0 z-[70] flex items-start justify-center bg-[#1010121f] px-3 pt-[18vh]" onMouseDown={onKeep}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reload-off-title"
        className="k-popover gs-in w-full max-w-[500px] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span className="k-label">Automatic reload</span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onKeep}>
            ×
          </button>
        </div>
        <div className="grid gap-2 px-4 py-4">
          <p id="reload-off-title" className="k-fg text-[15px] font-semibold leading-6">
            Your campaigns would stop in {lasts}
          </p>
          <p className="k-fg2 text-[13px] leading-5">
            At {usd(dailyUsd)} a day, {usd(creditUsd)} of credit lasts {lasts}.
          </p>
          <p className="k-fg2 text-[13px] leading-5">With automatic reload, they keep running.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line-subtle)] px-4 py-3 sm:flex-nowrap">
          <button type="button" className="k-btn-ghost" onClick={onTurnOff}>
            Turn off anyway
          </button>
          <span className="ml-auto flex gap-2">
            {onEditCampaigns && (
              <button type="button" className="k-btn" onClick={onEditCampaigns}>
                Edit my campaigns
              </button>
            )}
            <button type="button" className="k-btn-accent" onClick={onKeep} autoFocus>
              Keep automatic reload
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
