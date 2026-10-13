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
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";
import type { TimelineTag } from "./timeline-tags";

export const LeadDisqualificationSchema = z
  .object({
    offerId: z.string().nullable(),
    note: z.string().nullable(),
    // A string, never an enum: lead-service owns the vocabulary and may widen it.
    source: z.string(),
    statedByUserId: z.string().nullable(),
    statedAt: z.string(),
  })
  .passthrough();

export type LeadDisqualification = z.infer<typeof LeadDisqualificationSchema>;

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
});

export type BrandDisqualifications = z.infer<typeof BrandDisqualificationsSchema>;
export type DisqualifiedLead = BrandDisqualifications["leads"][number];

/** The tag, in the "lost" family like Opt out and Wrong contact. */
export const DISQUALIFIED_TAG: TimelineTag = { label: "Disqualified", tone: "lost", icon: "lost" };

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
