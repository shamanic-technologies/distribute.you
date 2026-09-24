/**
 * THE CLIENT'S CRM BESIDE OUR LEADS — lead-service's pairings view, parsed.
 *
 * lead-service pairs each contact of the brand's mirrored CRM with the lead we
 * emailed (if any), states how sure it is and who decided, and puts both sides'
 * statuses next to each other. This module parses that and holds the ONE
 * per-row comparison this page draws. It computes no metric: every count on the
 * page is `/crm-pairing-counts`, verbatim.
 *
 * Alias-free (its only import is zod) so it carries REAL unit tests. Keep it so.
 */
import { z } from "zod";

// ─── Wire ────────────────────────────────────────────────────────────────────

/** Read as plain strings: the producer owns these vocabularies and can widen them. */
const str = z.string();

const OpportunitySchema = z.object({
  id: z.string(),
  externalId: z.string().nullish(),
  name: z.string().nullish(),
  /** The one field of theirs with a fixed meaning. null = a word we do not recognise. */
  state: str.nullish(),
  stateRaw: z.string().nullish(),
  monetaryValue: z.number().nullish(),
  pipelineName: z.string().nullish(),
  /** Their free text. Rendered, never mapped. */
  stageName: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

/** Where the record came from in their CRM, verbatim (crm-service's `record`, carried by lead-service). */
const RecordSchema = z.object({
  type: z.string().nullish(),
  leadSource: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  origin: z
    .object({ medium: z.string().nullish(), url: z.string().nullish(), referrer: z.string().nullish() })
    .nullish(),
});

const CrmSideSchema = z
  .object({
    id: z.string(),
    externalId: z.string().nullish(),
    fullName: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    company: z.string().nullish(),
    unsubscribed: z.boolean(),
    /** Their provenance. Optional so a row predating it still parses. */
    record: RecordSchema.nullish(),
  });

const LeadSideSchema = z.object({
  leadId: z.string(),
  leadCampaignId: z.string(),
  campaignId: z.string(),
  fullName: z.string().nullish(),
  email: z.string().nullish(),
  jobTitle: z.string().nullish(),
  company: z.string().nullish(),
});

const RulingSchema = z.object({
  ruling: str,
  note: z.string().nullish(),
  statedByUserId: z.string().nullish(),
  statedAt: z.string(),
});

const PairingSchema = z.object({
  state: str,
  decidedBy: str.nullish(),
  lead: LeadSideSchema.nullish(),
  evidence: z.object({
    matchMethod: str.nullish(),
    matchConfidence: str,
    candidateCount: z.number(),
    matchedAt: z.string().nullish(),
  }),
  judgment: z.object({
    status: str,
    unavailableReason: str.nullish(),
    samePersonProbability: z.number().nullish(),
    model: z.string().nullish(),
    judgedAt: z.string().nullish(),
  }),
  ruling: RulingSchema.nullish(),
});

const OurStandingSchema = z
  .object({ state: str.nullish(), signal: str.nullish() })
  .passthrough();

export const CrmPairingRowSchema = z.object({
  crmContact: CrmSideSchema,
  pairing: PairingSchema,
  ourStanding: OurStandingSchema.nullish(),
  theirStatus: z.object({
    opportunities: z.array(OpportunitySchema),
    states: z.array(str),
    stageNamesComparable: z.boolean(),
    stageComparabilityReason: z.string().nullish(),
  }),
});

export const CrmPairingsSchema = z.object({
  crmConnected: z.boolean(),
  connection: z
    .object({
      id: z.string(),
      status: z.string(),
      synced: z.boolean(),
      lastSyncedAt: z.string().nullish(),
      lastError: z.string().nullish(),
    })
    .passthrough()
    .nullish(),
  pairings: z.array(CrmPairingRowSchema),
  nextOffset: z.number().nullish(),
  judgmentThresholds: z.object({ pairAt: z.number(), rejectAt: z.number() }),
});

const count = z.number().nullish();

export const CrmPairingCountsSchema = z.object({
  crmConnected: z.boolean(),
  counts: z.object({
    crmContacts: z.number(),
    crmContactsWithEmail: z.number(),
    byState: z.object({ paired: count, unconfirmed: count, rejected: count, unpaired: count }),
    byMatchMethod: z.record(z.string(), z.number().nullish()),
    opportunities: z.number(),
    opportunitiesByState: z.object({
      open: count,
      won: count,
      lost: count,
      abandoned: count,
      unrecognised: count,
    }),
    opportunitiesWithUncomparableStage: z.number(),
  }),
  ourLeadsNoCrmContactPointsAt: z.number(),
});

export type CrmPairingRow = z.infer<typeof CrmPairingRowSchema>;
export type CrmPairings = z.infer<typeof CrmPairingsSchema>;
export type CrmPairingCounts = z.infer<typeof CrmPairingCountsSchema>;
export type CrmOpportunityView = z.infer<typeof OpportunitySchema>;

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const PAIRING_STATES = ["paired", "unconfirmed", "rejected", "unpaired"] as const;

export const PAIRING_STATE_LABEL: Record<string, string> = {
  paired: "In common",
  unconfirmed: "Maybe in common",
  rejected: "Not the same person",
  unpaired: "Only in their CRM",
};

export const DECIDED_BY_LABEL: Record<string, string> = {
  signal: "Matcher",
  judgment: "Similarity model",
  human: "A person",
};

export const MATCH_METHOD_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  domain_name: "Company domain + name",
  full_name: "Full name",
  last_name: "Last name",
  none: "No match",
};

/** Our standing, in the words the Leads pages use. Unknown states read verbatim. */
export const OUR_STATE_LABEL: Record<string, string> = {
  unresolved: "Cannot place",
  not_contacted: "Not contacted",
  contacted: "Contacted",
  engaged: "Engaged",
  sales_interest: "Positive reply",
  customer: "Close won",
  opted_out: "Opted out",
  disqualified: "Disqualified",
};

export const THEIR_STATE_LABEL: Record<string, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  abandoned: "Abandoned",
};

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "None";
  return map[key] ?? key;
}

