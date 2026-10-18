import { timeUntil } from "./friendly-datetime";

/**
 * Why a campaign that reads `ongoing` is not running right now, in the customer's words.
 *
 * A campaign can be live, correctly funded, and deliberately suspended by the backend for
 * hours. Until this existed the dashboard said only "ongoing", so "you spent today's
 * budget", "you never funded this", "you are out of credit" and "something broke on our
 * side" all looked identical on screen and the only way to tell them apart was to query a
 * database. The first two are one click to fix, the third is a payment, and the fourth is
 * ours.
 *
 * NOTHING HERE IS DERIVED. campaign-service decides the hold and states it
 * (`campaign-hold`, v0.72.6) with a machine-readable `reason`; the credit refusal is
 * decided deeper, inside the run, and states itself on `gate-check-result`
 * (`creditCheck: "unaffordable"`). This module reads those two and picks the newer one.
 * Re-deciding "is it held" here from budget numbers and a status column would be a second
 * opinion over the producer's, and the two would disagree the day either side moved.
 *
 * Alias-free (only a relative sibling import), so it carries REAL unit tests rather than
 * a source-substring guard. Keep it that way.
 */

/** The reasons campaign-service states on `campaign-hold`, plus the credit refusal. */
export type CampaignHoldReason =
  | "daily_ceiling_reached"
  | "unfunded"
  | "budgets_unreadable"
  | "planning_failed"
  | "insufficient_credits";

/**
 * The two event slugs a hold can arrive on, for the `event` filter of `GET /v1/events`.
 *
 * Comma-separated because that is what the gateway forwards; asking for both in one read
 * is what lets the newer of the two win without a second request.
 */
export const CAMPAIGN_HOLD_EVENTS = "campaign-hold,gate-check-result";

/**
 * How long a hold stays CURRENT, measured against how often its producer re-emits it.
 *
 * There is no "cleared" event: a campaign that starts running simply stops producing
 * holds. So freshness IS the rule, and the window is two missed re-emissions — one missed
 * cycle can be a slow tick, two means the campaign is running again. Measured against
 * production on 2026-09-17: `campaign-hold` re-emits every 10 minutes (and states the
 * same interval itself on `nextRunAt`), the credit refusal every 30.
 *
 * This is also what satisfies "a stale hold does not lie": a campaign that has since
 * produced runs stops emitting, so its last hold ages out on its own.
 */
export const HOLD_RECHECK_MS = 10 * 60_000;
export const CREDIT_RECHECK_MS = 30 * 60_000;
const MISSED_CYCLES_BEFORE_STALE = 2;

/** The shape this reads off `GET /v1/events`. Only the fields a hold needs. */
export interface HoldEventInput {
  event: string;
  detail?: string | null;
  data?: unknown;
  createdAt: string;
}

export interface CampaignHold {
  reason: CampaignHoldReason;
  /** When the producer wrote it. */
  at: string;
  /**
   * When the campaign starts again ON ITS OWN, ISO, or null when it cannot.
   *
   * Only a problem on OUR side carries one: it clears when we fix it, and `nextRunAt` is
   * our next try. A campaign nobody funded and one with no credit clear only when somebody
   * pays, so `nextRunAt` there is the moment we look again and hold again: promising it as
   * a restart would be a sentence that is simply false.
   *
   * A reached limit promises no time either (2026-10-18). Its reason is still spelled
   * `daily_ceiling_reached`, but campaign-service now emits it for a sales funnel's max
   * budget OR max volume, of ANY period (daily, weekly, monthly): "the next UTC midnight"
   * was a false restart for every weekly, monthly and volume cap.
   */
  resumeAt: string | null;
  /** Cents committed today, on the ceiling reason. */
  spentCents: number | null;
  /** The daily ceiling in cents, on the ceiling reason. */
  ceilingCents: number | null;
}

/** What the customer can do about it, if anything. The caller owns the href. */
export type CampaignHoldAction = "campaign_budget" | "billing" | null;

