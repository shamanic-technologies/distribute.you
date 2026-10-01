"use client";

/**
 * The form a person fills to state what happened at one step of a lead's leg (what it
 * cost, and for a sale what it was worth), rather than it being measured.
 *
 * Presentational on purpose: the caller owns the write, so this file carries no query,
 * no mutation and no knowledge of how an outcome is recorded.
 */

import { useState } from "react";

import { InfoTooltip } from "@/components/visibility/metric-info";
import { saleValueCentsFrom, stepCostCentsFrom } from "@/lib/lead-stages";

const VALUE_TIP =
  "What the deal is worth. We record the amount you state instead of pricing it at your average customer, which is what every return and cost-per-customer figure is built on.";

const COST_TIP =
  "What this step cost you: your own time, valued however you like, plus anything you paid out. We only bill for the outreach we run, so we cannot see the rest of it unless you tell us. Enter 0 if it cost you nothing. This is your money. We record what you tell us and we never charge you for it.";

/**
 * Said beside the field, not only inside a tooltip. A number in a dollar box on a
 * screen that also shows credits and spend reads as something we are about to charge,
 * and a person will not open a tooltip to find out otherwise.
 */
const COST_CAPTION = "Your own spend. We never bill it.";

/**
 * The question every statement now has to answer, asked at the moment it is made.
 *
 * The platform automates the first leg and the CUSTOMER performs the rest, so they are
 * the only one who can say what their leg cost. lead-service makes that cost
 * mandatory on both kinds of statement, so this form stands between the button and the
 * write on every stage, "Won't happen" included: a meeting that was run and went nowhere
 * still cost what it cost.
 *
 * Nothing is guessed on the author's behalf. A blank field leaves the button disabled
 * rather than sending a zero nobody typed, and ZERO IS A LEGITIMATE ANSWER that submits
 * and reads back as a stated zero. The amount a won deal was WORTH is a separate
 * question and is asked here too, on the one stage the producer prices.
 */
/**
 * Exported so the leads BOARD asks the same two questions in the same words. A second
 * cost prompt is a second place for the producer's mandatory-cost rule to drift, and it
 * is the one control standing between a person and a write on every stage.
 */
export function StageStatementForm({
  label,
  tone,
  needsValue,
  defaultValueUsd,
  busy,
  disabled = false,
  onSubmit,
  onCancel,
}: {
  label: string;
  tone: "outcome" | "never";
  /** Whether this statement also has to say what the deal was worth. */
  needsValue: boolean;
  /**
   * What to put in the value field before anybody types, in whole dollars — the offer's
   * own stated lifetime revenue, resolved by the caller.
   *
   * A PREFILL, not a default. What is sent is whatever the field holds when the person
   * submits, so this is a suggestion they confirm or replace rather than a number this
   * app decides on their behalf. Absent (or null) opens the field EMPTY, which is the
   * honest reading for an offer the brand never priced: lead-service still refuses a
   * sale with no value, so they meet exactly the question they should.
   *
   * Seeded through the `useState` initializer so it applies once. Re-seeding on a later
   * render would rewrite an amount somebody is in the middle of typing.
   */
  defaultValueUsd?: number | null;
  busy: boolean;
  /**
   * A question the CALLER still needs answered before this statement can be sent — the
   * leads table asks whose win the deal was before it asks what it was worth. Held here
   * rather than by disabling the submit at the call site, so there is ONE place a
   * statement can be refused for being incomplete.
   */
  disabled?: boolean;
  onSubmit: (input: { costCents: number; valueCents?: number }) => void;
  onCancel: () => void;
}) {
  const [rawValue, setRawValue] = useState(() =>
    defaultValueUsd != null && defaultValueUsd > 0 ? String(defaultValueUsd) : "",
  );
  const [rawCost, setRawCost] = useState("");
  const valueCents = saleValueCentsFrom(rawValue);
  const costCents = stepCostCentsFrom(rawCost);
  // Both questions have to be answered before anything is sent. `costCents == null` is
  // an unanswered field, never a zero: `stepCostCentsFrom("0")` is 0 and submits.
  const ready = !disabled && costCents != null && (!needsValue || valueCents != null);
  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        // The button is disabled, but Enter in a text field submits a form regardless,
        // so the refusal lives in the handler as well as in the button's state.
        if (disabled) return;
        if (costCents == null) return;
        if (needsValue && valueCents == null) return;
        onSubmit(needsValue ? { costCents, valueCents: valueCents as number } : { costCents });
      }}
    >
      <div className="flex items-center justify-end gap-1.5 flex-wrap">
        {needsValue && (
          <span className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Worth $</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={rawValue}
              onChange={(e) => setRawValue(e.target.value)}
              placeholder="4,900"
              aria-label={`${label}: what the deal was worth, in dollars`}
              data-testid="lead-stage-value-input"
              className="w-20 px-2 py-1 text-xs rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-green-300"
            />
            <InfoTooltip tip={VALUE_TIP} />
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Cost to you $</span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus={!needsValue}
            value={rawCost}
            onChange={(e) => setRawCost(e.target.value)}
            placeholder="0"
            aria-label={`${label}: what this step cost you, in dollars`}
            data-testid="lead-stage-cost-input"
            className="w-20 px-2 py-1 text-xs rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-green-300"
          />
          <InfoTooltip tip={COST_TIP} />
        </span>
        <button
          type="submit"
          disabled={!ready || busy}
          title={
            tone === "outcome"
              ? `${label}: record that it happened`
              : `${label}: record that it will not happen`
          }
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border bg-white text-gray-500 border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy && (
            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-gray-400" data-testid="lead-stage-cost-caption">
        {COST_CAPTION}
      </p>
    </form>
  );
}

