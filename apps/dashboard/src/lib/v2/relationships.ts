import { z } from "zod";
import { sourceLabel } from "../people-conversations";

/**
 * Who each person is to a brand (lead-service, RELATIONSHIP-TAGS-1014): the tags an AI
 * judge reads off the person's whole thread, the merges it suggests between two records
 * of one person, and the company it found. The brand's People review page renders the
 * owner's questions and every settled answer; one click states the owner's word, which
 * wins over any judgment. Alias-free so the unit tests read it.
 */

export const RELATIONSHIP_TAGS = [
  "personal",
  "customer",
  "prospect",
  "team",
  "investor",
  "advisor",
  "supplier",
  "partner",
  "other_professional",
] as const;
export type RelationshipTag = (typeof RELATIONSHIP_TAGS)[number];

/** Owner's word per tag (decision 2026-10-14), capitalised as a chip reads. */
export const RELATIONSHIP_TAG_LABEL: Record<RelationshipTag, string> = {
  personal: "Personal",
  customer: "Customer",
  prospect: "Prospect",
  team: "Team",
  investor: "Investor",
  advisor: "Advisor",
  supplier: "Supplier",
  partner: "Partner",
  other_professional: "Other professional",
};

/** A tag lead-service adds later must not break the page: unknown values pass and read as their raw word. */
export function relationshipTagLabel(tag: string): string {
  return (RELATIONSHIP_TAG_LABEL as Record<string, string>)[tag] ?? tag;
}

const CompanySchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  domain: z.string().nullable(),
  source: z.string(),
});
export type RelationshipCompany = z.infer<typeof CompanySchema>;

const DetailSchema = z.object({
  tag: z.string(),
  level: z.string(),
  state: z.string(),
  basis: z.string(),
  confidence: z.number().nullable(),
  evidence: z.string().nullable(),
  at: z.string(),
});
export type RelationshipDetail = z.infer<typeof DetailSchema>;

export const RelationshipBlockSchema = z.object({
  humanId: z.string().nullable(),
  company: CompanySchema.nullable(),
  tags: z.array(z.string()),
  unsureTags: z.array(z.string()),
  judgedAt: z.string().nullable(),
  details: z.array(DetailSchema),
  policies: z.object({ business_only: z.boolean() }).passthrough(),
});
export type RelationshipBlock = z.infer<typeof RelationshipBlockSchema>;

const CardSchema = z.object({
  humanId: z.string(),
  name: z.string().nullable(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  channels: z.array(z.string()),
});
export type MergeCard = z.infer<typeof CardSchema>;

export const RelationshipReviewSchema = z.object({
  brandId: z.string(),
  mergeQuestions: z.array(
    z.object({ id: z.string(), confidence: z.number(), reason: z.string().nullable(), a: CardSchema, b: CardSchema }),
  ),
  tagQuestions: z.array(
    z.object({
      humanId: z.string(),
      name: z.string().nullable(),
      tag: z.string(),
      confidence: z.number().nullable(),
      reason: z.string().nullable(),
    }),
  ),
  companyQuestions: z.array(
    z.object({
      humanId: z.string(),
      name: z.string().nullable(),
      candidates: z.array(z.object({ name: z.string().nullable(), domain: z.string().nullable(), source: z.string() })),
    }),
  ),
  settled: z.object({
    merges: z.array(
      z.object({
        linkId: z.string(),
        humanIds: z.array(z.string()),
        names: z.array(z.string().nullable()),
        judgedBy: z.string(),
        at: z.string(),
      }),
    ),
    people: z.array(
      z.object({
        humanId: z.string(),
        name: z.string().nullable(),
        company: CompanySchema.nullable(),
        tags: z.array(z.string()),
        details: z.array(DetailSchema),
      }),
    ),
  }),
  counts: z.object({
    subjects: z.number(),
    judged: z.number(),
    byTag: z.record(z.string(), z.number()),
    unsureMerges: z.number(),
    unsureTags: z.number(),
    companyQuestions: z.number(),
  }),
});
export type RelationshipReview = z.infer<typeof RelationshipReviewSchema>;

/** A person with no name yet reads as their first email, then phone, never blank. */
export function cardTitle(c: MergeCard): string {
  return c.name ?? c.emails[0] ?? c.phones[0] ?? "Unnamed person";
}

/**
 * Where we know a person from: a card's `channels` are crm-service's person SOURCES, named
 * the way the Unibox names them, plus the two the Unibox never shows as a source.
 */
export function channelLabel(source: string): string {
  if (source === "clerk") return "Signed up";
  if (source === "csv") return "CSV upload";
  return sourceLabel(source);
}

/** The AI's confidence as a whole %, the way every v2 rate reads. */
export function confidencePct(p: number | null): string | null {
  if (p === null) return null;
  const pct = p <= 1 ? p * 100 : p;
  return `${Math.round(pct)}% sure`;
}

/** The owner's word on a tag, if he gave one (it wins over evidence and judgment). */
export function personWord(details: RelationshipDetail[], tag: string): "yes" | "no" | null {
  const d = details.find((x) => x.tag === tag && x.basis === "person");
  if (!d) return null;
  return d.state === "yes" ? "yes" : d.state === "no" ? "no" : null;
}

/** Tags the owner said NO to: kept visible (struck) so he can take his word back. */
export function deniedTags(details: RelationshipDetail[]): string[] {
  return Array.from(new Set(details.filter((d) => d.basis === "person" && d.state === "no").map((d) => d.tag)));
}

/** Tags the person can still add on a row: every tag not already yes. */
export function addableTags(tags: string[]): RelationshipTag[] {
  return RELATIONSHIP_TAGS.filter((t) => !tags.includes(t));
}

/** Who settled a merge, in plain words. */
export function mergedByLabel(judgedBy: string): string {
  // lead-service writes `person:<userId>` when a person answered, the judge's own name otherwise.
  return judgedBy.startsWith("person:") ? "Merged by you" : "Merged by AI";
}
