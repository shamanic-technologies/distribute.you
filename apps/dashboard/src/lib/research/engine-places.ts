import { z } from "zod";

/**
 * FACTORY-RESEARCH-1102 (owner 2026-11-02: « on adaptera la page Research qui est outdate avec tous les pipes »):
 * the Engine half of Research, the GTM Factory way. Read from features-service `GET /internal/research/engine-places`
 * (gateway `/v1/features/research/engine-places`, staff), through the staff route `/api/research/user/engine-places`.
 *
 * A PLACE = one outcome as one caller asks for it. Every figure (favourite, chance, clear winner, share of draws,
 * belief, cost per decision, the replay's value lost) is SERVED; this module only parses, groups for display and
 * picks which place the page opens on. Alias-free: unit-tested.
 */
const CandidateSchema = z.object({
  candidateId: z.string(),
  workflowDynastySlug: z.string(),
  workflowName: z.string(),
  channelName: z.string(),
  sharePct: z.number().nullable(),
  beliefRatePct: z.number().nullable(),
  costPerDecisionUsd: z.number().nullable(),
  fleetDecisions: z.number(),
  fleetOutcomes: z.number(),
});

// `ratePct` renamed `outcomesPer100Decisions` by features-service (2026-11-02, a pure rename: over 100 when one decision makes
// several outcomes); both optional while the rename rolls out, read through `outcomesPer100` (`??` only for this rename).
const SplitSideSchema = z.object({
  workflows: z.number().int(),
  outcomes: z.number(),
  decisions: z.number(),
  outcomesPer100Decisions: z.number().nullish(),
  ratePct: z.number().nullish(),
});

export const EnginePlacesSchema = z.object({
  computedAt: z.string().nullable(),
  clearWinnerPct: z.number(),
  summary: z.object({ places: z.number().int(), clearWinners: z.number().int(), campaigns: z.number().int() }),
  places: z.array(
    z.object({
      key: z.string(),
      outcome: z.string(),
      outcomeName: z.string(),
      consumer: z.string(),
      consumerName: z.string(),
      campaigns: z.number().int(),
      favourite: CandidateSchema.extend({ chancePct: z.number().nullable() }).nullable(),
      clearWinner: z.boolean(),
      candidates: z.array(CandidateSchema),
      /** Asked of features-service 2026-11-02 (Factory's spark and « value lost per day »): drawn once served. */
      daily: z
        .array(z.object({ day: z.string(), decisions: z.number(), favouriteSharePct: z.number().nullable(), lostUsd: z.number().nullable() }))
        .optional(),
      dailyBasis: z.string().optional(),
    }),
  ),
  engines: z.array(
    z.object({
      outcome: z.string(),
      outcomeName: z.string(),
      callers: z.array(z.object({ consumer: z.string(), consumerName: z.string(), best: z.string().nullable() })),
    }),
  ),
  /** Factory's « Proposed strategies »: per place, each workflow tactic splitting its candidates, inside vs outside, judged. */
  strategySplits: z.array(
    z.object({
      placeKey: z.string(),
      outcomeName: z.string(),
      consumerName: z.string(),
      tacticId: z.string(),
      tacticName: z.string(),
      tacticDescription: z.string(),
      inside: SplitSideSchema,
      outside: SplitSideSchema,
      better: z.enum(["inside", "outside"]).nullable(),
      verdict: z.enum(["conclusion", "signal", "noise"]),
      reason: z.string(),
      proposed: z.boolean(),
    }),
  ),
  replay: z
    .object({
      computedAt: z.string(),
      windowDays: z.number(),
      families: z.array(
        z.object({ family: z.string(), familyName: z.string().optional(), outcome: z.string(), outcomeName: z.string(), todayRegret: z.number().nullable(), engineRegret: z.number().nullable() }),
      ),
      failure: z.string().nullable(),
    })
    .nullable(),
});

export type EnginePlaces = z.infer<typeof EnginePlacesSchema>;
export type EnginePlace = EnginePlaces["places"][number];
export type EnginePlaceCandidate = EnginePlace["candidates"][number];
export type EngineCallers = EnginePlaces["engines"][number];
export type StrategySplit = EnginePlaces["strategySplits"][number];
export type ReplayFamily = NonNullable<EnginePlaces["replay"]>["families"][number];

/** Parse the served body; a shape mismatch throws loud (the page shows its error state). */
export function parseEnginePlaces(body: unknown): EnginePlaces {
  const parsed = EnginePlacesSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[dashboard] research engine-places: response shape mismatch", { issues: parsed.error.issues });
    throw new Error("[dashboard] research engine-places: invalid response shape");
  }
  return parsed.data;
}

/** The places grouped by caller (Factory's « Candidate places »), callers and places in the served order. */
export function placesByCaller(places: readonly EnginePlace[]): Array<{ consumer: string; consumerName: string; places: EnginePlace[] }> {
  const groups: Array<{ consumer: string; consumerName: string; places: EnginePlace[] }> = [];
  for (const p of places) {
    const g = groups.find((x) => x.consumer === p.consumer);
    if (g) g.places.push(p);
    else groups.push({ consumer: p.consumer, consumerName: p.consumerName, places: [p] });
  }
  return groups;
}

/**
 * The place the page shows: the one asked (`?place=` key), else the place held by the most live campaigns (the
 * first served one on a tie), else null when nothing is served yet.
 */
export function selectedPlace(places: readonly EnginePlace[], asked: string | null): EnginePlace | null {
  const hit = asked ? places.find((p) => p.key === asked) : undefined;
  if (hit) return hit;
  let best: EnginePlace | null = null;
  for (const p of places) if (!best || p.campaigns > best.campaigns) best = p;
  return best;
}

/** The replay's families for one outcome (the selected place's value lost), in served order. */
export function replayFamiliesOf(data: Pick<EnginePlaces, "replay">, outcome: string): ReplayFamily[] {
  return (data.replay?.families ?? []).filter((f) => f.outcome === outcome);
}

/** The splits grouped by place (served `placeKey`), places and splits in the served order. */
export function splitsByPlace(splits: readonly StrategySplit[]): Array<{ placeKey: string; outcomeName: string; consumerName: string; splits: StrategySplit[] }> {
  const groups: Array<{ placeKey: string; outcomeName: string; consumerName: string; splits: StrategySplit[] }> = [];
  for (const s of splits) {
    const g = groups.find((x) => x.placeKey === s.placeKey);
    if (g) g.splits.push(s);
    else groups.push({ placeKey: s.placeKey, outcomeName: s.outcomeName, consumerName: s.consumerName, splits: [s] });
  }
  return groups;
}

/** A split side's outcomes per 100 decisions, under its new served name or the old one (a rename, never two concepts). */
export function outcomesPer100(side: StrategySplit["inside"]): number | null {
  return side.outcomesPer100Decisions ?? side.ratePct ?? null;
}

/** A mark colour per outcome, fixed by its key (a display tint, the way GTM Factory tints each place; no figure). */
// hex, the form CatalogueMark tints with; the keel data hues
const OUTCOME_TINTS = ["#7c5cff", "#0d9488", "#d97706", "#0284c7", "#e11d48", "#65a30d"];
export function outcomeTint(outcome: string): string {
  let h = 0;
  for (let i = 0; i < outcome.length; i++) h = (h * 31 + outcome.charCodeAt(i)) >>> 0;
  return OUTCOME_TINTS[h % OUTCOME_TINTS.length]!;
}