export interface CampaignHoldCopy {
  headline: string;
  body: string;
  action: CampaignHoldAction;
  actionLabel: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const readString = (data: Record<string, unknown>, key: string): string | null => {
  const v = data[key];
  return typeof v === "string" && v.length > 0 ? v : null;
};

const readNumber = (data: Record<string, unknown>, key: string): number | null => {
  const v = data[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const HOLD_REASONS = new Set<string>([
  "daily_ceiling_reached",
  "unfunded",
  "budgets_unreadable",
  "planning_failed",
]);

function fromCampaignHold(e: HoldEventInput): CampaignHold | null {
  if (!isRecord(e.data)) return null;
  const reason = readString(e.data, "reason");
  if (!reason || !HOLD_REASONS.has(reason)) return null;
  const nextRunAt = readString(e.data, "nextRunAt");
  const resumeAt = reason === "budgets_unreadable" || reason === "planning_failed" ? nextRunAt : null;
  return {
    reason: reason as CampaignHoldReason,
    at: e.createdAt,
    resumeAt,
    spentCents: readNumber(e.data, "spentCents"),
    ceilingCents: readNumber(e.data, "ceilingCents"),
  };
}

/**
 * The credit refusal, and ONLY that one.
 *
 * `gate-check-result` carries every reason a run is refused, and most of them are not a
 * hold a customer can read: "A run is already in progress" is transient and fires on
 * healthy campaigns, "Campaign is not ongoing" is what the status pill already says. The
 * discriminator is `creditCheck`, a machine-readable field, never the English `reason`
 * string — matching on another service's prose is how a consumer comes to re-declare a
 * vocabulary it does not own.
 */
function fromGateCheck(e: HoldEventInput): CampaignHold | null {
  if (!isRecord(e.data)) return null;
  if (e.data.allowed !== false) return null;
  if (readString(e.data, "creditCheck") !== "unaffordable") return null;
  return {
    reason: "insufficient_credits",
    at: e.createdAt,
    resumeAt: null,
    spentCents: null,
    ceilingCents: null,
  };
}

const freshnessMs = (reason: CampaignHoldReason): number =>
  (reason === "insufficient_credits" ? CREDIT_RECHECK_MS : HOLD_RECHECK_MS) *
  MISSED_CYCLES_BEFORE_STALE;

/**
 * The hold a campaign is under right now, or null when it is running normally.
 *
 * Takes the newest candidate of each kind, keeps whichever the producer wrote last, and
 * drops it when it has aged past two of its own re-check cycles. A campaign with no hold
 * events, or with only stale ones, reads null and its page shows nothing new.
 */
export function readCampaignHold(
  events: readonly HoldEventInput[],
  now: Date = new Date(),
): CampaignHold | null {
  let best: CampaignHold | null = null;
  for (const e of events) {
    const parsed =
      e.event === "campaign-hold"
        ? fromCampaignHold(e)
        : e.event === "gate-check-result"
          ? fromGateCheck(e)
          : null;
    if (!parsed) continue;
    const at = Date.parse(parsed.at);
    if (!Number.isFinite(at)) continue;
    if (now.getTime() - at >= freshnessMs(parsed.reason)) continue;
    if (!best || at > Date.parse(best.at)) best = parsed;
  }
  return best;
}

/**
 * The sentence a customer reads, in plain language, with no slug and no timestamp.
 *
 * The two reasons that are OURS say so and ask for nothing: a reader who is told to go
 * and fix something we broke goes looking for a control that does not exist. A campaign's
 * money is its max budget and max volume (owner 2026-10-10), so no line names a daily
 * budget. Every sentence names its subject (no opening "It").
 */
export function campaignHoldCopy(
  hold: CampaignHold,
  now: Date = new Date(),
): CampaignHoldCopy {
  switch (hold.reason) {
    case "daily_ceiling_reached":
      return {
        headline: "This campaign reached its limit",
        body: "This campaign hit its max budget or its max volume for this period. Sending starts again when the next period begins. Raise the limit to start sooner.",
        action: "campaign_budget",
        actionLabel: "Raise the limit",
      };
    case "unfunded":
      return {
        headline: "This campaign has no budget yet",
        body: "This campaign needs a max budget or a max volume to run. Set one and sending starts within ten minutes.",
        action: "campaign_budget",
        actionLabel: "Set a budget",
      };
    case "insufficient_credits":
      return {
        headline: "You are out of credit",
        body: "This campaign cannot send until your balance covers it. Add credits and sending starts again within half an hour.",
        action: "billing",
        actionLabel: "Add credits",
      };
    case "budgets_unreadable":
    case "planning_failed": {
      const when = hold.resumeAt ? timeUntil(hold.resumeAt, now) : null;
      const retry = when && when !== "now" ? `We try again ${when}.` : "We try again in a moment.";
      return {
        headline: "A problem on our side",
        body: `This campaign could not start because of a problem on our side. You have nothing to do. ${retry}`,
        action: null,
        actionLabel: null,
      };
    }
  }
}

/** One reason a campaign's pipes are held, and which pipes. */
export interface CampaignHoldGroup {
  hold: CampaignHold;
  campaignIds: string[];
}

/**
 * A sales-funnel campaign's holds, ONE note per reason (campaign-service holds each PIPE,
 * and a money hold names every pipe of the funnel at once: three identical notes would say
 * one thing three times). Keeps the newest hold of each reason, ids in the order given.
 */
export function holdsByReason(
  holds: ReadonlyArray<readonly [campaignId: string, hold: CampaignHold | null]>,
): CampaignHoldGroup[] {
  const groups = new Map<CampaignHoldReason, CampaignHoldGroup>();
  for (const [id, hold] of holds) {
    if (!hold) continue;
    const g = groups.get(hold.reason);
    if (!g) {
      groups.set(hold.reason, { hold, campaignIds: [id] });
      continue;
    }
    g.campaignIds.push(id);
    if (Date.parse(hold.at) > Date.parse(g.hold.at)) g.hold = hold;
  }
  return [...groups.values()];
}
