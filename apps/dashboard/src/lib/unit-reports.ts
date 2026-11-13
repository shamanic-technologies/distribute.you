/**
 * THE CLIENT SAYS "NOT GOOD" (SCRIPT-VALUE-RATING-1113, owner 2026-11-13).
 *
 * « Chaque fois qu'un user fait un edit, on peut considérer que l'outcome était unsatisfying » ; for
 * what he cannot edit (a message already sent) a discreet Report. No positive vote: silence says
 * nothing. One report = one Unit, named as the runs ledger names it (outcome key, subject service,
 * subject id), through features-service `POST /orgs/unit-reports` (gateway `/v1/features/unit-reports`).
 * The Rating reads a reported Unit as worth nothing for the script that made it; nothing is
 * blocked, hidden, rewritten or re-sent.
 *
 * Units the dashboard can name today (read off `run_outcomes` in prod, 2026-11-13):
 * - `offer_fields_drafted` / brand-service / the offer id (the brand id for a draft asked before
 *   any offer): the offer's fields brand-service's `suggest` mode drafted.
 * - `message_written` / lead-service / the LEAD id: a message we wrote one person.
 * Brand fields (description, ...) are drafted by a support run that declares no Unit: no report.
 *
 * Alias-free (zod only) so it carries real unit tests.
 */
import { z } from "zod";

export const UNIT_REPORT_KINDS = ["edited", "reported"] as const;
export type UnitReportKind = (typeof UNIT_REPORT_KINDS)[number];

/** Where the client said it: the dashboard (free text on the producer's side). */
export const DASHBOARD_REPORT_SOURCE = "dashboard";

export interface UnitRef {
  outcomeKey: string;
  subjectService: string;
  subjectId: string;
  /**
   * When the thing the client points at was made (ISO), so the ledger resolves the Unit standing
   * THEN for that subject, not its latest: a message's send time (one lead, many messages).
   * features-service adds the field (brussels, 2026-11-13); omitted = the subject's latest Unit.
   */
  unitAt?: string;
}

export interface UnitReportBody extends UnitRef {
  kind: UnitReportKind;
  source: string;
  note?: string | null;
}

/** What features-service stored (201). Read loosely: the producer may add fields. */
export const UnitReportResponseSchema = z
  .object({
    id: z.string(),
    outcomeKey: z.string(),
    subjectService: z.string(),
    subjectId: z.string(),
    kind: z.string(),
    reportedAt: z.string(),
  })
  .passthrough();
export type UnitReportResponse = z.infer<typeof UnitReportResponseSchema>;

/** The Unit one offer-fields draft produced (brand-service `offerFieldsDraftedUnit`). */
export function offerFieldsDraftedUnit(brandId: string, offerId: string | null | undefined): UnitRef {
  return { outcomeKey: "offer_fields_drafted", subjectService: "brand-service", subjectId: offerId || brandId };
}

/** The Unit a message we wrote one person is (its subject is the lead, as the ledger declares it), at its send time. */
export function messageWrittenUnit(leadId: string, sentAt: string | null | undefined): UnitRef {
  const unit: UnitRef = { outcomeKey: "message_written", subjectService: "lead-service", subjectId: leadId };
  return sentAt ? { ...unit, unitAt: sentAt } : unit;
}

type FieldValue = string | string[] | null | undefined;

/** One value as comparable lines: a list's items, a text's non-empty lines, all trimmed. */
function lines(v: FieldValue): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : [];
  return raw.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0);
}

export function sameFieldValue(a: FieldValue, b: FieldValue): boolean {
  const x = lines(a);
  const y = lines(b);
  return x.length === y.length && x.every((s, i) => s === y[i]);
}

/**
 * Did this save change a value WE drafted? `before` = the fields as served before the save (each
 * with its provenance), `sent` = what the save writes. Only a field still `suggested` (our prefill,
 * never confirmed) whose value the save changes counts: a field the client typed, or a save that
 * changes nothing, is no edit of ours. A confirmed field is not counted: brand-service does not
 * say whether its value is still our draft (producer gap, relayed 2026-11-13).
 */
export function editedDraftedKeys(
  before: Record<string, { value: FieldValue; provenance: string } | undefined> | undefined,
  sent: Record<string, FieldValue>,
): string[] {
  if (!before) return [];
  return Object.keys(sent).filter((key) => {
    const was = before[key];
    if (!was || was.provenance !== "suggested" || lines(was.value).length === 0) return false;
    return !sameFieldValue(was.value, sent[key]);
  });
}

/**
 * The same question at onboarding, where the draft is held on the page (`drafted`, what the
 * suggest read returned) and the client confirms the step: the keys whose confirmed value differs
 * from a non-empty draft.
 */
export function editedAgainstDraft(drafted: Record<string, FieldValue>, sent: Record<string, FieldValue>): string[] {
  return Object.keys(sent).filter((key) => lines(drafted[key]).length > 0 && !sameFieldValue(drafted[key], sent[key]));
}

/** The note sent with an edit: which fields changed, so the store says what was edited. */
export function editedNote(keys: readonly string[]): string {
  return `Edited: ${keys.join(", ")}`;
}
