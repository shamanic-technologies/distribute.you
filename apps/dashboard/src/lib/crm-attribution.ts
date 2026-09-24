/**
 * WHOSE WIN a step the customer's own CRM evidences was: the read, and the words for it.
 *
 * lead-service reflects a paired CRM contact's meeting booked, meeting attended and won
 * deal onto our lead, and answers per step whether our outreach gets the credit:
 *
 *   - by a DEFAULT RULE (owner-decided): the CRM event happened after our first delivered
 *     email to that person -> ours; before -> not ours; undated, or nothing delivered ->
 *     undecided, never ours;
 *   - or by a PERSON, whose statement outranks the rule and can be withdrawn.
 *
 * Nothing here decides an answer. The rule, the override and which one stands are all
 * lead-service's; this module parses them and names them for a reader. Alias-free (zod and
 * nothing else) so it carries real unit tests.
 */
import { z } from "zod";

/** The steps a CRM can evidence, in the producer's own words. */
export const CRM_ATTRIBUTION_STEPS = ["meeting_booked", "meeting_attended", "sale"] as const;

/** Read as plain strings: every one of these is a producer vocabulary that can grow. */
const EvidenceSchema = z.object({
  crmContactId: z.string().nullish(),
  crmStep: z.string().nullish(),
  occurredAt: z.string().nullish(),
  dateBasis: z.string().nullish(),
  source: z.string().nullish(),
  sourceId: z.string().nullish(),
  valueCents: z.number().nullish(),
});

const RuleSchema = z.object({
  causedByOutreach: z.boolean().nullable(),
  reason: z.string(),
  firstDeliveredAt: z.string().nullish(),
});

const StatementSchema = z
  .object({
    causedByOutreach: z.boolean(),
    note: z.string().nullish(),
    statedAt: z.string().nullish(),
  })
  .passthrough();

export const CrmAttributionStepSchema = z.object({
  step: z.string(),
  evidence: EvidenceSchema.nullable(),
  rule: RuleSchema.nullable(),
  statement: StatementSchema.nullable(),
  causedByOutreach: z.boolean().nullable(),
  basis: z.string().nullable(),
});

export const CrmAttributionSchema = z.object({
  leadCampaignId: z.string(),
  leadId: z.string(),
  brandId: z.string(),
  steps: z.array(CrmAttributionStepSchema),
});

/** A single-step write answers with the step's entry spread beside the lead's ids. */
export const CrmAttributionWriteSchema = CrmAttributionStepSchema.extend({
  leadCampaignId: z.string(),
});

export type CrmAttribution = z.infer<typeof CrmAttributionSchema>;
export type CrmAttributionStep = z.infer<typeof CrmAttributionStepSchema>;

export const CRM_STEP_LABEL: Record<string, string> = {
  meeting_booked: "Meeting booked",
  meeting_attended: "Meeting attended",
  sale: "Close won",
};

/**
 * What their CRM says happened. A `never` (a no-show, a lost deal) is evidence too, and it
 * reads as what it is rather than as the step.
 */
export function crmEvidenceLabel(entry: CrmAttributionStep): string {
  const crmStep = entry.evidence?.crmStep ?? null;
  if (crmStep === "meeting_not_held") return "Meeting did not happen";
  if (crmStep === "deal_lost") return "Deal lost";
  return CRM_STEP_LABEL[entry.step] ?? entry.step;
}

/** Only a step their CRM actually evidences has anything for an answer to be about. */
export function evidencedSteps(data: CrmAttribution | undefined): CrmAttributionStep[] {
  return (data?.steps ?? []).filter((s) => s.evidence != null);
}

/** Why the rule answered what it answered, in a reader's words. Unknown reasons verbatim. */
export function ruleReasonLabel(reason: string | null | undefined): string | null {
  switch (reason) {
    case "after_first_delivery":
      return "It happened after our first email reached them.";
    case "before_first_delivery":
      return "It happened before our first email reached them.";
    case "event_undated":
      return "Their CRM does not say when it happened, so we do not claim it.";
    case "never_delivered":
      return "None of our emails reached them, so we do not claim it.";
    case null:
    case undefined:
      return null;
    default:
      return reason;
  }
}

/** The standing answer, in one word. `null` is undecided, never read as "not ours". */
export function attributionLabel(causedByOutreach: boolean | null): string {
  if (causedByOutreach === true) return "Ours";
  if (causedByOutreach === false) return "Not ours";
  return "Undecided";
}
