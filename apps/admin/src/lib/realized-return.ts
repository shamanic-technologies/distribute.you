import { z } from "zod";

/**
 * features-service's REALIZED return (`costEconomics.realizedReturn`, ROI-CONSISTENCY-1103):
 * revenue of the Paid clients our outreach caused, over money actually SPENT, whole history.
 * One of the only two returns a screen may show (owner 2026-11-03); the other is the
 * EXPECTED return (`lib/expected-return.ts`). Every pipeline-based ROI is retired.
 *
 * `spentUsd` is `.nullish()` while features-service ships it (additive); `roiMultiple` is
 * null when nothing was spent yet. The browser divides nothing: it prints these figures.
 *
 * Alias-free (zod is a package) so it carries real unit tests.
 */
export const RealizedReturnSchema = z
  .object({
    closedWonCount: z.number(),
    closedWonRevenueUsd: z.number(),
    roiMultiple: z.number().nullable(),
    spentUsd: z.number().nullish(),
  })
  .passthrough();
export type RealizedReturn = z.infer<typeof RealizedReturnSchema>;

/**
 * The basis word of an EXPECTED return: `measured` when the producer priced it on this scope's
 * own results, else `Learning` (stated / fleet / default hypotheses). Read, never re-graded.
 */
export function expectedBasisWord(basis: string | null | undefined): "measured" | "Learning" {
  return basis === "measured" ? "measured" : "Learning";
}

/** "1 paid client" / "3 paid clients". */
export function paidClientsWords(count: number): string {
  return `${count} paid ${count === 1 ? "client" : "clients"}`;
}
