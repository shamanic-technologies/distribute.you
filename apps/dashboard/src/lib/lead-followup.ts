import { timeUntil } from "./friendly-datetime";
import type { LeadHistory } from "./lead-history";

/**
 * What we owe this person NEXT, read off the history lead-service already assembles.
 *
 * The follow-up debt is a property of the (person, campaign) pair: once a prospect shows
 * a sales interest we owe them an answer now, and then, if they go quiet, further answers
 * at widening intervals until they book, opt out, or answer again. lead-service owns that
 * schedule and reports it inside the lead's history as a `followup` event carrying its
 * state, its due date and how many follow-ups have already gone out.
 *
 * This module DERIVES NOTHING about the schedule. It does not infer a due date from a
 * reply, does not decide that a sequence has stopped, and does not compute the next
 * interval — those are the producer's, and the browser guessing at them is what once
 * promised two more follow-ups to a prospect who had already answered. It reads the
 * event and puts it into the three shapes a reader can act on.
 *
 * ALIAS-FREE on purpose (a relative import and a type-only one, both erased or trivially
 * resolvable) so it carries REAL unit tests rather than a source-substring guard. Keep it
 * that way.
 */

export type LeadFollowup =
  /** A date is on record and the person will be answered then. */
  | { state: "scheduled"; dueAt: string; followupCount: number }
  /** The schedule was ended, and why. Nothing further goes out. */
  | { state: "stopped"; reason: string | null }
  /** Nothing is owed and nothing was stopped — most often nobody has replied yet. */
  | { state: "not_set" };

/**
 * Read the schedule out of a lead's history.
 *
 * A STOPPED schedule outranks a scheduled one. The producer already nulls the due date
 * when it stops a sequence, so the two cannot both be live — but a reader that took
 * whichever event came first would be deciding precedence for itself, and the honest
 * answer when both appear is the one that says nothing further will be sent.
 */
export function leadFollowup(history: LeadHistory | null | undefined): LeadFollowup {
  const events = (history?.events ?? []).filter((e) => e.type === "followup");
  const stopped = events.find((e) => e.state === "stopped");
  if (stopped) return { state: "stopped", reason: stopped.stoppedReason ?? null };

  const scheduled = events.find((e) => e.state === "scheduled" && typeof e.dueAt === "string");
  if (scheduled?.dueAt) {
    return {
      state: "scheduled",
      dueAt: scheduled.dueAt,
      followupCount: scheduled.followupCount ?? 0,
    };
  }
  return { state: "not_set" };
}

/**
 * The one line a reader gets at the foot of the timeline.
 *
 * A due date already in the past reads `due now` rather than a negative count: it means
 * the person is waiting in the queue to be answered, which is a true and actionable
 * statement, where "0 days" would read as a rounding error.
 */
export function followupLine(followup: LeadFollowup, now: Date = new Date()): string {
  switch (followup.state) {
    case "scheduled": {
      const until = timeUntil(followup.dueAt, now);
      return until === "now" ? "Next follow-up due now" : `Next follow-up ${until}`;
    }
    case "stopped":
      return "No further follow-ups";
    case "not_set":
      return "Next follow-up: not set";
  }
}

/**
 * Whether "Follow up now" may be offered.
 *
 * Never on a STOPPED schedule. A sequence stops because the prospect booked, opted out,
 * or answered — so a control offering to write to them anyway is offering to do the one
 * thing that state exists to prevent. The reason is on screen beside it; the button is
 * simply absent rather than present and refusing.
 */
export function canFollowUpNow(followup: LeadFollowup): boolean {
  return followup.state !== "stopped";
}
