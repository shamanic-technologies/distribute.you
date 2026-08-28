// How long a campaign still has to go before its figures can be priced — stated in
// DAYS, because days are what a person can act on and dollars-per-outcome is not.
//
// The gate itself is unchanged and lives in `learning-threshold.ts`: a cost per outcome
// is stated once ten of that outcome have landed. What this module answers is the
// question that gate leaves open — "so when?" — by reading the campaign as a reservoir:
// it needs about ten outcomes' worth of spend, it has spent some of it, and it spends a
// known amount each day. The rest is division.
//
// Cold email gets a settling period on top. A send bought today is not answered today:
// replies keep arriving for about two weeks, so the spend that finishes the tank still
// has outcomes in flight behind it. Counting those two weeks is the difference between
// a promise that holds and one that expires the moment the budget runs out.
//
// Only relative value imports live here, so this module stays directly unit-testable
// (vitest does not resolve the "@" alias). Keep it that way.

import { LEARNING_MIN_OUTCOMES } from "./learning-threshold";

/**
 * Days of replies still landing after the spend is in, on a channel that sends email.
 *
 * A cold-email send is answered over days, not on the day it goes out, so the last
 * dollar of the learning budget buys outcomes that appear well after it is spent. Two
 * weeks is the window instantly-service's own retry sweep already treats as the outer
 * edge of a live sequence, and it is what the customer is told.
 */
export const REPLY_SETTLING_DAYS = 14;

/**
 * The channels whose outcomes arrive by email, and therefore late.
 *
 * A closed set on purpose rather than a substring test on "email": a channel is added
 * here when we know its outcomes settle, not because of how it is spelled. Everything
 * else settles on the day it is measured (a website visit is a visit), so it carries no
 * settling period at all.
 */
export const REPLY_SETTLING_CHANNEL_SLUGS: ReadonlySet<string> = new Set([
  "sales-cold-email-outreach",
  "sales-crm-email-outreach",
  "feedback-request-cold-email-outreach",
]);

/** Whether this acquisition channel's outcomes keep landing after the send. */
export function channelSettlesLate(featureSlug: string | null | undefined): boolean {
  if (!featureSlug) return false;
  return REPLY_SETTLING_CHANNEL_SLUGS.has(featureSlug);
}

/**
 * What this funnel buys, singular, in the words the band prices it in.
 *
 * Read off the funnel's own step KEYS rather than a goal, for the reason every
 * campaign-scoped surface reads the funnel: one goal covers both meeting funnels, so it
 * cannot say whether the thing being priced is a reply or a visit. The step the band
 * names is the first MEASURED one — the same step the `Learning` gate counts — so the
 * band and the tag under it are talking about one outcome.
 */
export function learningSignalNoun(stepKeys: readonly string[]): string {
  if (stepKeys.includes("positive_replies")) return "sales interest";
  if (stepKeys.includes("website_visits")) return "website visit";
  return "result";
}

/** Spend that buys {@link LEARNING_MIN_OUTCOMES} outcomes at the expected price, USD. */
export function learningThresholdUsd(
  outcomeUnitCostUsd: number | null | undefined,
): number | null {
  const unitCost = positive(outcomeUnitCostUsd);
  return unitCost == null ? null : unitCost * LEARNING_MIN_OUTCOMES;
}

/** One dated point of features-service's cumulative spend curve. */
export interface CumulativeSpendDay {
  /** UTC calendar day (YYYY-MM-DD), the name features-service serves it under. */
  date: string;
  cumulativeSpendUsd: number;
}

/**
 * Days elapsed since cumulative spend first passed the threshold, or null.
 *
 * Read off `roiHistory.daily`, whose spend leg is cumulative and committed — the same
 * basis the threshold is measured against, so the two cannot answer about different
 * money. Null when no day has passed it yet, or when there is no curve to read: both
 * mean "the settling window has not started", never "it is over".
 */
export function settlingDaysElapsed(
  daily: readonly CumulativeSpendDay[] | null | undefined,
  thresholdUsd: number | null,
  now: Date,
): number | null {
  if (!daily || daily.length === 0 || thresholdUsd == null) return null;
  const crossed = daily.find((point) => point.cumulativeSpendUsd >= thresholdUsd);
  if (!crossed) return null;
  const at = Date.parse(`${crossed.date}T00:00:00.000Z`);
  if (Number.isNaN(at)) return null;
  const days = Math.floor((now.getTime() - at) / 86_400_000);
  return days < 0 ? 0 : days;
}

