import { z } from "zod";
import { formatRatePct } from "./pipe-stats";

/**
 * A campaign's change log (features-service CAMPAIGN-CHANGE-LOG-1119, `changes`): each change made on the campaign,
 * dated, who made it, and its measured result with a verdict. Everything is SERVED (rates, change %, verdict, the day
 * it can be measured): this module parses and words, it computes no figure. Alias-free on purpose (unit-tested).
 */

const StepSchema = z.object({ outcomeKey: z.string(), label: z.string() }).passthrough();
const SideSchema = z
  .object({ scriptDynasty: z.string().nullable(), version: z.string().nullable(), value: z.string().nullable(), label: z.string() })
  .passthrough();
const WindowSchema = z
  .object({ fromDay: z.string().nullable(), toDay: z.string().nullable(), decisions: z.number(), cases: z.number(), rate: z.number().nullable() })
  .passthrough();

export const CHANGE_VERDICTS = ["worked", "partial", "did_not_work", "inconclusive", "too_early", "confounded"] as const;
export type ChangeVerdict = (typeof CHANGE_VERDICTS)[number];

const ResultSchema = z
  .object({
    step: StepSchema.nullable(),
    before: WindowSchema.nullable(),
    after: WindowSchema.nullable(),
    changePct: z.number().nullable(),
    probabilityBetter: z.number().nullable(),
    verdict: z.enum(CHANGE_VERDICTS),
    // A reason added later by the producer must not blank the whole list: words fall back to a neutral line.
    verdictReason: z.string(),
    measuredOn: z.string().nullable(),
    confoundedWith: z.array(z.string()),
  })
  .passthrough();

const ChangeSchema = z
  .object({
    id: z.string(),
    at: z.string(),
    date: z.string(),
    kind: z.string(),
    engine: StepSchema.nullable(),
    from: SideSchema.nullable(),
    to: SideSchema.nullable(),
    summary: z.string(),
    who: z.enum(["our_ai", "a_person", "our_system"]).nullable(),
    reason: z.string().nullable(),
    result: ResultSchema,
  })
  .passthrough();
export type CampaignChange = z.infer<typeof ChangeSchema>;

export const CampaignChangesSchema = z
  .object({
    brandId: z.string(),
    salesFunnelCampaignId: z.string(),
    computedAt: z.string(),
    total: z.number(),
    nextCursor: z.string().nullable(),
    changes: z.array(ChangeSchema),
  })
  .passthrough();
export type CampaignChanges = z.infer<typeof CampaignChangesSchema>;

/** Who made a change, from the producer's evidence; null = the record does not say, so nothing is shown. */
export function whoWords(who: CampaignChange["who"]): string | null {
  if (who === "our_ai") return "Our AI";
  if (who === "a_person") return "You or our team";
  if (who === "our_system") return "Our system";
  return null;
}

/** A served UTC day ("2026-12-05") as "Dec 5"; the year joins when it is not the reference year. */
export function dayWords(day: string, referenceIso?: string): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  const refYear = referenceIso ? new Date(referenceIso).getUTCFullYear() : d.getUTCFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(d.getUTCFullYear() !== refYear ? { year: "numeric" } : {}),
  });
}

/** A served rate (a fraction) printed as the dashboard prints every rate: whole %, a decimal only below 1%. */
export function rateWords(rate: number | null): string | null {
  return rate == null ? null : formatRatePct(rate * 100);
}

/** The served change in % ("+12%", "-30%"), rounded for display only. */
export function changePctWords(pct: number | null): string | null {
  if (pct == null) return null;
  const r = Math.round(pct);
  return `${r > 0 ? "+" : ""}${r}%`;
}

export type VerdictTone = "good" | "partial" | "bad" | "neutral";

/** The verdict pill: its words and tone. Too early names the day it can be measured. */
export function verdictPill(result: CampaignChange["result"], referenceIso?: string): { label: string; tone: VerdictTone } {
  switch (result.verdict) {
    case "worked":
      return { label: "Worked", tone: "good" };
    case "partial":
      return { label: "Partly worked", tone: "partial" };
    case "did_not_work":
      return { label: "Didn't work", tone: "bad" };
    case "too_early":
      return { label: result.measuredOn ? `Measured on ${dayWords(result.measuredOn, referenceIso)}` : "Too early to tell", tone: "neutral" };
    case "confounded":
      return { label: "Overlaps another change", tone: "neutral" };
    default:
      return { label: "Inconclusive", tone: "neutral" };
  }
}

/** Why an Inconclusive change could not be judged, in plain words; an unknown reason gets a neutral line. */
export function inconclusiveWords(reason: string): string {
  switch (reason) {
    case "no_downstream_step_measured":
      return "We do not measure a later step for this yet.";
    case "no_decisions_after":
      return "Nothing ran after this change.";
    case "nothing_before_to_compare":
      return "Nothing ran before it to compare with.";
    case "thin_evidence":
      return "Too few results to tell yet.";
    default:
      return "Not enough data to tell yet.";
  }
}