// ─── The one comparison this page draws ──────────────────────────────────────

/**
 * Whether their CRM and our record agree about this person.
 *
 * Only the fields with a FIXED meaning are compared: their opportunity STATE
 * (open / won / lost / abandoned) against our STANDING. Their stage names are
 * free text per customer and are never mapped (lead-service says so on every
 * row), so a contact whose only signal is a stage name is not comparable.
 *
 *  - `not_in_common` — the pairing is not a confirmed one; nothing to compare.
 *  - `no_deal`       — paired, and their CRM holds no deal for them.
 *  - `behind`        — they closed it WON and we do not record a sale. The point
 *                      of the page.
 *  - `ahead`         — we record a sale they do not.
 *  - `conflict`      — they hold several deals in states that disagree.
 *  - `lost_there`    — they closed it lost or abandoned while we still treat the
 *                      person as in play.
 *  - `aligned`       — both say the same thing.
 *  - `not_comparable`— we hold no standing for the person, or their deal state is
 *                      a word nobody recognised.
 */
export type Alignment =
  | "not_in_common"
  | "no_deal"
  | "behind"
  | "ahead"
  | "conflict"
  | "lost_there"
  | "aligned"
  | "not_comparable";

export const ALIGNMENT_LABEL: Record<Alignment, string> = {
  not_in_common: "Not compared",
  no_deal: "No deal in their CRM",
  behind: "We are behind",
  ahead: "We say won, they do not",
  conflict: "Their deals disagree",
  lost_there: "They closed it lost",
  aligned: "Aligned",
  not_comparable: "Not comparable",
};

/** Which alignments need a person's attention, in the order they are worth reading. */
export const ATTENTION_ORDER: Alignment[] = [
  "behind",
  "ahead",
  "conflict",
  "lost_there",
  "not_comparable",
  "no_deal",
  "aligned",
  "not_in_common",
];

const CLOSED_OURS = new Set(["customer", "disqualified", "opted_out"]);

export function alignmentFor(row: Pick<CrmPairingRow, "pairing" | "ourStanding" | "theirStatus">): Alignment {
  if (row.pairing.state !== "paired") return "not_in_common";
  const opps = row.theirStatus.opportunities;
  if (opps.length === 0) return "no_deal";
  // A deal whose state nobody recognised is not a state, so it cannot agree or
  // disagree with anything.
  const states = new Set(row.theirStatus.states.filter((s) => s in THEIR_STATE_LABEL));
  if (states.size === 0) return "not_comparable";
  const ours = row.ourStanding?.state ?? null;
  if (!ours || ours === "unresolved") return "not_comparable";

  const won = states.has("won");
  const closedLost = states.has("lost") || states.has("abandoned");
  if (won && ours !== "customer") return "behind";
  if (won && closedLost) return "conflict";
  if (won) return "aligned";
  if (ours === "customer") return "ahead";
  if (closedLost && states.has("open")) return "conflict";
  if (closedLost) return CLOSED_OURS.has(ours) ? "aligned" : "lost_there";
  // Only open deals: both say still in play unless we closed the person out.
  return CLOSED_OURS.has(ours) ? "conflict" : "aligned";
}

