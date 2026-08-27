"use client";

/**
 * What happened to ONE lead at each stage of its campaign's sales funnel, stated by a
 * person rather than measured.
 *
 * Presentational on purpose — it takes the stages, what is known about each, and one
 * callback. The page owns the reads and the write, so this file carries no query, no
 * mutation and no knowledge of how an outcome is recorded. That is what lets it be the
 * SAME component in the customer dashboard and the staff console: two copies of a
 * control that states a customer's funnel is how the two surfaces come to disagree
 * about one lead.
 *
 * One difference from the dashboard's copy: no reply control on the reply row. This
 * console already states the reply kind in its own qualification modal, and offering it
 * twice would be two affordances for one fact.
 */

import { useState, type ReactNode } from "react";

import { InfoTooltip } from "@/components/visibility/metric-info";
import {
  isWritableStage,
  saleValueCentsFrom,
  stageRequiresValue,
  stepCostCentsFrom,
  type LeadFunnelStage,
  type LeadStageKey,
  type LeadStageState,
  type WritableStageKey,
} from "@/lib/lead-funnel-stages";

const HEADING_CLASS = "text-xs font-medium text-gray-500 uppercase tracking-wider";

/**
 * The terminal statement, in the words a person uses about a deal that is not coming.
 * "Never" read as an absence someone had not filled in yet; this reads as the decision
 * it is. The wire value is still `never` — this is copy, not vocabulary.
 */
const WONT_LABEL = "Won't happen";

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


const DELIVERY_TIP =
  "What our sending has already done with this lead, measured rather than stated: queued, sent, delivered, bounced, unsubscribed. Nobody edits it here, and it is not a step of the funnel below, which is about what the person did next.";

const TRACKED_TIP =
  "We already recorded this automatically. You can still state it yourself, which is what to do when the automatic match missed, for example when someone signed up with a different address than the one we emailed.";

/** The stated amount, read back in the same currency the rest of the dashboard shows. */
function formatValue(valueCents: number): string {
  return (valueCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: valueCents % 100 === 0 ? 0 : 2,
  });
}

function StageButton({
  active,
  disabled,
  busy,
  label,
  title,
  tone,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  busy: boolean;
  label: string;
  title: string;
  tone: "outcome" | "never";
  onClick: () => void;
}) {
  const activeClass =
    tone === "outcome"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      aria-label={title}
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
        active ? activeClass : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
      } ${busy ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"}`}
    >
      {busy && (
        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {label}
    </button>
  );
}

/**
 * The question every statement now has to answer, asked at the moment it is made.
 *
 * The platform automates the first link of the funnel and the CUSTOMER performs the rest,
 * so they are the only one who can say what their leg cost. lead-service makes that cost
 * mandatory on both kinds of statement, so this form stands between the button and the
 * write on every stage, "Won't happen" included: a meeting that was run and went nowhere
 * still cost what it cost.
 *
 * Nothing is guessed on the author's behalf. A blank field leaves the button disabled
 * rather than sending a zero nobody typed, and ZERO IS A LEGITIMATE ANSWER that submits
 * and reads back as a stated zero. The amount a won deal was WORTH is a separate
 * question and is asked here too, on the one stage the producer prices.
 */
function StageStatementForm({
  label,
  tone,
  needsValue,
  busy,
  onSubmit,
  onCancel,
}: {
  label: string;
  tone: "outcome" | "never";
  /** Whether this statement also has to say what the deal was worth. */
  needsValue: boolean;
  busy: boolean;
  onSubmit: (input: { costCents: number; valueCents?: number }) => void;
  onCancel: () => void;
}) {
  const [rawValue, setRawValue] = useState("");
  const [rawCost, setRawCost] = useState("");
  const valueCents = saleValueCentsFrom(rawValue);
  const costCents = stepCostCentsFrom(rawCost);
  // Both questions have to be answered before anything is sent. `costCents == null` is
  // an unanswered field, never a zero: `stepCostCentsFrom("0")` is 0 and submits.
  const ready = costCents != null && (!needsValue || valueCents != null);
  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
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
              data-testid="lead-funnel-stage-value-input"
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
            data-testid="lead-funnel-stage-cost-input"
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
      <p className="text-[11px] text-gray-400" data-testid="lead-funnel-stage-cost-caption">
        {COST_CAPTION}
      </p>
    </form>
  );
}

