import { useMutation } from "@tanstack/react-query";
import { setLeadFollowupNow } from "./api";
import { useQueryClient } from "./use-auth-query";

/**
 * Bring the next follow-up to one person forward to now.
 *
 * Keyed on the leads_campaigns ROW id, like every other per-lead write here: the debt is
 * a property of the (person, campaign) pair, and a button pressed on a campaign's panel
 * has to move THAT campaign's schedule rather than the person's other ones.
 *
 * There is no read hook beside it. What the panel renders comes from the lead's HISTORY,
 * which lead-service already assembles and which the panel already fetches — a second
 * per-lead poll for a field that arrives inside the first one would buy nothing.
 */
export function useFollowUpNow(leadRowId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, void>({
    mutationFn: () => setLeadFollowupNow(leadRowId as string),
    onSuccess: () => {
      // Re-read the history rather than patch the line by hand. Moving the due date adds
      // a row to the timeline and changes the schedule's own state, and reconstructing
      // both here would be this app guessing at the producer's answer — the same rule
      // that keeps every other ordering decision out of the browser.
      //
      // Every scope of the history is invalidated, not the one key this hook was given:
      // the same lead is read at campaign scope and at brand scope under different keys,
      // and leaving one stale is how the two panels come to state different dates for one
      // person.
      queryClient.invalidateQueries({ queryKey: ["leadHistory"] });
    },
  });
}
