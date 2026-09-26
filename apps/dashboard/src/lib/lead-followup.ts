import { timeUntil } from "./friendly-datetime";
import type { LeadHistory } from "./lead-history";

/**
 * What we owe this person NEXT, read off the history lead-service already assembles.
 *
 * The follow-up debt is a property of the (person, campaign) pair: once a prospect shows
 * a positive reply we owe them an answer now, and then, if they go quiet, further answers
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

/**
 * WHO WILL ANSWER a scheduled follow-up, as lead-service reports campaign-service's word.
 *
 * A due date alone promises nothing: the debt is claimed only by a live campaign on the
 * continuing leg, and five prospects once waited up to twenty days under "Next follow-up
 * due now" with nobody able to claim them. Three answers, never collapsed:
 * `answered` (a campaign will), `unanswered` (nobody will, `absence` says why) and
 * `unknown` (we could not check). This module decides NONE of it; it reads the field.
 */
export interface FollowupAnswerer {
  state: "answered" | "unanswered" | "unknown";
  answeredByFeatureSlug: string | null;
  absence: string | null;
  startableFeatureSlugs: string[];
}

export type LeadFollowup =
  /**
   * A date is on record. `answerer` is null only on a payload older than the field,
   * which reads exactly as it did before it existed.
   */
  | { state: "scheduled"; dueAt: string; followupCount: number; answerer: FollowupAnswerer | null }
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
      answerer: readAnswerer(scheduled.answerer),
    };
  }
  return { state: "not_set" };
}

function readAnswerer(raw: unknown): FollowupAnswerer | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as {
    state?: unknown;
    answeredBy?: { featureSlug?: unknown } | null;
    absence?: unknown;
    startableFeatureSlugs?: unknown;
  };
  // An answer we do not recognise is one we cannot vouch for, so it reads as unknown:
  // never "due now" and never "nobody".
  const state =
    a.state === "answered" || a.state === "unanswered" || a.state === "unknown"
      ? a.state
      : "unknown";
  return {
    state,
    answeredByFeatureSlug:
      typeof a.answeredBy?.featureSlug === "string" ? a.answeredBy.featureSlug : null,
    absence: typeof a.absence === "string" ? a.absence : null,
    startableFeatureSlugs: Array.isArray(a.startableFeatureSlugs)
      ? a.startableFeatureSlugs.filter((x): x is string => typeof x === "string")
      : [],
  };
}

/**
 * Why nobody will answer, in the customer's words. Keyed on campaign-service's own
 * `absence` token, verbatim; a token we do not know yet still says nobody will answer
 * rather than printing the code.
 */
const ABSENCE_REASON: Record<string, string> = {
  no_answering_campaign: "No campaign on this offer answers interested replies yet.",
  answering_campaign_stopped: "The campaign that answers interested replies on this offer is paused.",
  answering_campaign_serves_another:
    "The campaign that answers interested replies here is set up for another campaign's leads.",
  no_leg_continues: "No step comes after this one, so no campaign picks them up.",
  campaign_states_no_leg:
    "This campaign does not state its step, so we cannot match a campaign to answer them.",
  campaign_states_no_offer:
    "This campaign does not state its offer, so we cannot match a campaign to answer them.",
  campaign_states_no_brand:
    "This campaign does not state its brand, so we cannot match a campaign to answer them.",
};

/** The absences a customer fixes by starting (or restarting) the answering channel. */
const STARTABLE_ABSENCES = new Set(["no_answering_campaign", "answering_campaign_stopped"]);

export type FollowupFix =
  /** Start the answering channel on this offer (`featureSlug` is what can answer). */
  | { kind: "start"; featureSlug: string | null }
  /** Turn the paused answering campaign back on. */
  | { kind: "restart" };

export interface FollowupNotice {
  /** The line itself. */
  line: string;
  /** One sentence under it saying why, or null. */
  detail: string | null;
  /** Whether the line is a warning (nobody will answer / we could not check). */
  tone: "neutral" | "warning";
  /** What the customer can do about it, or null. */
  fix: FollowupFix | null;
}

/**
 * Everything the foot of the timeline states about the next follow-up.
 *
 * Only an ANSWERED follow-up (or one on a payload older than the answerer field) states
 * a due date: that is the one case where the date is a promise somebody will keep.
 */
export function followupNotice(followup: LeadFollowup, now: Date = new Date()): FollowupNotice {
  if (followup.state !== "scheduled" || !followup.answerer || followup.answerer.state === "answered") {
    return { line: followupLine(followup, now), detail: null, tone: "neutral", fix: null };
  }
  const a = followup.answerer;
  if (a.state === "unknown") {
    return {
      line: "We could not check who will answer this person",
      detail: "Try again in a moment.",
      tone: "warning",
      fix: null,
    };
  }
  const absence = a.absence ?? "";
  let fix: FollowupFix | null = null;
  if (absence === "answering_campaign_stopped") fix = { kind: "restart" };
  else if (STARTABLE_ABSENCES.has(absence))
    fix = { kind: "start", featureSlug: a.startableFeatureSlugs[0] ?? null };
  return {
    line: "Nobody will answer this person",
    detail: ABSENCE_REASON[absence] ?? null,
    tone: "warning",
    fix,
  };
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
  if (followup.state === "stopped") return false;
  // Bringing it forward promises an answer sooner. When nobody will answer, or we could
  // not check, there is no answer to bring forward.
  if (followup.state === "scheduled" && followup.answerer && followup.answerer.state !== "answered") {
    return false;
  }
  return true;
}
