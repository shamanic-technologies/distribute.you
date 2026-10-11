/**
 * The one line that says WHY a person sits in "Needs your call" (owner 2026-10-11):
 * what they sent us and how long it has waited, off lead-service's served
 * `lastMessage.kind` and `waitingSince`. Pure formatting of two served fields.
 */
export type AwaitingKind = "question" | "interest" | "other";

const WHAT: Record<AwaitingKind, string> = {
  question: "Asked a question",
  interest: "Replied with interest",
  other: "Wrote back",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function waitedFor(since: string, now: number): string {
  const ms = now - Date.parse(since);
  if (Number.isNaN(ms) || ms < HOUR) return "under an hour";
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const d = Math.floor(ms / DAY);
  return `${d} ${d === 1 ? "day" : "days"}`;
}

export function awaitingReason(kind: AwaitingKind, waitingSince: string, now: number = Date.now()): string {
  return `${WHAT[kind]}, unanswered for ${waitedFor(waitingSince, now)}`;
}
