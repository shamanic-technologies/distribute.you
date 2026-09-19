/**
 * A paced mailing-list release, as this console reads it.
 *
 * transactional-email-service owns every figure here. Nothing in this module
 * derives a statistic: it turns the served status into the word and the tone a
 * reader sees, turns a refusal's STATUS CODE into a sentence, and computes one
 * bar length from two served counts. That bar is a picture of a ratio the
 * service already states, the same affordance the learning bar is — it is not a
 * metric, and no number on the screen comes from it.
 *
 * Deliberately alias-free (its only import is a type, erased at build) so it
 * carries real unit tests rather than source-substring guards. Keep it that
 * way: a runtime `@/…` import here turns those tests into resolution failures.
 */

/** The five states a release can be in, as the service states them. */
export type ReleaseStatus = "running" | "paused" | "cancelled" | "halted" | "completed";

export interface MailingListRelease {
  releaseId: string;
  slug: string;
  subject: string;
  from: string;
  bodyKind: "markdown" | "html";
  status: ReleaseStatus;
  /** Why a halted release stopped, in the words the staff alert repeated. */
  haltedReason: string | null;
  dailyLimit: number;
  recipientCount: number;
  reached: number;
  remaining: number;
  failed: number;
  skippedOptedOut: number;
  inFlight: number;
  todayAllowance: number;
  todayUsed: number;
  estimatedDaysRemaining: number;
  nextSliceSize: number;
  createdAt: string;
  completedAt: string | null;
}

/**
 * The word a reader sees. "Halted" is deliberately not "Stopped": a person
 * stopping a release and a release stopping ITSELF on bad delivery outcomes are
 * different events, and only one of them is a verdict about the sending.
 */
export const RELEASE_STATUS_LABEL: Record<ReleaseStatus, string> = {
  running: "Sending",
  paused: "Paused",
  cancelled: "Cancelled",
  halted: "Stopped itself",
  completed: "Done",
};

/**
 * One line saying what the state MEANS, because four of these five words are
 * not self-explanatory on a surface somebody opens once a quarter.
 */
export const RELEASE_STATUS_BLURB: Record<ReleaseStatus, string> = {
  running: "Going out at the pace below.",
  paused: "You stopped it. It resumes exactly where it left off.",
  cancelled: "Ended for good. Everyone still waiting was accounted for.",
  halted: "It stopped on its own because delivery outcomes went bad. It does not resume.",
  completed: "Every address is accounted for.",
};

/**
 * Tints, all of them checked against admin's own `html.dark` remaps rather than
 * assumed. Green carries the two weights this commit adds; red, amber and gray
 * were already remapped. A colour whose text weight is unremapped renders
 * near-black on the dark surface, which is invisible in the default light theme
 * and therefore ships unnoticed.
 */
export const RELEASE_STATUS_TONE: Record<ReleaseStatus, string> = {
  running: "bg-green-50 text-green-700 border-green-200",
  paused: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  halted: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-green-50 text-green-700 border-green-200",
};

/** A release nobody can act on any more. */
export function isTerminal(status: ReleaseStatus): boolean {
  return status === "cancelled" || status === "halted" || status === "completed";
}

/**
 * Which controls a status permits.
 *
 * A halted release is deliberately NOT resumable: it stopped because the
 * provider's outcomes for it went bad, and offering "resume" would invite
 * somebody to un-make that decision with one click. Sending the same update
 * again is a new release, which is a decision rather than an undo.
 */
export interface ReleaseControls {
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canRepace: boolean;
}

export function releaseControls(status: ReleaseStatus): ReleaseControls {
  return {
    canPause: status === "running",
    canResume: status === "paused",
    canCancel: status === "running" || status === "paused",
    canRepace: status === "running" || status === "paused",
  };
}

/**
 * How far along the bar is drawn, 0..100.
 *
 * `reached` and `recipientCount` are both served. A release covering nobody
 * returns 0 rather than dividing by zero, and the result is clamped because a
 * bar that overruns its track reads as a rendering fault rather than as
 * progress.
 */
export function releaseProgressPct(release: Pick<MailingListRelease, "reached" | "recipientCount">): number {
  if (!Number.isFinite(release.recipientCount) || release.recipientCount <= 0) return 0;
  const pct = (release.reached / release.recipientCount) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

/**
 * How much of today's allowance is spent, 0..100.
 *
 * Distinct from the overall progress: a release can be 3% through its list and
 * 100% through today, which is the normal resting state of a paced send and the
 * thing a reader most often wants to know ("is it stuck, or is it just done for
 * today?").
 */
export function todayUsedPct(release: Pick<MailingListRelease, "todayUsed" | "todayAllowance">): number {
  if (!Number.isFinite(release.todayAllowance) || release.todayAllowance <= 0) return 0;
  const pct = (release.todayUsed / release.todayAllowance) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

/**
 * What a release is doing right now, in one sentence, for the line under the
 * bar. A running release that has spent today's allowance is RESTING, not
 * stuck — saying so is the whole reason this exists.
 */
export function releaseActivityLine(release: MailingListRelease): string {
  if (release.status !== "running") return RELEASE_STATUS_BLURB[release.status];
  if (release.inFlight > 0) {
    return `Sending now: ${release.inFlight.toLocaleString("en-US")} in flight.`;
  }
  if (release.todayAllowance > 0 && release.todayUsed >= release.todayAllowance) {
    return "Today's allowance is spent. It rests until tomorrow.";
  }
  return RELEASE_STATUS_BLURB.running;
}

/**
 * A refusal, turned into a sentence from its STATUS CODE.
 *
 * Never `err.message`: the api client sets that to the whole downstream body
 * verbatim, which is how a JSON blob reaches a reader. A 400 and a 409 both
 * carry a real reason the service wrote for a person, so those are passed
 * through when one is supplied and fall back to a generic line when it is not.
 */
export function releaseWriteErrorMessage(
  status: number | null,
  servedReason?: string | null
): string {
  const reason = typeof servedReason === "string" && servedReason.trim() ? servedReason.trim() : null;
  if (status === 400 || status === 409) {
    return reason ?? "That change was refused. The release may already have finished or stopped.";
  }
  if (status === 403) return "You are not allowed to change this release.";
  if (status === 404) return "That release no longer exists.";
  if (status === 502) return "The mail service could not be reached. Nothing changed; try again.";
  return "Could not apply that change. Nothing was sent in the meantime.";
}

/**
 * What is wrong with a typed pace, or null when nothing is.
 *
 * Shape only. The service holds the real ceiling — the most its own worker can
 * deliver in a day — and its refusal is what decides. Checking here exists so
 * typing is pleasant, never so this console can claim to know the rule.
 */
export function paceProblemShape(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "State a daily pace.";
  if (!/^\d+$/.test(trimmed)) return "A daily pace is a whole number of messages.";
  const n = Number(trimmed);
  if (n < 1) return "A daily pace is at least 1.";
  return null;
}

/**
 * How long a release has left, in the words a reader thinks in.
 *
 * The service states `estimatedDaysRemaining`; this only picks the phrasing. A
 * terminal release has nothing left, so it says nothing rather than "0 days".
 */
export function estimatedRemainingLabel(release: MailingListRelease): string | null {
  if (isTerminal(release.status)) return null;
  const days = release.estimatedDaysRemaining;
  if (!Number.isFinite(days) || days <= 0) return null;
  if (days === 1) return "about a day left";
  return `about ${Math.round(days)} days left`;
}
