/**
 * A lead that WENT COLD: stuck at a step for longer than lead-service's window while
 * the brand's own CRM, connected and readable, shows nothing happening.
 *
 * lead-service derives it (sales-lead-service#608) and serves it on the lead's own
 * standing as `standing.wentCold`, and features-service prices a cold lead's later
 * steps at zero. This file only READS it: the rule, the window and whether it applies
 * to a brand at all (no CRM, nothing goes cold) are the producer's, so nothing here
 * counts days or re-derives a step.
 *
 * The board card and the lead panel both read it through `leadWentCold`, so the two
 * cannot describe one lead two ways — and neither can describe as live a lead the
 * pipeline beside them values at zero.
 *
 * Alias-free on purpose so it carries real unit tests. Keep it that way.
 */

export interface LeadWentCold {
  /** The step the lead never reached: `meeting_booked` or `meeting_attended`. */
  step: string;
  /** When it went cold, ISO. Null when the producer states none. */
  since: string | null;
  /** How many days of silence the producer waited. Null when it states none. */
  afterDays: number | null;
}

/**
 * The cold fact off a lead's standing, or null.
 *
 * Read tolerantly: the standing object rides the envelope's passthrough, and a body
 * written before lead-service shipped the field carries none — which means the lead is
 * not cold, never that we could not tell. A present object without a step string is not
 * a fact we can state, so it reads as null too.
 */
export function leadWentCold(standing: unknown): LeadWentCold | null {
  if (!standing || typeof standing !== "object") return null;
  const raw = (standing as { wentCold?: unknown }).wentCold;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { step?: unknown; since?: unknown; afterDays?: unknown };
  if (typeof r.step !== "string" || !r.step) return null;
  return {
    step: r.step,
    since: typeof r.since === "string" ? r.since : null,
    afterDays: typeof r.afterDays === "number" && Number.isFinite(r.afterDays) ? r.afterDays : null,
  };
}

/** The short tag the board card wears. */
export const WENT_COLD_LABEL = "Went cold";

/**
 * The sentence that says WHY, in the customer's words. A step the rule does not name
 * (the producer can widen it) still gets an honest sentence rather than a blank.
 */
export function wentColdReason(cold: LeadWentCold): string {
  const days = cold.afterDays != null ? `${cold.afterDays} days` : "a month";
  if (cold.step === "meeting_booked") {
    return `No meeting booked ${days} after their positive reply, and your CRM shows none. It no longer counts in your pipeline.`;
  }
  if (cold.step === "meeting_attended") {
    return `The meeting did not happen within ${days} of its date, and your CRM shows no show-up. It no longer counts in your pipeline.`;
  }
  return `Nothing has moved for ${days}, and your CRM shows nothing. It no longer counts in your pipeline.`;
}
