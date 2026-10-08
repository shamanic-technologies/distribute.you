import { useMutation } from "@tanstack/react-query";
import { setLeadStepStatement, withdrawLeadStepStatement, type LeadStepName } from "./api";
import { useQueryClient } from "./use-auth-query";
import { invalidateLeadOutcome } from "./write-invalidation";

/**
 * Per-lead step statements: the write a person makes about one lead.
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

/**
 * The write, for a surface whose target lead is decided at press time: the row id
 * rides in the mutation variables. The cost is mandatory, the answer is re-read rather
 * than hand-patched into the cache, and every root is invalidated because one
 * statement moves the money at several grains.
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
      // Whether OUR outreach caused it. OMITTING it records the producer's `null`,
      // which reads as "nobody was asked" — a real third answer, so a caller with no
      // way to ask leaves it out rather than guessing either way.
      causedByOutreach?: boolean;
      // A restatement REPLACES the statement: a caller correcting one value re-sends the
      // date and note it read, or the win moves to today and loses its note.
      note?: string;
      occurredAt?: string;
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


/** Take back a person's statement on one step ("not a client after all"); same re-reads as a write. */
export function useWithdrawLeadStepStatement() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { leadRowId: string; step: LeadStepName }>({
    mutationFn: ({ leadRowId, step }) => withdrawLeadStepStatement(leadRowId, step),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: leadStepStatementsQueryKey(variables.leadRowId) });
      invalidateLeadOutcome(queryClient);
    },
  });
}
