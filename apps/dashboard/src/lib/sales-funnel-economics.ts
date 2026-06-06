// Sales-cold-email funnel economics — pure, framework-free so it can be unit-tested
// and shared between the campaign-create page and its tests. The dashboard renders;
// this module is the single source for "which workflow has the best ROI" + revenue
// projection. Inputs are the cross-org workflow stats (cents) + the brand's saved
// conversion economics (percentages, as fractions); outputs are USD.
//
// Two sell motions:
//  • self-serve     — budget → website visits (clicks) → closes → revenue. One path.
//  • meeting-booked — a meeting (→ close) can come from TWO routes that the SAME budget
//                     funds simultaneously (the same emails produce both replies and
//                     clicks), so we SUM their contributions when both costs exist:
//                       meetings = replies × (reply→meeting) + visits × (visit→meeting)
//
// The unified ROI comparator is cost-per-close (USD): lower = better ROI. Auto-pick =
// the workflow minimizing it. recommendedBudget = targetCloses × costPerClose.

export type SalesObjective = "meeting-booked" | "self-serve";

/** Cross-org per-workflow cost metrics (cents). Both can be null when a workflow has
 *  not produced that signal yet. */
export const METRIC_COST_PER_POSITIVE_REPLY = "costPerRecipientPositiveReplyCents";
export const METRIC_COST_PER_CLICK = "costPerRecipientClickCents";

/** Brand conversion economics, percentages expressed as fractions (0.40 == 40%). */
export interface SalesEcon {
  /** Customer lifetime revenue, USD. */
  ltv: number;
  /** positive reply → meeting. */
  r2m: number;
  /** website visit → meeting. */
  v2m: number;
  /** meeting → close. */
  m2c: number;
  /** website visit → close (self-serve, no meeting). */
  v2c: number;
}

type Stats = Record<string, number | null | undefined>;

/** Per-workflow unit costs in USD, or null when the underlying metric is absent/zero. */
export function salesUnitCostsUsd(stats: Stats): { replyUsd: number | null; clickUsd: number | null } {
  const replyCents = stats[METRIC_COST_PER_POSITIVE_REPLY];
  const clickCents = stats[METRIC_COST_PER_CLICK];
  return {
    replyUsd: typeof replyCents === "number" && replyCents > 0 ? replyCents / 100 : null,
    clickUsd: typeof clickCents === "number" && clickCents > 0 ? clickCents / 100 : null,
  };
}

/** Closes generated per $1 of budget — the ROI scalar (higher = better). Sums both
 *  meeting routes for meeting-booked; clicks-only for self-serve. Returns 0 when the
 *  objective has no usable cost/conversion data (→ excluded from auto-pick). */
export function closesPerBudgetUsd(stats: Stats, objective: SalesObjective, econ: SalesEcon): number {
  const { replyUsd, clickUsd } = salesUnitCostsUsd(stats);

  if (objective === "self-serve") {
    if (clickUsd == null || econ.v2c <= 0) return 0;
    return econ.v2c / clickUsd;
  }

  // meeting-booked: meetings from both routes, funded by the same budget → SUM.
  let meetingsPerBudget = 0;
  if (replyUsd != null && econ.r2m > 0) meetingsPerBudget += econ.r2m / replyUsd;
  if (clickUsd != null && econ.v2m > 0) meetingsPerBudget += econ.v2m / clickUsd;
  return econ.m2c > 0 ? meetingsPerBudget * econ.m2c : 0;
}

/** Budget (USD) required per close — the unified ranking key. null when no usable data. */
export function costPerCloseUsd(stats: Stats, objective: SalesObjective, econ: SalesEcon): number | null {
  const cpb = closesPerBudgetUsd(stats, objective, econ);
  return cpb > 0 ? 1 / cpb : null;
}

/** CAC as a percentage of the customer's lifetime value (cost-per-close ÷ LTV × 100).
 *  Budget-invariant (budget cancels), so it's a pure per-workflow ROI ratio — lower is
 *  better. null when there's no usable cost data or LTV is non-positive. */
export function cacPctOfLtv(stats: Stats, objective: SalesObjective, econ: SalesEcon): number | null {
  const cpc = costPerCloseUsd(stats, objective, econ);
  return cpc != null && econ.ltv > 0 ? (cpc / econ.ltv) * 100 : null;
}

export interface SalesProjection {
  /** meeting-booked reply route; null when the workflow has no reply cost. */
  replies: number | null;
  /** website visits / clicks; null when the workflow has no click cost. */
  visits: number | null;
  /** meeting-booked combined meetings; null for self-serve. */
  meetings: number | null;
  closes: number;
  revenue: number;
  /** budget as a share of revenue (spend ÷ revenue), %. */
  cacPct: number | null;
  /** budget per close, USD. */
  cacAbs: number | null;
}

/** Project a budget (USD) through the funnel for one workflow. Returns null when the
 *  budget is non-positive or the workflow has no usable cost data for this objective. */
export function projectSales(
  stats: Stats,
  objective: SalesObjective,
  econ: SalesEcon,
  budgetUsd: number,
): SalesProjection | null {
  if (budgetUsd <= 0) return null;
  if (closesPerBudgetUsd(stats, objective, econ) <= 0) return null;

  const { replyUsd, clickUsd } = salesUnitCostsUsd(stats);

  if (objective === "self-serve") {
    const visits = clickUsd != null ? budgetUsd / clickUsd : 0;
    const closes = visits * econ.v2c;
    const revenue = closes * econ.ltv;
    return {
      replies: null,
      visits,
      meetings: null,
      closes,
      revenue,
      cacPct: revenue > 0 ? (budgetUsd / revenue) * 100 : null,
      cacAbs: closes > 0 ? budgetUsd / closes : null,
    };
  }

  const replies = replyUsd != null ? budgetUsd / replyUsd : null;
  const visits = clickUsd != null ? budgetUsd / clickUsd : null;
  const meetings = (replies ?? 0) * econ.r2m + (visits ?? 0) * econ.v2m;
  const closes = meetings * econ.m2c;
  const revenue = closes * econ.ltv;
  return {
    replies,
    visits,
    meetings,
    closes,
    revenue,
    cacPct: revenue > 0 ? (budgetUsd / revenue) * 100 : null,
    cacAbs: closes > 0 ? budgetUsd / closes : null,
  };
}
