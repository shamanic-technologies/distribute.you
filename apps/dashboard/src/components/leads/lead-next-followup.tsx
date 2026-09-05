"use client";

import { useState } from "react";
import { canFollowUpNow, followupLine, leadFollowup } from "@/lib/lead-followup";
import type { LeadHistory } from "@/lib/lead-history";
import { useFollowUpNow } from "@/lib/use-lead-followup";

/**
 * What we owe this person next, at the foot of their timeline.
 *
 * The timeline says what already happened; this says what is about to. Without it a
 * reader who has just seen a prospect answer has no way to tell whether the reply is
 * being handled in an hour or in nine days, and no way to bring it forward.
 *
 * CAMPAIGN-scoped by construction — only the two campaign-scoped timelines mount it. The
 * debt belongs to the (person, campaign) pair, so on the brand-wide roll-up there would be
 * several due dates behind one sentence and the button would not know which one it moves.
 */
export function LeadNextFollowup({
  history,
  leadRowId,
}: {
  history: LeadHistory;
  /** The `leads_campaigns` row this timeline is about — what the write is keyed on. */
  leadRowId: string;
}) {
  const followup = leadFollowup(history);
  const { mutate, isPending, isError, error } = useFollowUpNow(leadRowId);
  // What the person just asked for, held locally over the round trip. Both calls take a
  // moment (the write, then the re-read of the history it invalidates), and for both of
  // them the line renders exactly as it did before the press — which reads as a dead
  // button. Dropped as soon as the producer answers, so nothing here can outlive a
  // refusal.
  const [asked, setAsked] = useState(false);

  const line = asked && !isError ? "Next follow-up due now" : followupLine(followup);

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
      <div className="min-w-0">
        <p className="truncate text-xs text-gray-500">{line}</p>
        {/* WHY the sequence ended, in the producer's own words. A bare "no further
            follow-ups" reads as something broken; "they booked a meeting" does not. */}
        {followup.state === "stopped" && followup.reason && (
          <p className="truncate text-[11px] text-gray-400">{followup.reason}</p>
        )}
        {isError && (
          <p className="text-[11px] text-red-600">{error?.message ?? "Could not move it."}</p>
        )}
      </div>
      {/* Never offered on a stopped schedule: it ended because the prospect booked, opted
          out, or answered, so a control offering to write to them anyway offers the one
          thing that state exists to prevent. Absent rather than present-and-refusing. */}
      {canFollowUpNow(followup) && (
        <button
          type="button"
          onClick={() => {
            setAsked(true);
            mutate(undefined, { onError: () => setAsked(false) });
          }}
          disabled={isPending}
          className={`shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 ${
            isPending ? "cursor-wait" : "hover:bg-gray-50 disabled:opacity-40"
          }`}
        >
          {isPending ? "Moving..." : "Follow up now"}
        </button>
      )}
    </div>
  );
}
