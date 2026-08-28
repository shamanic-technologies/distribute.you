/**
 * What a USER'S OWN write moves, and therefore what has to be re-read at once.
 *
 * The poll decides how stale a number gets while somebody sits and watches it. This
 * decides what happens the moment they change something themselves, which is a
 * different question and a stricter one: a person who has just stated an outcome is
 * looking at the figures that outcome belongs to, so leaving them on the previous
 * answer until the next tick reads as the click having done nothing.
 *
 * The trap this exists to close is that ONE fact is served under SEVERAL query roots.
 * The same money is asked for per channel, per campaign, per offer, per funnel and per
 * brand, each under its own key because each is a different answer from
 * features-service — so a mutation that invalidates the one root it happens to know
 * about leaves every sibling grain showing the pre-write figure. A lead statement used
 * to invalidate `featureRevenue` alone, so the campaign's own cards moved and the
 * brand Overview, the offer money, the funnel walk and the audience costs did not.
 *
 * Alias-free and dependency-free ON PURPOSE (the client is taken structurally, so this
 * module imports nothing) — that is what lets it carry real unit tests rather than a
 * source-substring guard. Keep it that way.
 */

/** The one method these helpers need. Structural, so no react-query import. */
export interface InvalidatingClient {
  invalidateQueries(filters: { queryKey: readonly unknown[] }): unknown;
}

/**
 * Every root restating an OUTCOME a lead reached.
 *
 * A funnel-step statement, a reply kind, a board move: all of them change what landed,
 * so they change the money that divides by it, the per-audience costs that rank on it,
 * the funnel rungs that count it and the activity the charts draw from it.
 *
 * `workflowProjection` is deliberately ABSENT. It is a FLEET-wide benchmark of what an
 * outcome costs across every org, not a statement about this brand's own results — one
 * lead cannot move it, and it is one of the most expensive reads in the app.
 */
export const LEAD_OUTCOME_ROOTS = [
  // The same money at five grains. Each is its own answer from features-service, and a
  // page scoped to one of them polls only its own key — so all five have to be told.
  "featureRevenue",
  "featureRevenueByCampaign",
  "offerRevenue",
  "brandRevenue",
  "brandOfferMoney",
  "offerFunnelRevenue",
  // Per-audience evidence and costs — the Audiences table and the Top-3 card both rank
  // on an outcome count that just changed.
  "featureAudienceStats",
  // The outreach stat row's own counts.
  "featureStats",
  // The activity and outcome charts, at both grains that serve them.
  "featurePipelineActivity",
  "offerFunnelPipelineActivity",
] as const;

/**
 * Every root restating what a campaign may SPEND, or whether it is running at all.
 *
 * `brandSpendableBudget` is the one that kept being missed: it is the join of billing's
 * ceilings to campaign-service's statuses, so it moves on a pause exactly as it moves on
 * a budget edit, and it is what the header money and the cost card's denominator read.
 *
 * `brandFunnelBudgets` is deliberately ABSENT: both writers already write billing's own
 * answer into that key with `setQueryData`, and invalidating it would replace a figure
 * we have just been told with a re-read that can fail and fall back to the pre-save one.
 */
export const CAMPAIGN_MONEY_ROOTS = [
  "campaigns",
  "campaign",
  "brandDailyBudget",
  "brandSpendableBudget",
  "offerFunnels",
] as const;

/**
 * Ask for a re-read of every listed root, now.
 *
 * React Query's default `refetchType` is `active`, so this refetches what is ON SCREEN
 * and marks the rest stale for whenever it is next mounted — which is exactly the shape
 * wanted here: the reader sees their own change immediately and nothing else costs a
 * request until somebody looks at it.
 */
export function invalidateRoots(client: InvalidatingClient, roots: readonly string[]): void {
  for (const root of roots) client.invalidateQueries({ queryKey: [root] });
}

/** Everything a statement about a lead's outcome moves. */
export function invalidateLeadOutcome(client: InvalidatingClient): void {
  invalidateRoots(client, LEAD_OUTCOME_ROOTS);
}

/** Everything a budget or campaign-status write moves. */
export function invalidateCampaignMoney(client: InvalidatingClient): void {
  invalidateRoots(client, CAMPAIGN_MONEY_ROOTS);
}
