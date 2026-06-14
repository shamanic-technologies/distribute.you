// Client mirror of features-service `project()` (src/routes/workflow-projection.ts) + `orP`
// (src/lib/funnel-registry.ts). features-service stays the SINGLE SOURCE for the per-workflow
// GLOBAL unit costs (contacted/reply/click $) — those are econ-INDEPENDENT and fetched once via
// getWorkflowProjection. This module recomputes cost-per-close + the funnel from the brand's LIVE
// conversion economics so the §3 budget cards update INSTANTLY as the user edits the metric inputs,
// with NO per-edit server round-trip (the cold Neon chain api→features→{workflow,runs,email-gateway,
// brand} took ~20s). On first load the live econ == the brand's saved econ, so this reproduces the
// server's costPerCloseUsd/projection exactly (same formula, same inputs); thereafter it tracks the
// live inputs. KEEP IN LOCKSTEP with the server formula — guarded by sales-funnel-projection.test.ts.

/** Brand conversion economics as decimals (the UI stores percentages 0–100; divide by 100). */
export interface FunnelEconomics {
  ltv: number; // lifetime revenue per close (USD)
  r2m: number; // P(meeting | positive reply)
  v2m: number; // P(meeting | click/visit)
  m2c: number; // P(close | meeting)
  v2c: number; // P(close | click/visit) — direct self-serve route
}

/** Per-workflow GLOBAL unit costs (cross-org, feature-scoped) — econ-independent, server-owned. */
export interface FunnelUnitCosts {
  contactedUsd: number | null;
  replyUsd: number | null;
  clickUsd: number | null;
}

export interface FunnelProjection {
  contactedLeads: number | null;
  replies: number | null;
  visits: number | null;
  meetings: number | null;
  closes: number;
  revenue: number;
  cacPct: number | null;
  cacAbs: number | null;
}

/** Independent-probability OR-combine: 1 − Π(1 − pᵢ). Mirrors funnel-registry.ts `orP`. */
export const orP = (...ps: number[]): number => 1 - ps.reduce((survive, p) => survive * (1 - p), 1);

/**
 * Mirror of features-service `project()`. A click closes via TWO independent routes (direct
 * self-serve v2c OR a booked meeting v2m·m2c, combined with orP); a positive reply closes via a
 * meeting (r2m·m2c). At the population/expected-count level the click and reply channels ADD by
 * linearity of expectation. Returns cost-per-close + (when budgetUsd>0) the funnel at that budget.
 */
export function projectFunnel(
  costs: FunnelUnitCosts,
  econ: FunnelEconomics,
  budgetUsd: number | null,
): { costPerCloseUsd: number | null; projection: FunnelProjection | null } {
  const pCloseClick = orP(econ.v2c, econ.v2m * econ.m2c);
  const pCloseReply = econ.r2m * econ.m2c;

  const closesPerBudget =
    (costs.clickUsd != null ? (1 / costs.clickUsd) * pCloseClick : 0) +
    (costs.replyUsd != null ? (1 / costs.replyUsd) * pCloseReply : 0);

  if (closesPerBudget <= 0) return { costPerCloseUsd: null, projection: null };
  const costPerCloseUsd = 1 / closesPerBudget;

  if (budgetUsd == null || budgetUsd <= 0) return { costPerCloseUsd, projection: null };

  const contactedLeads = costs.contactedUsd != null ? budgetUsd / costs.contactedUsd : null;
  const replies = costs.replyUsd != null ? budgetUsd / costs.replyUsd : null;
  const visits = costs.clickUsd != null ? budgetUsd / costs.clickUsd : null;
  // Meetings come from BOTH routes (reply→meeting and click→meeting), regardless of objective.
  const meetings = (replies ?? 0) * econ.r2m + (visits ?? 0) * econ.v2m;
  const closes = budgetUsd * closesPerBudget;
  const revenue = closes * econ.ltv;
  const cacPct = revenue > 0 ? (budgetUsd / revenue) * 100 : null;
  const cacAbs = closes > 0 ? budgetUsd / closes : null;

  return {
    costPerCloseUsd,
    projection: { contactedLeads, replies, visits, meetings, closes, revenue, cacPct, cacAbs },
  };
}
