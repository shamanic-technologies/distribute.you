import { useMutation } from "@tanstack/react-query";
import {
  getLeadStepStatements,
  setLeadStepStatement,
  withdrawLeadStepStatement,
  type LeadStepName,
  type LeadStepStatements,
} from "./api";
import type { LeadStageKey, LeadStageState } from "./lead-funnel-stages";
import { useAuthQuery, useQueryClient } from "./use-auth-query";
import { invalidateLeadOutcome } from "./write-invalidation";

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
    // `costCents` is what the step cost the CUSTOMER, and lead-service refuses a
    // statement without it (400, code `cost_required`) on BOTH kinds — a meeting that
    // was run and went nowhere still cost what it cost. Required here so a caller has
    // to ask the person rather than defaulting on their behalf; `0` is a legal answer.
    //
    // `valueCents` is what the outcome was WORTH, a different question. Optional on the
    // wire because most stages carry no amount — but lead-service REFUSES a sale
    // without one, so the control that states a sale always sends it rather than
    // letting the person meet a refusal it could have asked about.
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
      // what the stat cards above the table render. EVERY grain of that money is a
      // different key — per channel, per campaign, per offer, per funnel, per brand —
      // plus the per-audience costs and the charts, so all of them are re-read at once
      // rather than the one root this mutation happens to know about.
      invalidateLeadOutcome(queryClient);
    },
  });
}

/**
 * Take back what somebody stated by hand about one step.
 *
 * The undo for the hook above. It is NOT the opposite statement: stating "won't happen"
 * to cancel a mistaken "happened" is itself a false statement, and it keeps counting.
 *
 * The response IS the read's own shape, re-derived by lead-service after the withdrawal,
 * so it is written straight into the cache rather than invalidated. That is not a
 * shortcut — withdrawing one statement moves OTHER steps (a step that only read as
 * reached, or as dead, because of it falls back to what the rest imply, and a "never"
 * this outcome had superseded stands again), and the producer is the only thing that
 * knows which. A re-read would be a second round trip spent learning what it just told
 * us, and it is that wait the panel would sit through.
 */
export function useWithdrawLeadStepStatement(leadRowId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<LeadStepStatements, Error, { step: LeadStepName }>({
    mutationFn: ({ step }) => withdrawLeadStepStatement(leadRowId as string, step),
    onSuccess: (data) => {
      queryClient.setQueryData(leadStepStatementsQueryKey(leadRowId ?? "none"), data);
      // A withdrawn outcome stops being counted and the cost stated for that leg stops
      // counting as the customer's spend, so the same money moves at every grain.
      invalidateLeadOutcome(queryClient);
    },
  });
}

/**
 * The same write, for a surface whose target lead is decided at press time.
 *
 * The lead panel binds one hook to the lead it has open; the BOARD has no open lead —
 * the card a person drags is the target, and holding it in state first so a per-lead
 * hook could be constructed would race the submit. So the row id rides in the mutation
 * variables instead, and everything else is byte-identical to the hook above: the same
 * mandatory cost, the same re-read rather than a hand-patched cache, the same root
 * invalidation because one statement moves the money at several grains.
 */
export function useSetAnyLeadStepStatement() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    {
      leadRowId: string;
      step: LeadStepName;
      kind: "outcome" | "never";
      costCents: number;
      valueCents?: number;
    }
  >({
    mutationFn: ({ leadRowId, ...body }) => setLeadStepStatement(leadRowId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: leadStepStatementsQueryKey(variables.leadRowId) });
      // The board reads which column a card sits in off the SAME revenue join the stat
      // cards poll, so this is what actually moves the card — and every other grain of
      // the money it just changed.
      invalidateLeadOutcome(queryClient);
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

/**
 * What the CUSTOMER said each stated step cost THEM, in cents, as the panel's map.
 *
 * A key is PRESENT with `null` when somebody stated the step and no cost came back with
 * it — a statement made before the cost became mandatory. That is "unanswered", and it
 * must not read as a stated zero, so the two are kept apart by presence rather than by
 * value. A step nobody stated by hand is simply absent: an implied step carries no
 * author, and a tracker knows nothing about a customer's own spend.
 *
 * This is never platform spend. Nothing here is charged, and it belongs nowhere near a
 * credit balance or an invoice.
 */
export function stageCostsFrom(
  data: LeadStepStatements | undefined,
): Partial<Record<LeadStageKey, number | null>> {
  const out: Partial<Record<LeadStageKey, number | null>> = {};
  for (const entry of data?.steps ?? []) {
    if (entry.state === "pending") continue;
    if (entry.origin === "implied") continue;
    if (entry.source !== "manual") continue;
    const key = (entry.step === "purchase" ? "sale" : entry.step) as LeadStageKey;
    out[key] = typeof entry.costCents === "number" ? entry.costCents : null;
  }
  return out;
}

/**
 * Which stages carry a statement a PERSON made, and can therefore be taken back.
 *
 * Three things read as an answer on a step and only one of them is somebody's words: a
 * tracker reported it, the funnel implies it from a statement on another step, or a
 * person stated it. lead-service refuses a withdrawal on the first two (409
 * `not_a_statement` / `nothing_stated`), and the honest surface for a refusal we can
 * predict is not offering the control — so the panel asks this before it makes an
 * active button pressable.
 *
 * Read exactly as `stageCostsFrom` reads it, because it is the same question ("did
 * somebody state this by hand") asked for a different reason. A producer that has not
 * shipped `origin` reports nothing withdrawable, which is how the panel behaved before
 * withdrawal existed.
 */
export function withdrawableStages(
  data: LeadStepStatements | undefined,
): Partial<Record<LeadStageKey, boolean>> {
  const out: Partial<Record<LeadStageKey, boolean>> = {};
  for (const entry of data?.steps ?? []) {
    if (entry.origin !== "stated") continue;
    if (entry.source !== "manual") continue;
    const key = (entry.step === "purchase" ? "sale" : entry.step) as LeadStageKey;
    out[key] = true;
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
 * Which stages the FUNNEL concluded rather than a person stating (lead-service v0.60.0).
 *
 * A funnel is ORDERED: a "never" makes every later step never, an outcome makes every
 * earlier one reached. Those steps are real answers and render as such — but nobody
 * said them, so they carry no author and no date, and offering a control on one would
 * invite somebody to "state" a thing that is already concluded and would move on its own
 * the moment the statement behind it changed.
 *
 * A producer that has not shipped `origin` yet reports nothing implied, which is exactly
 * how this read behaved before the funnel existed.
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
 * The steps of this lead's funnel, in the producer's order, or null when it did not say.
 *
 * Read from `funnelSteps` — lead-service's own name for the funnel's ordered steps.
 *
 * Read from the producer rather than resolved here: it takes the funnel from
 * campaign-service and refuses (409) a campaign that states none, so this is the one
 * answer that cannot drift from what the campaign actually sells.
 */
export function funnelStepsFrom(data: LeadStepStatements | undefined): LeadStageKey[] | null {
  const steps = data?.funnelSteps;
  if (!steps) return null;
  return steps.map((s) => (s === "purchase" ? "sale" : s) as LeadStageKey);
}
