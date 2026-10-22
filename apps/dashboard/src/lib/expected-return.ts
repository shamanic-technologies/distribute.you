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
  /** True when `value` is the expected figure standing in for a measured one (none measured yet). */
  expected: boolean;
  /** The producer's reason when no figure at all is served. */
  reason: string | null;
  /**
   * True when `value` is the figure MEASURED so far on a scope still Learning: printed greyed,
   * with `expectedValue` beside it (owner 2026-10-19: "plus de learning qui offusque la data").
   */
  learning?: boolean;
  /** The served expected figure, stated beside a Learning measured value. */
  expectedValue?: number | null;
}

/** A Learning scope's measured figure so far, as `shownFigure` carries it. */
type Shown = { learning: boolean; value: number | null; toDate?: number | null };

/**
 * The measured return when the producer states one (`shownReturn` gave a value, not Learning).
 * Still Learning: the return MEASURED so far, greyed, with the served expected return beside it
 * (owner 2026-10-19). Nothing measured: the served expected return, ALWAYS flagged expected:
 * standing in for a scope that is still Learning, it is not this scope's measured figure even
 * when its basis says `measured` (a campaign group served its channel's measured return, 44
 * campaigns at one 1.57x, 2026-10-11).
 */
export function roiToShow(shown: Shown, expected: ExpectedReturn | null | undefined): RoiToShow {
  if (!shown.learning && shown.value != null) return { value: shown.value, expected: false, reason: null };
  const exp = expected?.roiMultiple ?? null;
  if (shown.learning && shown.toDate != null) {
    return { value: shown.toDate, expected: false, reason: null, learning: true, expectedValue: exp };
  }
  if (exp != null) return { value: exp, expected: true, reason: null };
  return { value: null, expected: false, reason: expected?.unavailableReason ?? null };
}

/** What a cost-per-outcome cell prints, in cents (see `roiToShow`). */
export interface CostToShow {
  cents: number | null;
  /** True when `cents` is the expected figure standing in for a measured one. */
  expected: boolean;
  /** True when `cents` is the cost MEASURED so far on a scope still Learning (printed greyed). */
  learning?: boolean;
  /** The served expected cost, stated beside a Learning measured one. */
  expectedCents?: number | null;
}

/**
 * The cost of ONE outcome: measured when stated; still Learning, the cost measured so far
 * (greyed) with the served expected one beside it; nothing measured, the expected one. The
 * expected figure is read only when it buys the outcome this cell prices (`conversation` = a
 * positive reply, `website_visit` = a visit). In cents, the unit every cost cell formats.
 */
export function costToShowCents(
  shown: Shown,
  expected: ExpectedReturn | null | undefined,
  stepKey: "conversation" | "website_visit",
): CostToShow {
  if (!shown.learning && shown.value != null) return { cents: shown.value, expected: false };
  const c = expected?.costPerOutcome;
  const exp = c && c.stepKey === stepKey ? Math.round(c.costPerOutcomeUsd * 100) : null;
  if (shown.learning && shown.toDate != null) return { cents: shown.toDate, expected: false, learning: true, expectedCents: exp };
  if (exp != null) return { cents: exp, expected: true };
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
    // The fleet ranking's `figures` (features-service RESEARCH-WF-FIGURES-1022).
    case "no_return_on_pipe":
      return "No return on this pipe yet";
    case "no_outcome_on_pipe":
      return "No outcome on this pipe yet";
    case "no_conversion_on_pipe":
      return "No conversion on this pipe yet";
    case "net_not_measured_on_pipe":
      return "Not measured on this pipe";
    case null:
      return "—";
    default:
      console.error("[expected-return] no words for reason", { reason });
      return reason.replace(/_/g, " ");
  }
}
