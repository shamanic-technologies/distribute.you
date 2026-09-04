"use client";

import { EmailSignature } from "@/components/email-signature";
import { MaturityBadge } from "@/components/maturity-badge";
import { friendlyDate, friendlyDateTime } from "@/lib/friendly-datetime";
import {
  hasReadableBody,
  incompleteNote,
  type LeadHistory,
  type LeadHistoryEvent,
} from "@/lib/lead-history";

/**
 * A person's history, rendered exactly as lead-service ordered it.
 *
 * The panel used to assemble this in the browser out of six services and decide, per
 * row, what outranked what. It does not any more: this component walks `events` in the
 * order it received them and draws each one. It sorts nothing, de-duplicates nothing,
 * hides nothing on a rule of its own. Every timeline bug of that week — a reply whose
 * words we held showing as a bare "they replied", follow-ups promised after the
 * sequence had stopped, an exchange in the owner's mailbox invisible — came from this
 * app deciding those things for itself.
 *
 * The one judgement left here is WORDING, which is a rendering concern: what to call a
 * row and how to colour it.
 */
export function LeadHistoryTimeline({
  history,
  heading = "Activity",
  bare = false,
  canReadDraftCopy,
}: {
  history: LeadHistory;
  heading?: string;
  /** Rendered INSIDE a campaign card, so it drops the card chrome. */
  bare?: boolean;
  /**
   * Whether the copy we GENERATED but have not sent may be read.
   *
   * A real message — ours as it went out, or the prospect's own words — is always
   * readable: it is the customer's conversation. An unsent draft is our writing and
   * stays behind the beta gate.
   */
  canReadDraftCopy: boolean;
}) {
  const note = incompleteNote(history);
  const events = history.events;
  if (events.length === 0 && !note) return null;

  const nowMs = Date.now();

  return (
    <div
      className={
        bare
          ? "mt-3 border-t border-gray-200 pt-3"
          : "bg-white rounded-lg border border-gray-200 p-4 mb-4"
      }
    >
      <h3
        className={
          bare
            ? "mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400"
            : "text-xs font-medium text-gray-500 uppercase tracking-wider mb-3"
        }
      >
        {heading}
      </h3>
      {/* What could not be read, named. A history that silently drops a source tells a
          customer their prospect said nothing. */}
      {note && (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
          {note}
        </p>
      )}
      <ol className="relative">
        {events.map((e, i) => {
          const shape = eventShape(e);
          if (!shape) return null;
          const isFuture = e.at != null && new Date(e.at).getTime() > nowMs;
          const prev = i > 0 ? events[i - 1] : null;
          return (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* The rail, and the gap since the previous dated row. */}
              <div className="flex w-14 shrink-0 justify-end pt-0.5">
                <span className="text-[11px] text-gray-400">
                  {prev ? gapLabel(prev.at, e.at) : ""}
                </span>
              </div>
              <div className="relative flex flex-col items-center">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${shape.dot}`} />
                {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-gray-200" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {shape.label}
                  {/* An ASSERTED fact says so. A reply somebody wrote down because it
                      never reached us is not a reply we can produce, and reading the
                      same is what made a recorded note look like an email. */}
                  {e.evidence === "asserted" && (
                    <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-gray-400">
                      recorded by hand
                    </span>
                  )}
                  {isFuture && (
                    <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-gray-400">
                      scheduled
                    </span>
                  )}
                </p>
                {e.at && (
                  <p className="text-xs text-gray-500" title={new Date(e.at).toLocaleString()}>
                    {isFuture ? friendlyDate(e.at) : friendlyDateTime(e.at)}
                  </p>
                )}
                {shape.who && <p className="text-xs text-gray-500">{shape.who}</p>}
                {shape.detail && <p className="mt-1 text-xs text-gray-600">{shape.detail}</p>}
                {/* THE WORDS. A real message is shown open — reading them is the whole
                    reason to open this panel — while an unsent draft stays folded and
                    behind the gate. */}
                {hasReadableBody(e) && (e.type !== "generated_email" || canReadDraftCopy) && (
                  <div
                    className={`mt-1.5 rounded border p-2 ${
                      e.direction === "inbound"
                        ? "border-violet-200 bg-violet-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    {e.subject && (
                      <p className="mb-1 text-xs font-medium text-gray-700">{e.subject}</p>
                    )}
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs text-gray-600">
                      {e.bodyText}
                    </pre>
                    {/* The signature is appended AT SEND TIME, so it belongs under copy
                        that has not been sent — never under a message read back off the
                        thread, which already carries the one it really went out with. */}
                    {e.type === "generated_email" && <EmailSignature className="text-xs" />}
                  </div>
                )}
                {e.type === "generated_email" && hasReadableBody(e) && !canReadDraftCopy && (
                  <span className="mt-1.5 inline-flex">
                    <MaturityBadge level="beta" />
                  </span>
                )}
                {/* We hold this message and could not read it. Said out loud, because an
                    empty card reads as a prospect who wrote nothing. */}
                {e.bodyStatus === "unavailable" && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    We hold this message and could not read it.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** How one row reads. `null` drops a row this build has no words for. */
function eventShape(
  e: LeadHistoryEvent,
): { label: string; dot: string; who?: string; detail?: string } | null {
  switch (e.type) {
    case "message":
      return {
        label: e.direction === "inbound" ? "Their reply" : "Email sent",
        dot: e.direction === "inbound" ? "bg-violet-500" : "bg-brand-500",
        who: e.direction === "inbound" ? e.from ?? undefined : (e.to ?? [])[0],
      };
    case "generated_email":
      return { label: "Email we wrote", dot: "bg-brand-400" };
    case "delivery":
      return { label: deliveryLabel(e.milestone), dot: deliveryDot(e.milestone) };
    case "lifecycle":
      return {
        label:
          e.milestone === "handed_to_sending"
            ? "Queued for sending"
            : e.milestone === "served"
              ? "Added to the campaign"
              : "Lifecycle",
        dot: "bg-slate-400",
      };
    case "reply_statement":
      return {
        label: "Reply recorded",
        dot: "bg-violet-400",
        detail: e.note ?? undefined,
        who: e.statedBy ?? undefined,
      };
    case "opt_out_statement":
      return {
        label: "Asked us to stop",
        dot: "bg-amber-500",
        detail: e.note ?? undefined,
      };
    case "step_statement":
      return {
        label:
          e.kind === "never"
            ? `Will never reach ${e.step ?? "this step"}`
            : `Reached ${e.step ?? "a step"}`,
        dot: e.kind === "never" ? "bg-gray-400" : "bg-green-500",
        detail: e.note ?? undefined,
        who: e.statedBy ?? undefined,
      };
    case "conversion":
      return { label: e.event ? `Converted: ${e.event}` : "Converted", dot: "bg-green-500" };
    case "followup":
      // A STOPPED schedule never advertises a next follow-up — the producer nulls
      // `dueAt` for exactly that, and promising one after a reply is the bug this
      // whole read replaced.
      return e.state === "stopped"
        ? {
            label: "No further follow-ups",
            dot: "bg-gray-400",
            detail: e.stoppedReason ?? undefined,
          }
        : { label: "Follow-up due", dot: "bg-gray-300" };
    default:
      // A type this build does not know renders NOTHING rather than a guess at the
      // nearest one it does. lead-service owns the vocabulary and widens it.
      return null;
  }
}

function deliveryLabel(milestone: string | undefined): string {
  switch (milestone) {
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "opened":
      return "Opened";
    case "clicked":
      return "Website visit";
    case "replied":
      return "Replied";
    case "bounced":
      return "Bounced";
    case "unsubscribed":
      return "Unsubscribed";
    default:
      return "Delivery";
  }
}

function deliveryDot(milestone: string | undefined): string {
  switch (milestone) {
    case "clicked":
      return "bg-violet-500";
    case "replied":
      return "bg-violet-500";
    case "bounced":
      return "bg-red-500";
    case "unsubscribed":
      return "bg-amber-500";
    default:
      return "bg-blue-400";
  }
}

/** The gap since the previous row, which is the only place cadence is stated. */
function gapLabel(from: string | null, to: string | null): string {
  if (!from || !to) return "";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `+${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `+${hours}h`;
  return `+${Math.round(hours / 24)}d`;
}
