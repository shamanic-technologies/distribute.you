import { useMutation } from "@tanstack/react-query";
import {
  getLeadStepStatements,
  setLeadStepStatement,
  type LeadStepName,
  type LeadStepStatements,
} from "./api";
import type { LeadStageKey, LeadStageState } from "./lead-funnel-stages";
import { useAuthQuery, useQueryClient } from "./use-auth-query";

/**
 * Per-lead funnel step statements — the read behind the panel, and the write it makes.
 *
 * Keyed on the leads_campaigns ROW id (what a table row carries), not on the person:
 * the row is what carries the campaign, and a statement made from a campaign screen has
 * to be attributable to that campaign rather than only to the brand.
 *
 * NOT polled. Nothing else in the fleet writes these — a statement arrives because
 * somebody in this session made it, or because the conversion tracker fired, and the
 * tracker's own arrivals reach the panel through the `/revenue` join the page already
 * polls. A second poll per open lead panel would buy nothing and cost a request every
 * thirty seconds per reader.
 */
export function leadStepStatementsQueryKey(leadRowId: string) {
  return ["leadStepStatements", leadRowId] as const;
}

export function useLeadStepStatements(leadRowId: string | null) {
  return useAuthQuery<LeadStepStatements>(
    leadStepStatementsQueryKey(leadRowId ?? "none"),
    () => getLeadStepStatements(leadRowId as string),
    { enabled: leadRowId != null },
  );
}

export function useSetLeadStepStatement(leadRowId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    // `costCents` is what the leg cost the CUSTOMER and is REQUIRED on every statement:
    // the legs the platform does not automate are worked by their own team, so they are
    // the only one who knows. Zero is a legitimate answer and absent is a refusal, so the
    // control asks rather than defaulting.
    //
    // `valueCents` is what the outcome was worth. Optional on the wire because most
    // stages carry no amount — but lead-service REFUSES a sale without one, so the
    // control that states a sale always sends it rather than letting the person meet
    // a refusal it could have asked about.
    { step: LeadStepName; kind: "outcome" | "never"; costCents: number; valueCents?: number }
  >({
    mutationFn: (input) => setLeadStepStatement(leadRowId as string, input),
    onSuccess: () => {
      // Re-read rather than patch the cache by hand. lead-service decides more than the
      // one field that was written — an outcome can supersede an earlier `never`, and it
      // stamps the source, the user and the time — so reconstructing the new state here
      // would be this app guessing at the producer's own answer.
      queryClient.invalidateQueries({ queryKey: leadStepStatementsQueryKey(leadRowId ?? "none") });
      // The brand's outcome counts move on the next read of the revenue join, which is
      // what the stat cards above the table render. Invalidate the ROOT: the same money
      // is asked for at several grains under different keys, and a statement changes all
      // of them.
      queryClient.invalidateQueries({ queryKey: ["featureRevenue"] });
    },
  });
}

/**
 * The served per-step states, as the panel's map.
 *
 * A step the producer did not mention is simply absent, which the panel already reads as
 * pending — the same statement, so nothing is fabricated to fill the gap. `pending` rows
 * are dropped for the same reason: an explicit pending and an absent one mean the same
 * thing, and carrying both invites a caller to tell them apart.
 */
/**
 * What each stated outcome was WORTH, in cents, as the panel's map.
 *
 * Absent when nobody said, and absent is not zero: a deal worth nothing and a deal
 * nobody priced are the two things the producer's new refusal exists to keep apart, so
 * nothing is filled in here either.
 */
export function stageValuesFrom(
  data: LeadStepStatements | undefined,
): Partial<Record<LeadStageKey, number | null>> {
  const out: Partial<Record<LeadStageKey, number | null>> = {};
  for (const entry of data?.steps ?? []) {
    if (entry.state !== "outcome" || typeof entry.valueCents !== "number") continue;
    const key = (entry.step === "purchase" ? "sale" : entry.step) as LeadStageKey;
    out[key] = entry.valueCents;
  }
  return out;
}

export function stageStatesFrom(
  data: LeadStepStatements | undefined,
): Partial<Record<LeadStageKey, LeadStageState>> {
  const out: Partial<Record<LeadStageKey, LeadStageState>> = {};
  for (const entry of data?.steps ?? []) {
    if (entry.state === "pending") continue;
    // The producer serves a legacy "purchase" spelling beside "sale"; both name the
    // terminal paid step, and the panel knows it as "sale".
    const key = (entry.step === "purchase" ? "sale" : entry.step) as LeadStageKey;
    out[key] = entry.state;
  }
  return out;
}

/**
 * Which stages the CHAIN concluded rather than a person stating (lead-service v0.60.0).
 *
 * A funnel is a chain: a "never" makes every later step never, an outcome makes every
 * earlier one reached. Those steps are real answers and render as such — but nobody
 * said them, so they carry no author and no date, and offering a control on one would
 * invite somebody to "state" a thing that is already concluded and would move on its own
 * the moment the statement behind it changed.
 *
 * A producer that has not shipped `origin` yet reports nothing implied, which is exactly
 * how this read behaved before the chain existed.
 */
export function impliedStages(
  data: LeadStepStatements | undefined,
): Partial<Record<LeadStageKey, boolean>> {
  const out: Partial<Record<LeadStageKey, boolean>> = {};
  for (const entry of data?.steps ?? []) {
    if (entry.origin !== "implied") continue;
    const key = (entry.step === "purchase" ? "sale" : entry.step) as LeadStageKey;
    out[key] = true;
  }
  return out;
}

/**
 * The steps of this lead's chain, in the producer's order, or null when it did not say.
 *
 * Read from the producer rather than resolved here: it takes the funnel from
 * campaign-service and refuses (409) a campaign that states none, so this is the one
 * answer that cannot drift from what the campaign actually sells.
 */
export function chainStepsFrom(data: LeadStepStatements | undefined): LeadStageKey[] | null {
  if (!data?.chain) return null;
  return data.chain.map((s) => (s === "purchase" ? "sale" : s) as LeadStageKey);
}
