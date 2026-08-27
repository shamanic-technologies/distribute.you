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
 */

import { useState, type ReactNode } from "react";

import { InfoTooltip } from "@/components/visibility/metric-info";
import { ReplyKindControl } from "@/components/leads/reply-kind-control";
import type { ReplyKind } from "@/lib/reply-kind";
import {
  isWritableStage,
  saleValueCentsFrom,
  stepCostCentsFrom,
  stageRequiresValue,
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
 * What a step cost, asked for at the moment it is stated.
 *
 * lead-service refuses a statement with no cost, so every transition opens this — the
 * legs the platform does not automate are worked by the customer's own team, and they
 * are the only one who knows what that leg cost them. ZERO is a legitimate answer and
 * absent is a refusal, so the field starts empty and the button stays disabled until
 * they answer: defaulting it to zero would be this app answering for them.
 *
 * A step the producer prices asks for the amount too, on the same form, because a won
 * deal is refused without one. There is deliberately no way past either question: a
 * control that submitted anyway would put a customer in front of a refusal it could
 * have avoided asking about.
 */
function StageStatementForm({
  label,
  askValue,
  busy,
  onSubmit,
  onCancel,
}: {
  label: string;
  /** True when this step is priced and the statement is an outcome: ask what it was worth. */
  askValue: boolean;
  busy: boolean;
  onSubmit: (input: { costCents: number; valueCents?: number }) => void;
  onCancel: () => void;
}) {
  const [rawCost, setRawCost] = useState("");
  const [rawValue, setRawValue] = useState("");
  const costCents = stepCostCentsFrom(rawCost);
  const valueCents = saleValueCentsFrom(rawValue);
  const ready = costCents != null && (!askValue || valueCents != null);
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (costCents == null) return;
        if (askValue && valueCents == null) return;
        onSubmit(askValue ? { costCents, valueCents: valueCents as number } : { costCents });
      }}
    >
      <span className="text-xs text-gray-500">Cost $</span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={rawCost}
        onChange={(e) => setRawCost(e.target.value)}
        placeholder="0"
        aria-label={`${label}: what this step cost you, in dollars`}
        data-testid="lead-funnel-stage-cost-input"
        className="w-20 px-2 py-1 text-xs rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-300"
      />
      {askValue && (
        <>
          <span className="text-xs text-gray-500">Worth $</span>
          <input
            type="text"
            inputMode="decimal"
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            placeholder="4,900"
            aria-label={`${label}: what the deal was worth, in dollars`}
            data-testid="lead-funnel-stage-value-input"
            className="w-24 px-2 py-1 text-xs rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-green-300"
          />
        </>
      )}
      <button
        type="submit"
        disabled={!ready || busy}
        title={`${label}: record it`}
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
  pending,
  error,
  onSet,
  reply,
  disabled = false,
}: {
  /** The campaign's funnel, named so the reader knows which chain these stages are. */
  funnelName: string;
  stages: LeadFunnelStage[];
  /** What has been stated per stage. A stage absent from the map is pending. */
  states: Partial<Record<LeadStageKey, LeadStageState>>;
  /** Stages we ALSO measured automatically, so the row can say so. */
  tracked: Partial<Record<LeadStageKey, boolean>>;
  /**
   * Where our own sending got to, as the caller already renders it elsewhere. Read
   * only: it is measured, so there is nothing for a person to state, and it sits ABOVE
   * the chain because every funnel starts after the email arrives. Absent (a scope
   * with no delivery evidence to hand) and the row simply does not render.
   */
  delivery?: ReactNode;
  /**
   * Stages the CHAIN concluded rather than a person stating. A funnel is a chain, so a
   * "never" ends every later step and an outcome reaches every earlier one. These are
   * real answers with no author: they render as the conclusion they are and offer no
   * control, because there is nothing left to state and it would move on its own the
   * moment the statement behind it changed.
   */
  implied?: Partial<Record<LeadStageKey, boolean>>;
  /** What a stated outcome was worth, in cents, for the stages that carry an amount. */
  values?: Partial<Record<LeadStageKey, number | null>>;
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
    input: { costCents: number; valueCents?: number },
  ) => void;
  /**
   * The reply row's own control, when the funnel has one. A reply is not a yes/no —
   * nine kinds in four groups — so it gets a picker rather than the two buttons every
   * other row carries. Absent (an ads-led funnel, say) and the row reads as before.
   */
  reply?: {
    kind: string | null;
    pending: boolean;
    onSet: (kind: ReplyKind) => void;
  } | null;
  disabled?: boolean;
}) {
  // The stage whose amount is being asked for. Local because it is a question this
  // control asked, not a fact about the lead — nothing outside this card needs to know
  // that somebody has a field open.
  // Which stage is being answered, and which statement it is. Every transition asks,
  // because the producer refuses one with no cost; the statement is carried so the
  // form knows whether to ask what the deal was worth too.
  const [asking, setAsking] = useState<{
    key: WritableStageKey;
    next: "outcome" | "never";
  } | null>(null);

  // A funnel with no stages is the brand-level case: several funnels run at once, so
  // there is no single chain to walk this lead through. State nothing rather than
  // render an empty card that reads as a stage list we failed to load.
  if (stages.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className={`${HEADING_CLASS} mb-1`}>Funnel progress</h3>
      <p className="text-xs text-gray-500 mb-3">{funnelName}</p>

      <ul className="divide-y divide-gray-100">
        {delivery != null && (
          <li className="flex items-center justify-between gap-3 py-2 first:pt-0">
            <span className="text-sm text-gray-800 min-w-0 truncate">Delivery</span>
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
          // What ending this step also ends. A funnel is a chain, so one click here
          // ends every later step too — the control says so before it is pressed
          // rather than after, which is the difference between a decision and a
          // surprise.
          const alsoEnded = stages.slice(stageIndex + 1).map((s) => s.label);
          const neverTitle =
            alsoEnded.length > 0
              ? `${stage.wontLabel}. Also ends: ${alsoEnded.join(", ")}.`
              : stage.wontLabel;
          // A stage lead-service does not accept a statement on renders as a READING,
          // never as a dead control. Two of the human chain's stages are like this: a
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
                    // A priced step asks what the deal was worth, but only when it
                    // HAPPENED — a step that never will has nothing to be worth.
                    askValue={asking.next === "outcome" && stageRequiresValue(stage.key)}
                    busy={busyHere}
                    onSubmit={(input) => {
                      const next = asking.next;
                      setAsking(null);
                      onSet(stage.key as WritableStageKey, next, input);
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
                      // Every statement is refused without a cost, so the click opens the
                      // question instead of sending a refusal. A priced step is asked what
                      // it was worth on the same form.
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
                      // A step that will never happen still cost something to find that
                      // out, so it is asked for too.
                      onClick={() => setAsking({ key: stage.key as WritableStageKey, next: "never" })}
                    />
                  </>
                ) : stage.key === "positive_reply" && reply ? (
                  <ReplyKindControl
                    kind={reply.kind}
                    tracked={isTracked}
                    pending={reply.pending}
                    disabled={disabled}
                    onSet={reply.onSet}
                  />
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
