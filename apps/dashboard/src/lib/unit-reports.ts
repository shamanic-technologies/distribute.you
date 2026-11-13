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
 * Units the dashboard names:
 * - a value we drafted (offer or brand field): the Unit brand-service states beside it
 *   (`draftUnit`: `offer_fields_drafted` / the offer, `brand_fields_drafted` / the brand), sent
 *   as served, `unitAt` included. Never built here: a draft naming no Unit sends no report.
 * - `message_written` / lead-service / the LEAD id: a message we wrote one person.
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

/** One stored report as features-service serves it back (`GET /orgs/unit-reports`, newest first). */
export const UnitReportRowSchema = z
  .object({
    id: z.string(),
    outcomeKey: z.string(),
    subjectService: z.string(),
    subjectId: z.string(),
    kind: z.string(),
    note: z.string().nullish(),
    unitAt: z.string().nullish(),
    reportedAt: z.string(),
  })
  .passthrough();
export const UnitReportListSchema = z.object({ reports: z.array(UnitReportRowSchema) }).passthrough();
export type UnitReportRow = z.infer<typeof UnitReportRowSchema>;

/**
 * Was the message sent at `sentAt` reported? A `reported` report of `message_written` whose
 * `unitAt` is that same instant. A report stored without `unitAt` names no message: it marks none.
 */
export function isMessageReported(reports: readonly UnitReportRow[] | undefined, sentAt: string | null | undefined): boolean {
  if (!reports || !sentAt) return false;
  const at = Date.parse(sentAt);
  if (Number.isNaN(at)) return false;
  return reports.some((r) => r.kind === "reported" && r.outcomeKey === "message_written" && r.unitAt != null && Date.parse(r.unitAt) === at);
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
 * The Unit one draft of ours made, as brand-service states it beside each drafted value
 * (`fields[key].draftUnit` on the user-fields reads, `drafts[key].draftUnit` on a suggest read).
 */
export const DraftUnitSchema = z
  .object({
    outcomeKey: z.string().min(1),
    subjectService: z.string().min(1),
    subjectId: z.string().min(1),
    unitAt: z.string().min(1),
  })
  .passthrough();
export type DraftUnit = z.infer<typeof DraftUnitSchema>;

/** A served `draftUnit` read loosely: anything that is not a whole Unit names none. */
export function draftUnitOf(raw: unknown): DraftUnit | null {
  const parsed = DraftUnitSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** One value as the page last knew it: is it still our draft, and which Unit made that draft. */
export interface DraftedField {
  value: FieldValue;
  stillOurDraft?: boolean;
  draftUnit?: DraftUnit | null;
}
export type DraftedFields = Record<string, DraftedField | undefined>;

/** One report to send: the Unit of one draft, and the fields of it this save changed. */
export interface DraftedEdit {
  unit: UnitRef;
  keys: string[];
}

/**
 * Did this save change a value WE drafted? `before` = the fields as the page knew them before
 * the save, `sent` = what the save writes. A field counts when it was still our draft
 * (`stillOurDraft`), names its Unit (`draftUnit`), held a value, and the save changes that value.
 * A value the client typed, a draft naming no Unit, or a save that changes nothing counts for
 * nothing. ONE entry per Unit (fields of one draft share it), named exactly as served.
 */
export function draftedEdits(before: DraftedFields | undefined, sent: Record<string, FieldValue>): DraftedEdit[] {
  if (!before) return [];
  const edits: DraftedEdit[] = [];
  for (const key of Object.keys(sent)) {
    const was = before[key];
    const unit = was?.stillOurDraft === true ? draftUnitOf(was.draftUnit) : null;
    if (!was || !unit || lines(was.value).length === 0 || sameFieldValue(was.value, sent[key])) continue;
    const same = edits.find(
      (e) => e.unit.outcomeKey === unit.outcomeKey && e.unit.subjectService === unit.subjectService && e.unit.subjectId === unit.subjectId && e.unit.unitAt === unit.unitAt,
    );
    if (same) same.keys.push(key);
    else edits.push({ unit: { outcomeKey: unit.outcomeKey, subjectService: unit.subjectService, subjectId: unit.subjectId, unitAt: unit.unitAt }, keys: [key] });
  }
  return edits;
}

/**
 * What a page holding its own copy (onboarding) knows after a save: each key sent now holds the
 * value sent, and is still our draft only if the save changed nothing. A changed value is the
 * client's own from then on, so confirming the same step again reports nothing more.
 */
export function draftedAfterSave(before: DraftedFields, sent: Record<string, FieldValue>): DraftedFields {
  const next: DraftedFields = { ...before };
  for (const key of Object.keys(sent)) {
    const was = before[key];
    const kept = !!was && was.stillOurDraft === true && sameFieldValue(was.value, sent[key]);
    next[key] = kept ? was : { value: sent[key], stillOurDraft: false, draftUnit: null };
  }
  return next;
}

/** The note sent with an edit: which fields changed, so the store says what was edited. */
export function editedNote(keys: readonly string[]): string {
  return `Edited: ${keys.join(", ")}`;
}
