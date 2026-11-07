import { z } from "zod";

/**
 * REVENUE GENERATED (owner 2026-11-07, REVENUE-GENERATED-1107: « le principal chiffre [est] le réel
 * revenu généré, et seulement secondaire est le expected. Idem avec la curve solid or dotted »):
 * features-service's `revenueGenerated` block on `GET /offers/:offerId/revenue`, since inception, net.
 *
 * REAL = the realized return's own deals, dated (`realUsd` is `costEconomics.realizedReturn
 * .closedWonRevenueUsd`, so it agrees with "N paid clients" under the ROI). EXPECTED = the served
 * `expectedReturn.roiMultiple` × spend, so expected ÷ spent IS the expected ROI on the same screen.
 * The browser sums and divides nothing: it prints these figures and draws these points.
 *
 * `.nullish()` on the body field while features-service ships it (additive). Alias-free (zod is a
 * package) so it carries real unit tests.
 */
export const RevenueGeneratedSchema = z
  .object({
    realUsd: z.number().nullable(),
    paidClientCount: z.number().nullable(),
    realUnavailableReason: z.string().nullable(),
    spentUsd: z.number(),
    expectedToDateUsd: z.number().nullable(),
    expectedUsd: z.number().nullable(),
    expectedUnavailableReason: z.string().nullable(),
    expectedHorizonDays: z.number(),
    expectedFlatReason: z.string().nullable(),
    points: z.array(
      z
        .object({
          date: z.string(),
          kind: z.enum(["measured", "expected"]),
          realCumulativeUsd: z.number().nullable(),
          expectedCumulativeUsd: z.number().nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type RevenueGenerated = z.infer<typeof RevenueGeneratedSchema>;
export type RevenueGeneratedPoint = RevenueGenerated["points"][number];

/** Why the real figure is missing, in one short line. */
export function realUnavailableWords(reason: string | null): string {
  if (reason === "closed_deals_not_read") return "Your sales could not be read yet.";
  return "Not available yet.";
}

/**
 * The two lines to draw, in the served points' own coordinates (index, value): real revenue solid
 * over the measured days, expected revenue dotted over every day that carries one. Pure selection.
 */
export function revenueLines(points: RevenueGeneratedPoint[]): {
  real: Array<[number, number]>;
  expected: Array<[number, number]>;
} {
  const real: Array<[number, number]> = [];
  const expected: Array<[number, number]> = [];
  points.forEach((p, i) => {
    if (p.kind === "measured" && p.realCumulativeUsd != null) real.push([i, p.realCumulativeUsd]);
    if (p.expectedCumulativeUsd != null) expected.push([i, p.expectedCumulativeUsd]);
  });
  return { real, expected };
}
