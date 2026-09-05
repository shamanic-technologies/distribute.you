"use client";

/**
 * Stating that a deal was WON, in one place.
 *
 * Two surfaces ask it — the leads table's Close won column, and a card dropped on the
 * board's Close won column — and they ask exactly the same two questions in exactly the
 * same words because they are one form mounted twice. A second implementation is how
 * one surface comes to ask whose win it was and the other not to, on the same deal.
 *
 * The order is deliberate: whose win it was is asked FIRST, because it is the question
 * this control exists for and the one a person can answer without looking anything up.
 * The amounts follow through `StageStatementForm`, which is the single place lead-
 * service's mandatory-cost rule lives.
 */

import { useState } from "react";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { StageStatementForm } from "@/components/leads/lead-funnel-stage-section";

export const CAUSE_TIP =
  "Whether the outreach we run for you is what produced this deal. Say no when it came from something else you already do — a referral, an event, a pipeline you already had — even though we had also emailed them. A no costs you nothing: the deal still counts as yours and stays in your revenue. It only keeps its value out of the return we report on our own outreach, so that number is about what we actually caused.";

export function CloseWonForm({
  prefillUsd,
  busy,
  onSubmit,
  onCancel,
}: {
  /** The brand's own stated lifetime revenue for THIS lead's funnel, in whole dollars. */
  prefillUsd: number | null;
  busy: boolean;
  onSubmit: (input: {
    costCents: number;
    valueCents: number;
    causedByOutreach: boolean;
  }) => void;
  onCancel: () => void;
}) {
  // Which of the two answers the person has picked, if any. `null` means they have not
  // picked yet, and the submit stays disabled — the whole point of the question is that
  // the answer is STATED, so defaulting one here would put words in their mouth and
  // record them as if somebody had said them.
  const [cause, setCause] = useState<boolean | null>(null);

  // Every press inside this form stops whatever it is mounted in from reacting: the
  // table's row opens the detail panel and the board's card is draggable, and a form
  // whose inputs open a panel underneath them is unusable.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div onClick={stop} className="flex flex-col items-end gap-1">
      {/* Asked BEFORE the amounts. Two named buttons rather than a checkbox: "did we
          cause this" has two real answers and an unticked box would read as the second
          one without anybody choosing it. */}
      <div className="flex items-center justify-end gap-1 flex-wrap">
        <span className="text-xs text-gray-500">Caused by us?</span>
        {([true, false] as const).map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={(e) => {
              stop(e);
              setCause(value);
            }}
            aria-pressed={cause === value}
            className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
              cause === value
                ? value
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-gray-100 text-gray-700 border-gray-300"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {value ? "Yes" : "No"}
          </button>
        ))}
        <InfoTooltip tip={CAUSE_TIP} />
      </div>
      <StageStatementForm
        label="Close won"
        tone="outcome"
        // lead-service refuses a sale with no value, so the form always asks — the
        // prefill is what it opens with, not what it sends.
        needsValue
        defaultValueUsd={prefillUsd}
        busy={busy}
        // Held back until the cause is answered. The form's own submit already refuses
        // a blank amount; this is the same rule for the same reason.
        disabled={cause === null}
        onSubmit={({ costCents, valueCents }) => {
          if (cause === null) return;
          onSubmit({ costCents, valueCents: valueCents as number, causedByOutreach: cause });
        }}
        onCancel={onCancel}
      />
    </div>
  );
}