/** What the caller knows about one campaign's learning run. */
export interface LearningProgressInput {
  /** Expected cost of ONE of this campaign's outcomes, USD. Null = we cannot price it. */
  outcomeUnitCostUsd: number | null | undefined;
  /** Committed spend so far, USD — the same basis ROI divides by. */
  spentUsd: number | null | undefined;
  /** What the campaign may spend today, USD. Zero means nothing is running. */
  dailyBudgetUsd: number | null | undefined;
  /** {@link REPLY_SETTLING_DAYS} on a channel that sends email, else 0. */
  settlingDays: number;
  /**
   * Days already elapsed of the settling period — only knowable once we can date the
   * day cumulative spend passed the threshold. Absent means "cannot tell", and the
   * whole settling window is then still ahead: an unknown elapsed is never read as a
   * finished one, because that would shorten a promise on no evidence.
   */
  settlingDaysElapsed?: number | null;
}

/** The band's whole content, or null when there is nothing honest to state. */
export interface LearningProgress {
  /** Spend that buys {@link LEARNING_MIN_OUTCOMES} outcomes at the expected price, USD. */
  thresholdUsd: number;
  /** Committed spend so far, USD. */
  spentUsd: number;
  /** Days of spending still to go before the tank is full. */
  spendDaysLeft: number;
  /** Days of replies still to land after that. */
  settlingDaysLeft: number;
  /** What the band states: {@link spendDaysLeft} + {@link settlingDaysLeft}. */
  daysLeft: number;
  /** How far along the whole run is, 0-100. */
  pct: number;
  /** Today's daily ceiling, USD — what the CTA doubles. */
  dailyBudgetUsd: number;
}

function positive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * The band's figures, or null when any of the three inputs is missing.
 *
 * Null is the honest answer, not a degraded one: without an expected price there is no
 * tank to fill, and without a daily budget nothing is filling it. Substituting the
 * nearest number we happen to hold (total spent, the fleet average) would state a date
 * nobody can stand behind, which is worse than saying nothing on a surface whose whole
 * job is to say when.
 */
export function learningProgress(input: LearningProgressInput): LearningProgress | null {
  const unitCost = positive(input.outcomeUnitCostUsd);
  const dailyBudgetUsd = positive(input.dailyBudgetUsd);
  if (unitCost == null || dailyBudgetUsd == null) return null;

  const spentUsd = Math.max(0, input.spentUsd ?? 0);
  const thresholdUsd = unitCost * LEARNING_MIN_OUTCOMES;
  const remainingUsd = Math.max(0, thresholdUsd - spentUsd);
  const spendDaysLeft = Math.ceil(remainingUsd / dailyBudgetUsd);

  // The settling window only starts running once the spend is in, so a campaign still
  // filling its tank has every one of those days ahead of it.
  const settlingDays = Math.max(0, input.settlingDays);
  const elapsed = spendDaysLeft > 0 ? 0 : Math.max(0, input.settlingDaysElapsed ?? 0);
  const settlingDaysLeft = Math.max(0, settlingDays - elapsed);

  const daysLeft = spendDaysLeft + settlingDaysLeft;
  // Days already behind it, at today's rate — the reservoir read backwards. It is a
  // description of the same division, so the bar and the number beside it cannot say
  // different things.
  const spendDaysDone = Math.min(spentUsd, thresholdUsd) / dailyBudgetUsd;
  const totalDays = spendDaysDone + settlingDays;
  const done = spendDaysDone + (settlingDays - settlingDaysLeft);
  const pct = totalDays <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((done / totalDays) * 100)));

  return {
    thresholdUsd,
    spentUsd,
    spendDaysLeft,
    settlingDaysLeft,
    daysLeft,
    pct,
    dailyBudgetUsd,
  };
}

/**
 * What doubling the daily ceiling would leave, in days — the CTA's whole promise.
 *
 * Only the SPENDING half moves: replies land on their own clock whatever we pay, so a
 * settling period that is already counted stays counted. Null when doubling changes
 * nothing a reader would notice (the tank is full, or it fills tomorrow either way) —
 * offering a budget rise that buys no time is the kind of nudge that costs trust.
 */
export function learningProgressIfDoubled(progress: LearningProgress): number | null {
  if (progress.spendDaysLeft < 2) return null;
  const halved = Math.ceil(progress.spendDaysLeft / 2);
  const daysLeft = halved + progress.settlingDaysLeft;
  if (daysLeft >= progress.daysLeft) return null;
  return daysLeft;
}
