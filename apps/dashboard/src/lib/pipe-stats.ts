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
    total: z.number(),
    undated: z.number().nullish(),
  })
  .passthrough();

const PipeStatsPointSchema = z
  .object({
    date: z.string(),
    spendUsd: z.number().nullable(),
    volumes: z.record(z.string(), z.number().nullable()),
    costPerOutcomeUsd: z.number().nullable(),
    roi: z.number().nullable(),
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