/** Where the model's probability sits against the two bars lead-service applies. */
export function judgmentPosition(
  p: number | null | undefined,
  t: { pairAt: number; rejectAt: number },
): "pair" | "reject" | "between" | null {
  if (p == null || !Number.isFinite(p)) return null;
  if (p >= t.pairAt) return "pair";
  if (p <= t.rejectAt) return "reject";
  return "between";
}

/** What to call the contact: a name, else the email, else the phone. Never an id. */
export function crmContactLabel(c: CrmPairingRow["crmContact"]): string {
  const full = (c.fullName ?? "").trim();
  if (full) return full;
  const parts = [c.firstName, c.lastName].map((s) => (s ?? "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" ");
  return (c.email ?? "").trim() || (c.phone ?? "").trim() || "No name";
}

/** Their record's provenance, or null when the row carries none. */
export function contactProvenance(c: CrmPairingRow["crmContact"]) {
  return c.record ?? null;
}

// ─── Where their contacts came from (crm-service) ────────────────────────────

const OriginBucketSchema = z.object({ value: z.string().nullable(), count: z.number() });

export const CrmContactOriginsSchema = z.object({
  totalContacts: z.number(),
  leadSource: z.array(OriginBucketSchema),
  originMedium: z.array(OriginBucketSchema),
  contactType: z.array(OriginBucketSchema).nullish(),
  tags: z
    .object({ tagged: z.number(), untagged: z.number(), labels: z.array(OriginBucketSchema) })
    .nullish(),
});

export type CrmContactOrigins = z.infer<typeof CrmContactOriginsSchema>;
export type OriginBucket = z.infer<typeof OriginBucketSchema>;

/**
 * The buckets worth a line, in the producer's order, capped. What is left is
 * stated as a count of buckets, never folded into an "other" figure we add up.
 */
export function topBuckets(buckets: OriginBucket[], max: number): { shown: OriginBucket[]; more: number } {
  const nonEmpty = buckets.filter((b) => b.count > 0);
  return { shown: nonEmpty.slice(0, max), more: Math.max(0, nonEmpty.length - max) };
}

/** The pairing-state sets the table offers, as lead-service's `state` values. */
export const STATE_FILTERS: { id: string; label: string; states: string[] | null }[] = [
  { id: "paired", label: "In common", states: ["paired"] },
  { id: "unconfirmed", label: "Maybe in common", states: ["unconfirmed"] },
  { id: "both", label: "In common or maybe", states: ["paired", "unconfirmed"] },
  { id: "rejected", label: "Not the same person", states: ["rejected"] },
  { id: "unpaired", label: "Only in their CRM", states: ["unpaired"] },
  { id: "all", label: "Everyone", states: null },
];

/** Filter + order one loaded page. Never a claim about the whole population. */
export function filterAndSortRows(
  rows: CrmPairingRow[],
  opts: {
    state: string | "all";
    alignment: Alignment | "all";
    sort: "attention" | "name" | "state";
  },
): CrmPairingRow[] {
  const kept = rows.filter(
    (r) =>
      (opts.state === "all" || r.pairing.state === opts.state) &&
      (opts.alignment === "all" || alignmentFor(r) === opts.alignment),
  );
  const byName = (a: CrmPairingRow, b: CrmPairingRow) =>
    crmContactLabel(a.crmContact).localeCompare(crmContactLabel(b.crmContact));
  const stateRank = (s: string) => {
    const i = (PAIRING_STATES as readonly string[]).indexOf(s);
    return i === -1 ? PAIRING_STATES.length : i;
  };
  return [...kept].sort((a, b) => {
    if (opts.sort === "name") return byName(a, b);
    if (opts.sort === "state") return stateRank(a.pairing.state) - stateRank(b.pairing.state) || byName(a, b);
    return (
      ATTENTION_ORDER.indexOf(alignmentFor(a)) - ATTENTION_ORDER.indexOf(alignmentFor(b)) ||
      stateRank(a.pairing.state) - stateRank(b.pairing.state) ||
      byName(a, b)
    );
  });
}

/** A ruling refusal, as a sentence. Status-based: never the downstream body. */
export function rulingErrorMessage(status: number | null, kind: "rule" | "retract"): string {
  if (status === 409 && kind === "retract") return "Nobody has ruled on this pairing, so there is nothing to take back.";
  if (status === 400) return "That was refused as incomplete. Reload the page and try again.";
  if (status === 401 || status === 403) return "You are not allowed to change this pairing.";
  return kind === "retract" ? "We could not take the ruling back. Try again." : "We could not record that. Try again.";
}
