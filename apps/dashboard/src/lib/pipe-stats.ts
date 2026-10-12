/**
 * A pipe's own figures since inception (owner 2026-10-12: "chaque page Pipe doit avoir ses
 * propres graphes, stats ... les volumes traités, le ROI, le $ par outcome since inception en
 * snapshot et en line chart over time", then "voir la différence entre cross org, sa brand et
 * son offer"). Served whole by features-service on the pipe detail read with `?stats=true`
 * (PIPE-STATS-1012), at one of three scopes: the fleet (no identity), one brand (`brandId`),
 * one offer of that brand (`brandId` + `offerId`; an offer alone is a 400 `brand_required`).
 *
 * Every figure is the producer's. The volumes carry their own labels (the AI meeting booking
 * pipe says "Positive reply received -> Acted on -> Meeting booked", a cold email pipe "People
 * contacted -> <its step>"), so the page renders any pipe without knowing it. The history is
 * cumulative per UTC day and its last point IS the snapshot. Money is net (what orgs pay).
 *
 * The headline `costUsd` of the pipe row is the BEST workflow's mature cost; these stats are
 * the WHOLE pipe since inception. They differ on purpose, so each carries its own label.
 *
 * Alias-free (zod only) so it carries real unit tests.
 */
import { z } from "zod";
import { formatRatePct as formatLegRatePct, roundLegRatePct } from "./brand-conversion-rates";

export const PIPE_STATS_SCOPES = ["fleet", "brand", "offer"] as const;
export type PipeStatsScope = (typeof PIPE_STATS_SCOPES)[number];

/** The column / line name of each scope, as the page prints it. */
export const PIPE_STATS_SCOPE_LABELS: Record<PipeStatsScope, string> = {
  fleet: "All clients",
  brand: "This brand",
  offer: "This offer",
};

const PipeStatsVolumeSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    role: z.string(),
    total: z.number().nullable(),
    undated: z.number().nullish(),
  })
  .passthrough();

/** A served rate between two of the pipe's volumes, in PERCENT (62.5 = 62.5%), null with a reason when there is no input yet. */
const PipeStatsRateSchema = z
  .object({
    key: z.string(),
    fromKey: z.string(),
    toKey: z.string(),
    label: z.string(),
    // Null when the volume is not measured (a customer team pipe whose tools do not record the step).
    numerator: z.number().nullable(),
    denominator: z.number().nullable(),
    ratePct: z.number().nullable(),
    unavailableReason: z.string().nullish(),
  })
  .passthrough();
export type PipeStatsRate = z.infer<typeof PipeStatsRateSchema>;

/**
 * PIPE-PERIODS-1012: the same figures per calendar period (owner 2026-10-12, Doc Dinners' hand-drawn
 * "Since Dec 2024 / Q1 2026 / … / Oct 2026" table). NOT cumulative: each row counts its own period.
 * Count keys are the block's volume keys, rate keys its rate keys; money is null when no spend of ours.
 */
const PipePeriodRowSchema = z
  .object({
    period: z.string(),
    kind: z.string(),
    label: z.string(),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),
    counts: z.record(z.string(), z.number().nullable()),
    ratesPct: z.record(z.string(), z.number().nullable()),
    rateUnavailableReasons: z.record(z.string(), z.string().nullable()).optional(),
    spendUsd: z.number().nullable(),
    costPerOutcomeUsd: z.number().nullable(),
  })
  .passthrough();
export type PipePeriodRow = z.infer<typeof PipePeriodRowSchema>;

const PipePeriodsSchema = z
  .object({
    basis: z.string(),
    total: PipePeriodRowSchema,
    quarters: z.array(PipePeriodRowSchema),
    months: z.array(PipePeriodRowSchema),
    // teamImpact only: the pipe's impact in points per period key ("since_inception", "2026-Q1", "2026-10").
    impactPointsDiff: z.record(z.string(), z.number().nullable()).optional(),
  })
  .passthrough();
export type PipePeriods = z.infer<typeof PipePeriodsSchema>;

export const PERIOD_GRAINS = ["quarters", "months"] as const;
export type PeriodGrain = (typeof PERIOD_GRAINS)[number];

/** The rows a period table prints: the served "Since …" total first, then the grain's rows in served order. */
export function periodRows(periods: PipePeriods, grain: PeriodGrain): PipePeriodRow[] {
  return [periods.total, ...periods[grain]];
}

/** Money columns only when some row carries a spend of ours (a customer team pipe serves null everywhere). */
export function periodsHaveSpend(periods: PipePeriods): boolean {
  return [periods.total, ...periods.quarters, ...periods.months].some((r) => r.spendUsd != null);
}

const ImpactRowSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    fromCount: z.number().nullable(),
    toCount: z.number().nullable(),
    ratePct: z.number().nullable(),
    rateUnavailableReason: z.string().nullish(),
    spendUsd: z.number().nullable(),
    costPerOutcomeUsd: z.number().nullable(),
    costPerOutcomeUnavailableReason: z.string().nullish(),
  })
  .passthrough();
export type TeamImpactRow = z.infer<typeof ImpactRowSchema>;

const ImpactSchema = z
  .object({
    pointsDiff: z.number().nullable(),
    pointsDiffUnavailableReason: z.string().nullish(),
    ratio: z.number().nullable(),
    ratioUnavailableReason: z.string().nullish(),
  })
  .passthrough();

const TeamImpactSchema = z
  .object({
    available: z.boolean(),
    unavailableReason: z.string().nullish(),
    fromStepLabel: z.string().nullable(),
    toStepLabel: z.string(),
    rows: z.array(ImpactRowSchema),
    impact: ImpactSchema,
    periods: PipePeriodsSchema.nullish(),
    history: z.array(
      z
        .object({
          date: z.string(),
          teamAlone: z.object({ ratePct: z.number().nullable() }).passthrough(),
          teamPlusPipe: z.object({ ratePct: z.number().nullable() }).passthrough(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type TeamImpact = z.infer<typeof TeamImpactSchema>;

/** A served impact in words: "+8.3 pts (×1.5)"; the reason when a side is missing. */
export function impactWords(impact: TeamImpact["impact"]): { points: string | null; ratio: string | null } {
  const pts = impact.pointsDiff == null ? null : formatPoints(impact.pointsDiff);
  const ratio = impact.ratio == null ? null : `×${impact.ratio.toFixed(impact.ratio < 10 ? 1 : 0).replace(/\.0$/, "")}`;
  return { points: pts, ratio };
}

const PipeStatsPointSchema = z
  .object({
    date: z.string(),
    spendUsd: z.number().nullable(),
    volumes: z.record(z.string(), z.number().nullable()),
    costPerOutcomeUsd: z.number().nullable(),
    roi: z.number().nullable(),
    // PIPE-RATES-1012: the same rates as they stood that day, cumulative, percent.
    conversionRates: z.record(z.string(), z.number().nullable()).optional(),
  })
  .passthrough();

export const PipeStatsSchema = z
  .object({
    scope: z.object({ kind: z.enum(PIPE_STATS_SCOPES) }).passthrough(),
    campaignCount: z.number().nullish(),
    firstActivityDay: z.string().nullish(),
    volumes: z.array(PipeStatsVolumeSchema),
    spendUsd: z.number().nullable(),
    costPerOutcomeUsd: z.number().nullable(),
    costPerOutcomeUnavailableReason: z.string().nullish(),
    valuePerOutcomeUsd: z.number().nullish(),
    roi: z.number().nullable(),
    roiUnavailableReason: z.string().nullish(),
    conversionRates: z.array(PipeStatsRateSchema).optional(),
    // PIPE-TEAM-BASELINE-1012: on a customer team pipe, where its counts come from (the brand's own tools), or why they cannot be read.
    teamSource: z
      .object({ available: z.boolean(), unavailableReason: z.string().nullish(), fromSources: z.array(z.string()).optional(), toSources: z.array(z.string()).optional() })
      .passthrough()
      .nullish(),
    // PIPE-TEAM-ON-OUR-REPLIES-1012: on a customer team pipe, the people OUR campaigns brought to the
    // first step that our pipes did not act on, and how many the team took to the last step.
    ourLeadsToTeam: z
      .object({
        available: z.boolean(),
        unavailableReason: z.string().nullish(),
        conversionRates: z.array(PipeStatsRateSchema).optional(),
        periods: PipePeriodsSchema.nullish(),
      })
      .passthrough()
      .nullish(),
    // PIPE-TEAM-IMPACT-1012: on a platform pipe whose step a client team also works, "team alone"
    // vs "team + this pipe" on the people our campaigns brought, and the pipe's impact. Rendered as is.
    teamImpact: TeamImpactSchema.nullish(),
    periods: PipePeriodsSchema.nullish(),
    history: z.array(PipeStatsPointSchema),
  })
  .passthrough();
export type PipeStats = z.infer<typeof PipeStatsSchema>;

/** The pipe detail read with `?stats=true`: only `stats` is consumed here. */
export const PipeWithStatsSchema = z.object({ stats: PipeStatsSchema }).passthrough();

/** The query a scope sends; null when the page lacks the id that scope needs (no offer selected). */
export function pipeStatsQuery(scope: PipeStatsScope, brandId: string | null, offerId: string | null): Record<string, string> | null {
  if (scope === "fleet") return { stats: "true" };
  if (!brandId) return null;
  if (scope === "brand") return { stats: "true", brandId };
  if (!offerId) return null;
  return { stats: "true", brandId, offerId };
}

/** The volume reached at the end of the pipe (the producer's `role: "outcome"` row). */
export function outcomeVolume(stats: PipeStats) {
  return stats.volumes.find((v) => v.role === "outcome") ?? null;
}

/**
 * A served percent as the page prints it: the owner's rate rule (#4756), a whole percent, a
 * decimal only below 1% (`roundLegRatePct`); a non-zero rate that still rounds to 0 reads `<0.1%`.
 */
export function formatRatePct(pct: number): string {
  if (pct > 0 && pct < 0.05) return "<0.1%";
  return formatLegRatePct(pct);
}

/** A served difference in percentage points, same rule as the rates it compares: "+8 pts". */
export function formatPoints(pts: number): string {
  return `${pts > 0 ? "+" : pts < 0 ? "-" : ""}${roundLegRatePct(Math.abs(pts))} pts`;
}

/**
 * The served rate from the pipe's first volume to its outcome (our pipe: positive reply to meeting
 * booked; a customer team pipe: its one rate). A lookup on served keys, nothing divided.
 */
export function endToEndRate(stats: PipeStats): PipeStatsRate | null {
  const first = stats.volumes[0]?.key;
  return stats.conversionRates?.find((r) => r.fromKey === first && r.toKey === "outcomes") ?? null;
}

/** Why a customer team's figures cannot be read, in plain words (crm-service's closed vocabulary). */
const TEAM_REASON_WORDS: Record<string, string> = {
  from_step_not_recorded: "Their tools do not record the first step",
  to_step_not_recorded: "Their tools do not record the last step",
  step_not_in_crm_vocabulary: "No tool records this step",
  not_synced: "Their tools are not synced yet",
  no_connected_source: "No tool connected",
  no_people_scope: "No tool connected",
  no_brand_answers: "No client's tools record it yet",
  leg_has_no_from_step: "This step has no first step",
  customer_team_time: "Their team's time",
  no_outcome_yet: "No outcome yet",
  outcome_not_measured: "Not measured",
  no_spend_recorded: "No spend yet",
  team_alone_not_measured: "Team alone not measured",
  team_alone_no_input: "No reply left to the team yet",
  team_plus_pipe_not_measured: "This pipe not measured",
  team_plus_pipe_no_input: "This pipe acted on nobody yet",
  team_alone_rate_zero: "Team alone at 0%",
  from_step_not_produced_by_our_campaigns: "Our campaigns do not bring people here",
  to_step_not_recorded_for_our_leads: "Their tools do not record the last step",
  no_campaign_of_ours_brings_people_to_from: "No campaign of ours brings people here",
};
/** The team's served rate on the people our campaigns brought (null when not served or unavailable). */
export function teamOnOurLeadsRate(stats: PipeStats): PipeStatsRate | null {
  const o = stats.ourLeadsToTeam;
  if (!o?.available) return null;
  return o.conversionRates?.find((r) => r.toKey === "outcomes") ?? null;
}

export function teamReasonWords(reason: string | null | undefined): string {
  return (reason && TEAM_REASON_WORDS[reason]) ?? unavailableWords(reason);
}

/** A producer reason (`no_outcomes_yet`, `no_spend`) in plain words, never a raw slug alone. */
export function unavailableWords(reason: string | null | undefined): string {
  if (!reason) return "Learning";
  const words = reason.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The chart rows for one metric across the scopes read: one row per day any scope has a
 * point, a key per scope. A scope with no point that day is absent (the line steps across it),
 * never 0. Nothing is computed: each value is a served history point.
 */
export function mergeHistories(
  byScope: Partial<Record<PipeStatsScope, PipeStats | null | undefined>>,
  pick: (p: PipeStats["history"][number]) => number | null,
): Array<{ t: number; date: string } & Partial<Record<PipeStatsScope, number>>> {
  const rows = new Map<string, { t: number; date: string } & Partial<Record<PipeStatsScope, number>>>();
  for (const scope of PIPE_STATS_SCOPES) {
    const s = byScope[scope];
    if (!s) continue;
    for (const p of s.history) {
      const v = pick(p);
      if (v == null) continue;
      const row = rows.get(p.date) ?? { t: Date.parse(`${p.date}T00:00:00Z`), date: p.date };
      row[scope] = v;
      rows.set(p.date, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}
