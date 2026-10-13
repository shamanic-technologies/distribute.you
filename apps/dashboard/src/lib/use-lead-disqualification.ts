import { useMutation } from "@tanstack/react-query";
import { removeLeadDisqualification, setLeadDisqualification } from "./api";
import type { DisqualificationLevel } from "./lead-disqualification";
import { useQueryClient } from "./use-auth-query";

/**
 * Every read that shows the Disqualified mark: the lead row (page, list, board cards), the
 * conversation timeline (person page, Unibox) and the brand's list of marked people (the
 * board's Disqualified column). The answer is re-read, never hand-patched into the cache.
 */
export const DISQUALIFICATION_ROOTS = ["leadDetail", "leadTimeline", "leadsPage", "leadDisqualifications"] as const;
// A company mark moves every lead of the company: the same roots cover them (every row re-read).

function useInvalidateDisqualification() {
  const queryClient = useQueryClient();
  return () => {
    for (const root of DISQUALIFICATION_ROOTS) queryClient.invalidateQueries({ queryKey: [root] });
  };
}

/** Mark a lead, or its whole company, Disqualified (optional note). `offerId` absent = every offer. */
export function useSetLeadDisqualification() {
  const invalidate = useInvalidateDisqualification();
  return useMutation<unknown, Error, { leadRowId: string; brandId: string; offerId?: string; note?: string; level: DisqualificationLevel }>({
    mutationFn: ({ leadRowId, ...body }) => setLeadDisqualification(leadRowId, body),
    onSuccess: invalidate,
  });
}

/** Remove the person's own mark or the company's (`offerId` null = every mark at the brand). */
export function useRemoveLeadDisqualification() {
  const invalidate = useInvalidateDisqualification();
  return useMutation<unknown, Error, { leadRowId: string; brandId: string; offerId: string | null; level: DisqualificationLevel }>({
    mutationFn: ({ leadRowId, ...params }) => removeLeadDisqualification(leadRowId, params),
    onSuccess: invalidate,
  });
}