export function LeadFunnelStageSection({
  funnelName,
  stages,
  states,
  tracked,
  delivery,
  implied,
  values,
  costs,
  pending,
  error,
  onSet,
  disabled = false,
}: {
  /** The campaign's funnel, named so the reader knows which funnel's steps these are. */
  funnelName: string;
  stages: LeadFunnelStage[];
  /** What has been stated per stage. A stage absent from the map is pending. */
  states: Partial<Record<LeadStageKey, LeadStageState>>;
  /** Stages we ALSO measured automatically, so the row can say so. */
  tracked: Partial<Record<LeadStageKey, boolean>>;
  /**
   * Where our own sending got to, as the caller already renders it elsewhere. Read
   * only: it is measured, so there is nothing for a person to state, and it sits ABOVE
   * the steps because every funnel starts after the email arrives. Absent (a scope
   * with no delivery evidence to hand) and the row simply does not render.
   */
  delivery?: ReactNode;
  /**
   * Stages the FUNNEL concluded rather than a person stating. A funnel is ORDERED, so a
   * "never" ends every later step and an outcome reaches every earlier one. These are
   * real answers with no author: they render as the conclusion they are and offer no
   * control, because there is nothing left to state and it would move on its own the
   * moment the statement behind it changed.
   */
  implied?: Partial<Record<LeadStageKey, boolean>>;
  /** What a stated outcome was worth, in cents, for the stages that carry an amount. */
  values?: Partial<Record<LeadStageKey, number | null>>;
  /**
   * What the CUSTOMER said each hand-stated stage cost THEM, in cents. Their own money:
   * it is recorded because they told us, it is never charged, and it belongs nowhere
   * near a credit balance or an invoice.
   *
   * A key PRESENT with `null` is a statement made before the cost was asked for, which
   * reads as unanswered. A key ABSENT means nobody stated the stage by hand at all. The
   * two are kept apart by presence, so a stated zero can never be confused with silence.
   */
  costs?: Partial<Record<LeadStageKey, number | null>>;
  /**
   * The one statement currently in flight, if any. It carries the TARGET state as well
   * as the stage, because the spinner belongs on the button being moved TO — a spinner
   * on the stage alone cannot say which of the two the person pressed.
   */
  pending?: { key: LeadStageKey; next: "outcome" | "never" } | null;
  /** A refusal from the producer, already turned into a sentence by the caller. */
  error?: string | null;
  onSet: (
    key: WritableStageKey,
    next: "outcome" | "never",
    /** What the step cost the author. Always stated: the producer refuses without it. */
    costCents: number,
    valueCents?: number,
  ) => void;
  disabled?: boolean;
}) {
  // The statement being composed, if any. It carries the TARGET state as well as the
  // stage, because both kinds now ask a question and the form has to know which one it
  // is about to record. Local because it is a question this control asked, not a fact
  // about the lead: nothing outside this card needs to know somebody has a field open.
  const [asking, setAsking] = useState<{ key: WritableStageKey; next: "outcome" | "never" } | null>(
    null,
  );

  // A funnel with no stages is the brand-level case: several funnels run at once, so
  // there is no single funnel to walk this lead through. State nothing rather than
  // render an empty card that reads as a stage list we failed to load.
  if (stages.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className={HEADING_CLASS}>Funnel progress</h3>
        <InfoTooltip tip="What happened to this lead at each stage of the funnel this campaign sells. Anything you state here counts exactly like something we tracked automatically." />
      </div>
      <p className="text-xs text-gray-500 mb-3">{funnelName}</p>

      <ul className="divide-y divide-gray-100">
        {delivery != null && (
          <li className="flex items-center justify-between gap-3 py-2 first:pt-0">
            <span className="text-sm text-gray-800 min-w-0 flex items-center gap-1.5">
              <span className="truncate">Delivery</span>
              <InfoTooltip tip={DELIVERY_TIP} />
            </span>
            <span className="flex items-center gap-1.5 shrink-0">{delivery}</span>
          </li>
        )}
        {stages.map((stage, stageIndex) => {
          const state = states[stage.key] ?? "pending";
          // Only the stage being written stays unlocked; every other row waits, because
          // two statements in flight at once is how a panel ends up showing a result
          // nobody stated.
          const busyHere = pending?.key === stage.key;
          const locked = disabled || (pending != null && !busyHere);
          const isTracked = tracked[stage.key] === true;
          const isImplied = implied?.[stage.key] === true;
          // Read by PRESENCE, not by value: an absent key is a stage nobody stated by
          // hand, a `null` one is a statement made before the cost was asked for, and a
          // `0` is a real answer somebody gave. All three read differently.
          const statedCost = costs && stage.key in costs ? costs[stage.key] ?? null : undefined;
          // What ending this step also ends. A funnel is ORDERED, so one click here
          // ends every later step too — the control says so before it is pressed
          // rather than after, which is the difference between a decision and a
          // surprise.
          const alsoEnded = stages.slice(stageIndex + 1).map((s) => s.label);
          const neverTitle =
            alsoEnded.length > 0
              ? `${stage.wontLabel}. Also ends: ${alsoEnded.join(", ")}.`
              : stage.wontLabel;
          // A stage lead-service does not accept a statement on renders as a READING,
          // never as a dead control. Two of the human funnel's stages are like this: a
          // reply is a fact about a message, and a visit is a click the delivery layer
          // measures. Both are still worth showing; neither is ours to state here.
          const writable = isWritableStage(stage.key);
          // The spinner sits on the button the person pressed.
          const spinningOn = (target: LeadStageState) => busyHere && pending?.next === target;
          return (
            <li key={stage.key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="text-sm text-gray-800 min-w-0 flex items-center gap-1.5">
                <span className="truncate">{stage.label}</span>
                {isTracked && <InfoTooltip tip={TRACKED_TIP} />}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                {isImplied ? (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      state === "outcome"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                    title={
                      state === "outcome"
                        ? "Follows from a later step you stated."
                        : "Follows from an earlier step you ended."
                    }
                  >
                    {state === "outcome" ? "Happened" : WONT_LABEL}
                  </span>
                ) : writable && asking?.key === stage.key ? (
                  <StageStatementForm
                    label={stage.label}
                    tone={asking.next}
                    // Only the sale carries an amount, and only when it HAPPENED: the
                    // producer refuses a value on a "never".
                    needsValue={asking.next === "outcome" && stageRequiresValue(stage.key)}
                    busy={busyHere}
                    onSubmit={({ costCents, valueCents }) => {
                      const next = asking.next;
                      setAsking(null);
                      onSet(stage.key as WritableStageKey, next, costCents, valueCents);
                    }}
                    onCancel={() => setAsking(null)}
                  />
                ) : writable ? (
                  <>
                    {state === "outcome" && typeof values?.[stage.key] === "number" && (
                      <span
                        className="text-xs text-gray-500 flex items-center gap-1"
                        data-testid="lead-funnel-stage-value"
                      >
                        {formatValue(values[stage.key] as number)}
                        <InfoTooltip tip={VALUE_TIP} />
                      </span>
                    )}
                    {statedCost !== undefined && (
                      <span
                        className="text-xs text-gray-500 flex items-center gap-1"
                        data-testid="lead-funnel-stage-cost"
                      >
                        {/* A stated zero reads as $0, and a statement made before the
                            cost was asked for says so instead of borrowing that zero. */}
                        {statedCost === null ? "Cost not stated" : `Cost ${formatValue(statedCost)}`}
                        <InfoTooltip tip={COST_TIP} />
                      </span>
                    )}
                    <StageButton
                      active={state === "outcome"}
                      // Already stated? The button reads as the state and stops being a
                      // control. There is no write back to pending, so a click that
                      // could only be a no-op must not look pressable.
                      disabled={locked || state === "outcome"}
                      busy={spinningOn("outcome")}
                      label="Happened"
                      title={`${stage.label}: happened`}
                      tone="outcome"
                      // Every statement has to say what the step cost its author, so the
                      // click opens the question instead of sending a write the producer
                      // would refuse.
                      onClick={() => setAsking({ key: stage.key as WritableStageKey, next: "outcome" })}
                    />
                    <StageButton
                      active={state === "never"}
                      // Refused by lead-service once the stage has happened, and the
                      // honest surface for a refusal we can predict is not offering it.
                      disabled={locked || state === "never" || state === "outcome"}
                      busy={spinningOn("never")}
                      label={WONT_LABEL}
                      title={neverTitle}
                      tone="never"
                      // A step that will not happen still cost what it cost, so this
                      // asks the same question the outcome does.
                      onClick={() => setAsking({ key: stage.key as WritableStageKey, next: "never" })}
                    />
                  </>
                ) : (
                  <span className="text-xs text-gray-400">{isTracked ? "Seen" : "Not seen"}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-xs text-red-600 mt-2" data-testid="lead-funnel-stage-error">
          {error}
        </p>
      )}
    </div>
  );
}
