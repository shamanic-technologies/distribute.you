/**
 * "Disqualified", its OWN mark beside the step tags (owner 2026-10-13, lead-service v0.83.59).
 *
 * A person reads "Positive reply" AND "Disqualified" at the same time: the mark never replaces
 * a step tag and never moves a standing (lead-service stopped producing the `disqualified`
 * standing). It is a yes/no + an OPTIONAL free note, set by a person (`manual`) or from a reply
 * judged not our target (`reply`). There is NO list of reasons: never add one here.
 *
 * lead-service owns it end to end:
 *   - every lead row and the conversation timeline carry `disqualification` (null = not marked);
 *   - `GET /v1/leads/disqualifications?brandId=[&offerId=]` lists the marked people + notes;
 *   - `PUT` / `DELETE /v1/leads/{id}/disqualification` set and remove it.
 * This module parses and NAMES it; it never derives the mark.
 *
 * Tags sit at THEIR level (LEAD-REFONTE-1013, lead-service v0.83.65), each read off its own
 * served field, never re-derived here:
 *   - HUMAN (wherever they work): opted out, the standing's `signal: "human_opt_out"`.
 *   - LEAD (this person at this company): the steps, and the lead's own Disqualified mark
 *     (`level: "lead"`, "not the right contact", "left the role").
 *   - COMPANY: the row's `company` block: client, signed up, and its Disqualified mark
 *     (`level: "company"`, "not our target", covering every lead of the company).
 * The row's `disqualification` is the mark that ANSWERS (the lead's own before its company's).
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";
import type { TimelineTag } from "./timeline-tags";

export const LeadDisqualificationSchema = z
  .object({
    // "lead" | "company", a string (lead-service owns the vocabulary). `.optional()`: absent on a
    // payload written before v0.83.65, which only knew the lead level.
    level: z.string().optional(),
    offerId: z.string().nullable(),
    note: z.string().nullable(),
    // A string, never an enum: lead-service owns the vocabulary and may widen it.
    source: z.string(),
    statedByUserId: z.string().nullable(),
    statedAt: z.string(),
  })
  .passthrough();

export type LeadDisqualification = z.infer<typeof LeadDisqualificationSchema>;

/**
 * The company a lead is at, with what is true of it as a BUYER of the brand (lead-service
 * `company-status.ts`): client = a lead of it holds a live sale, signed up = a live signup,
 * and its own Disqualified mark. null = no company known.
 */
export const LeadCompanyBlockSchema = z
  .object({
    id: z.string().nullable(),
    key: z.string(),
    isClient: z.boolean(),
    signedUp: z.boolean(),
    disqualification: LeadDisqualificationSchema.nullish(),
  })
  .passthrough();

export type LeadCompanyBlock = z.infer<typeof LeadCompanyBlockSchema>;

/** The two levels a person can disqualify at. */
export type DisqualificationLevel = "lead" | "company";

/** The mark's served level: a mark with none was written before the company level existed. */
export function disqualificationLevel(mark: LeadDisqualification): DisqualificationLevel {
  return mark.level === "company" ? "company" : "lead";
}

/** The lead's OWN mark, or null when the mark that answers is its company's. */
export function leadLevelMark(mark: LeadDisqualification | null | undefined): LeadDisqualification | null {
  return mark && disqualificationLevel(mark) === "lead" ? mark : null;
}

/** The company's mark: the block's own, else the answering mark when it is the company's. */
export function companyLevelMark(
  company: LeadCompanyBlock | null | undefined,
  answering: LeadDisqualification | null | undefined,
): LeadDisqualification | null {
  if (company?.disqualification) return company.disqualification;
  return answering && disqualificationLevel(answering) === "company" ? answering : null;
}

/** HUMAN level: lead-service decided the standing on an opt-out carried by the person. */
export function humanOptedOut(standing: unknown): boolean {
  return (standing as { signal?: unknown } | null | undefined)?.signal === "human_opt_out";
}

export const BrandDisqualificationsSchema = z.object({
  brandId: z.string(),
  offerId: z.string().nullable(),
  total: z.number(),
  leads: z.array(
    z
      .object({
        id: z.string().nullable(),
        leadId: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        disqualification: LeadDisqualificationSchema,
      })
      .passthrough(),
  ),
  // Companies marked "not our target" (lead-service v0.83.65). `.optional()`: absent before it.
  companyTotal: z.number().optional(),
  companies: z
    .array(
      z
        .object({
          companyKey: z.string(),
          companyId: z.string().nullable(),
          name: z.string().nullable(),
          domain: z.string().nullable(),
          leadCount: z.number(),
          disqualification: LeadDisqualificationSchema,
        })
        .passthrough(),
    )
    .optional(),
});

export type BrandDisqualifications = z.infer<typeof BrandDisqualificationsSchema>;
export type DisqualifiedLead = BrandDisqualifications["leads"][number];
export type DisqualifiedCompany = NonNullable<BrandDisqualifications["companies"]>[number];

/** The tag, in the "lost" family like Opt out and Wrong contact. */
export const DISQUALIFIED_TAG: TimelineTag = { label: "Disqualified", tone: "lost", icon: "lost" };

/** The company-level mark, where the company is not already named beside it (cards, list). */
export const COMPANY_DISQUALIFIED_TAG: TimelineTag = { label: "Company disqualified", tone: "lost", icon: "lost" };

/** The person opted out: holds at every company and every brand. */
export const OPTED_OUT_TAG: TimelineTag = { label: "Opted out", tone: "lost", icon: "lost" };

/** The company bought from the brand. */
export const CLIENT_TAG: TimelineTag = { label: "Client", tone: "won", icon: "money" };

/** Someone at the company signed up to the brand. */
export const SIGNED_UP_TAG: TimelineTag = { label: "Signed up", tone: "hot", icon: "check" };

/** The tag a mark reads as on a surface that does not name the company beside it. */
export function markTag(mark: LeadDisqualification): TimelineTag {
  return disqualificationLevel(mark) === "company" ? COMPANY_DISQUALIFIED_TAG : DISQUALIFIED_TAG;
}

/** The mark a served value carries, or null. Tolerates a payload written before the field. */
export function readDisqualification(raw: unknown): LeadDisqualification | null {
  if (raw === null || raw === undefined) return null;
  const parsed = LeadDisqualificationSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] readDisqualification: unreadable mark", { issues: parsed.error.issues, raw });
    return null;
  }
  return parsed.data;
}

/** Who set it, in words: a reply set it on its own, else a person did. */
export function disqualificationSourceWord(mark: LeadDisqualification): string {
  return mark.source === "reply" ? "Set from their reply" : "Set by hand";
}

/** A typed note, trimmed; blank = no note (the producer refuses nothing for a missing one). */
export function disqualificationNoteBody(note: string): { note?: string } {
  const v = note.trim();
  return v ? { note: v } : {};
}
