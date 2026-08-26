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

import { InfoTooltip } from "@/components/visibility/metric-info";
import { ReplyKindControl } from "@/components/leads/reply-kind-control";
import type { ReplyKind } from "@/lib/reply-kind";
import {
  isWritableStage,
  type LeadFunnelStage,
  type LeadStageKey,
  type LeadStageState,
  type WritableStageKey,
} from "@/lib/lead-funnel-stages";

const HEADING_CLASS = "text-xs font-medium text-gray-500 uppercase tracking-wider";

/**
 * Why the terminal statement is worth making, in the words of the person making it.
 * A reader who thinks "Never" is just a tidier way of leaving a stage blank will not
 * use it, and the distinction it creates (dead here vs still on its way) is the whole
 * reason a cost per acquisition means anything before a campaign has finished.
 */
const NEVER_TIP =
  "Marks the lead as done at this stage. It counts as no outcome and moves no number, it just separates the leads that are finished from the ones still on their way.";

const TRACKED_TIP =
  "We already recorded this automatically. You can still state it yourself, which is what to do when the automatic match missed, for example when someone signed up with a different address than the one we emailed.";

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

export function LeadFunnelStageSection({
  funnelName,
  stages,
  states,
  tracked,
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
   * The one statement currently in flight, if any. It carries the TARGET state as well
   * as the stage, because the spinner belongs on the button being moved TO — a spinner
   * on the stage alone cannot say which of the two the person pressed.
   */
  pending?: { key: LeadStageKey; next: "outcome" | "never" } | null;
  /** A refusal from the producer, already turned into a sentence by the caller. */
  error?: string | null;
  onSet: (key: WritableStageKey, next: "outcome" | "never") => void;
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
  // A funnel with no stages is the brand-level case: several funnels run at once, so
  // there is no single chain to walk this lead through. State nothing rather than
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
        {stages.map((stage) => {
          const state = states[stage.key] ?? "pending";
          // Only the stage being written stays unlocked; every other row waits, because
          // two statements in flight at once is how a panel ends up showing a result
          // nobody stated.
          const busyHere = pending?.key === stage.key;
          const locked = disabled || (pending != null && !busyHere);
          const isTracked = tracked[stage.key] === true;
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
                {writable ? (
                  <>
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
                      onClick={() => onSet(stage.key as WritableStageKey, "outcome")}
                    />
                    <StageButton
                      active={state === "never"}
                      // Refused by lead-service once the stage has happened, and the
                      // honest surface for a refusal we can predict is not offering it.
                      disabled={locked || state === "never" || state === "outcome"}
                      busy={spinningOn("never")}
                      label="Never"
                      title={stage.wontLabel}
                      tone="never"
                      onClick={() => onSet(stage.key as WritableStageKey, "never")}
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

      <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
        <span>Never counts as no outcome.</span>
        <InfoTooltip tip={NEVER_TIP} />
      </p>

      {error && (
        <p className="text-xs text-red-600 mt-2" data-testid="lead-funnel-stage-error">
          {error}
        </p>
      )}
    </div>
  );
}
