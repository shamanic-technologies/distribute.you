import { z } from "zod";

/**
 * features-service's EXPECTED return (v0.179.147+, owner 2026-10-11: "on devrait toujours avoir
 * une valeur même expected"). Served beside every measured ROI: the scope's own mature return
 * when it has one (basis `measured`), else its sales path priced on named hypotheses. The
 * measured figure and its maturity verdict are unchanged; this is what a surface states where the
 * measured one is still Learning or null. The browser picks which one to print and computes
 * nothing.
 *
 * Alias-free (zod is a package) so it carries real unit tests.
 */
export const ExpectedReturnSchema = z
  .object({
    roiMultiple: z.number().nullable(),
    // measured < stated < fleet < default, the weakest input. Read as a string: the producer owns it.
    basis: z.string().nullable(),
    costPerOutcome: z
      .object({ costPerOutcomeUsd: z.number(), stepKey: z.string(), basis: z.string() })
      .passthrough()
      .nullable()
      .optional(),
    unavailableReason: z.string().nullable(),
  })
  .passthrough();
export type ExpectedReturn = z.infer<typeof ExpectedReturnSchema>;

/** features-service's EXPECTED % Conversion of a ladder row: the measured one, else a named hypothesis. */
export const ExpectedConversionSchema = z
  .object({
    ratePct: z.number().nullable(),
    basis: z.string().nullable(),
    unavailableReason: z.string().nullable(),
  })
  .passthrough();
export type ExpectedConversion = z.infer<typeof ExpectedConversionSchema>;

/** What a ROI surface prints: the measured value, else the expected one, else why neither. */
export interface RoiToShow {
  value: number | null;
  /** True when `value` is the expected figure standing in for a measured one still Learning. */
  expected: boolean;
  /** The producer's reason when no figure at all is served. */
  reason: string | null;
}

/**
 * The measured return when the producer states one (`shownReturn` gave a value, not Learning),
 * else the served expected return. A mature measured return is also what the expected figure
 * serves (basis `measured`), so the two never disagree on a mature scope.
 */
export function roiToShow(
  shown: { learning: boolean; value: number | null },
  expected: ExpectedReturn | null | undefined,
): RoiToShow {
  if (!shown.learning && shown.value != null) return { value: shown.value, expected: false, reason: null };
  if (expected?.roiMultiple != null) return { value: expected.roiMultiple, expected: expected.basis !== "measured", reason: null };
  return { value: null, expected: false, reason: expected?.unavailableReason ?? null };
}

/**
 * The expected cost of ONE outcome where the measured one is Learning or null: only when the
 * served figure buys the outcome this cell prices (`conversation` = a positive reply,
 * `website_visit` = a visit). In cents, the unit every cost cell formats.
 */
export function costToShowCents(
  shown: { learning: boolean; value: number | null },
  expected: ExpectedReturn | null | undefined,
  stepKey: "conversation" | "website_visit",
): { cents: number | null; expected: boolean } {
  if (!shown.learning && shown.value != null) return { cents: shown.value, expected: false };
  const c = expected?.costPerOutcome;
  if (c && c.stepKey === stepKey) return { cents: Math.round(c.costPerOutcomeUsd * 100), expected: true };
  return { cents: null, expected: false };
}

/** A served "no expected figure" reason in words. One we have no words for is logged and shown plainly. */
export function expectedReasonWords(reason: string | null): string {
  switch (reason) {
    case "expected_model_computing":
      return "Computing";
    case "no_priced_sales_path":
      return "No priced path yet";
    case "expected_model_unavailable":
      return "Not available";
    case null:
      return "—";
    default:
      console.error("[expected-return] no words for reason", { reason });
      return reason.replace(/_/g, " ");
  }
}
