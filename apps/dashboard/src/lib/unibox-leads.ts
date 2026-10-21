import { z } from "zod";

/**
 * The Unibox list (owner 2026-10-17, UNIBOX-SIX-TAGS-1017): lead-service's Unibox, ONLY the
 * people crm-service tags professional to the brand, each a LEAD carrying six tag dimensions
 * lead-service decides. This module only NAMES the served values and builds the query; it
 * never derives a tag. Alias-free (real unit tests).
 */

export const LifecycleRungSchema = z.object({ key: z.string(), rank: z.number(), label: z.string() }).passthrough();
export type LifecycleRung = z.infer<typeof LifecycleRungSchema>;

const StepSchema = z.object({ step: z.string(), at: z.string().nullable() }).passthrough();

export const UniboxRowSchema = z
  .object({
    humanId: z.string(),
    companyKey: z.string().nullish(),
    // PERSON-RELATIONS-1017: a row is ONE relation (one human at one company), so a human can
    // own several rows. `relationKey` (crm-service's `rel:…`) names the row and its thread.
    // Optional until every cached body carries it.
    relationKey: z.string().nullish(),
    relationKeys: z.array(z.string()).optional(),
    name: z.string().nullable(),
    // WHO it is (lead-service UNIBOX-PERSON-NAME-1021): the relation's lead as sourced. Optional
    // until every cached body carries them; null = unknown, never derived here from an address.
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    title: z.string().nullish(),
    emails: z.array(z.string()),
    phones: z.array(z.string()),
    personKeys: z.array(z.string()),
    leadIds: z.array(z.string()),
    /** Deprecated by lead-service (2026-10-17): read `status` + `roles`. */
    types: z.array(z.string()),
    // lead-service v0.83.140: ONE status, several roles. Optional until every cached body carries them.
    status: z.string().nullish(),
    roles: z.array(z.string()).optional(),
    lifecycle: LifecycleRungSchema.nullable(),
    steps: z.array(StepSchema),
    interest: z.string(),
    conversation: z.string(),
    contactability: z.string(),
    fit: z.string(),
    fitNote: z.string().nullable(),
    lastTheirsAt: z.string().nullable(),
    lastOursAt: z.string().nullable(),
    lastActivityAt: z.string().nullable(),
    connectionTags: z.array(z.string()),
    // The org of this relation (lead-service, owner 2026-10-17: « Adam Nasri @ <company> »);
    // null = company unknown. Optional until every cached body carries it.
    company: z.object({ id: z.string(), name: z.string().nullable(), domain: z.string().nullable() }).passthrough().nullish(),
    // The thread's last message (lead-service UNIBOX-LAST-MESSAGE-PREVIEW-1021): its first words
    // and who wrote it. null = no message to show (`lastMessageReason` says why). Optional until
    // every cached body carries it.
    lastMessage: z
      .object({
        at: z.string().nullish(),
        side: z.string().nullish(),
        sentBy: z.string().nullish(),
        channel: z.string().nullish(),
        source: z.string().nullish(),
        subject: z.string().nullish(),
        preview: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    lastMessageReason: z.string().nullish(),
  })
  .passthrough();
export type UniboxRow = z.infer<typeof UniboxRowSchema>;

export const UniboxPageSchema = z
  .object({
    brandId: z.string(),
    lifecycleLadder: z.array(LifecycleRungSchema),
    rows: z.array(UniboxRowSchema),
    total: z.number(),
    nextCursor: z.string().nullable(),
    builtAt: z.string().nullable(),
  })
  .passthrough();
export type UniboxPage = z.infer<typeof UniboxPageSchema>;

export const UniboxLeadCardSchema = z
  .object({
    brandId: z.string(),
    lead: UniboxRowSchema,
    campaigns: z.array(
      z
        .object({
          // The customer's campaign (lead-service #996): its pipes fold into it, `name` is what the
          // customer calls it. Optional until every cached body carries them.
          campaignId: z.string(),
          name: z.string().nullish(),
          pipeCampaignIds: z.array(z.string()).optional(),
          servedAt: z.string().nullable(),
          furthest: LifecycleRungSchema.nullable(),
          steps: z.array(StepSchema),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type UniboxLeadCard = z.infer<typeof UniboxLeadCardSchema>;

/** The six dimensions, in the order the card and the filters show them. */
export const UNIBOX_DIMENSIONS = ["status", "role", "lifecycle", "interest", "conversation", "contactability", "fit"] as const;
export type UniboxDimension = (typeof UNIBOX_DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<UniboxDimension, string> = {
  status: "Status",
  role: "Role",
  lifecycle: "Lifecycle",
  interest: "Interest",
  conversation: "Conversation",
  contactability: "Reachable",
  fit: "Fit",
};

/** The value lists lead-service accepts (its 400 names them). Lifecycle comes from the served ladder. */
export const DIMENSION_VALUES: Record<Exclude<UniboxDimension, "lifecycle">, { value: string; label: string }[]> = {
  // customer = paying today; churned = paid, then stopped; prospect = never paid (owner 2026-10-17).
  status: [
    { value: "prospect", label: "Prospect" },
    { value: "customer", label: "Customer" },
    { value: "churned", label: "Churned" },
  ],
  role: [
    { value: "partner", label: "Partner" },
    { value: "investor", label: "Investor" },
    { value: "supplier", label: "Supplier" },
    { value: "employee", label: "Employee" },
    { value: "advisor", label: "Advisor" },
    { value: "press", label: "Press" },
    { value: "other", label: "Other" },
  ],
  interest: [
    { value: "interested", label: "Interested" },
    { value: "not_interested", label: "Not interested" },
    { value: "unsure", label: "Unsure" },
    { value: "not_asked", label: "Not asked yet" },
  ],
  conversation: [
    { value: "waiting_on_us", label: "Waiting on us" },
    { value: "waiting_on_them", label: "Waiting on them" },
    { value: "no_reply_yet", label: "No reply yet" },
    { value: "closed", label: "Closed" },
  ],
  contactability: [
    { value: "contactable", label: "Reachable" },
    { value: "unsubscribed", label: "Unsubscribed" },
    { value: "bounced", label: "Bounced" },
    { value: "do_not_contact", label: "Do not contact" },
  ],
  fit: [
    { value: "fit", label: "Good fit" },
    { value: "wrong_person", label: "Wrong person" },
    { value: "not_our_target", label: "Not our target" },
  ],
};

/** The lifecycle filter's choices: the served ladder in rank order, then "none". */
export function lifecycleOptions(ladder: LifecycleRung[]): { value: string; label: string }[] {
  return [...ladder].sort((a, b) => a.rank - b.rank).map((r) => ({ value: r.key, label: r.label })).concat({ value: "none", label: "No stage yet" });
}

/** The words for one served value. An unknown one is said as served, and logged. */
export function dimensionValueLabel(dim: Exclude<UniboxDimension, "lifecycle">, value: string): string {
  const hit = DIMENSION_VALUES[dim].find((v) => v.value === value);
  if (hit) return hit.label;
  console.error("[unibox] value lead-service serves that the dashboard does not name", { dim, value });
  return value.replace(/_/g, " ");
}

export type UniboxFilters = Partial<Record<UniboxDimension, string[]>>;

/** The URL param each dimension rides in (kept short, same names as lead-service's). */
export function filtersFromParams(params: { get(k: string): string | null }): UniboxFilters {
  const out: UniboxFilters = {};
  for (const d of UNIBOX_DIMENSIONS) {
    const raw = params.get(d);
    if (raw) out[d] = raw.split(",").filter(Boolean);
  }
  return out;
}

/** One stable string per filter set (query key, "did the filter change"). */
export function filtersKey(f: UniboxFilters): string {
  return UNIBOX_DIMENSIONS.map((d) => `${d}=${[...(f[d] ?? [])].sort().join(",")}`).join("&");
}

/** lead-service's query string for one page: each filter a comma list, `q`, the cursor. */
export function uniboxQuery(brandId: string, f: UniboxFilters, opts: { q?: string; limit: number; cursor?: string | null }): string {
  const qs = new URLSearchParams({ brandId, limit: String(opts.limit) });
  for (const d of UNIBOX_DIMENSIONS) {
    const v = f[d];
    if (v && v.length > 0) qs.set(d, v.join(","));
  }
  if (opts.q) qs.set("q", opts.q);
  if (opts.cursor) qs.set("cursor", opts.cursor);
  return qs.toString();
}

/**
 * The thread's ref: the row's relation (crm-service reads `relationKey`, only that relation's
 * contact points, never the person's personal chats). A row without one (should not happen)
 * reads the person by its first identity key, as before.
 */
export function uniboxThreadRef(row: Pick<UniboxRow, "personKeys" | "relationKey">): string | null {
  if (row.relationKey) return row.relationKey;
  if (row.relationKey === null) console.error("[unibox] row without a relationKey, thread read by person", { personKeys: row.personKeys });
  return row.personKeys[0] ?? null;
}

/** What the URL names a row by: its relation, else (an older body) its human. */
export function uniboxRowId(row: Pick<UniboxRow, "humanId" | "relationKey">): string {
  return row.relationKey ?? row.humanId;
}

/** One React key per row: the same human legitimately owns several rows. */
export function uniboxRowKey(row: Pick<UniboxRow, "humanId" | "relationKey" | "companyKey">): string {
  return row.relationKey ?? `${row.humanId}|${row.companyKey ?? ""}`;
}

/** The card read for a URL value: a relation opens that row, a human its latest-active row. */
export function uniboxCardQuery(id: string): { relationKey: string } | { humanId: string } {
  return id.startsWith("rel:") ? { relationKey: id } : { humanId: id };
}

/**
 * A row's second line (owner 2026-10-21, UNIBOX-LAYOUT-1021): the served job title and company,
 * `Head of RA · Platomics`, under the name in bold. Never one "Name @ Company" string: it
 * truncated the company away. Null when lead-service serves neither.
 */
export function uniboxRowSubtitle(row: Pick<UniboxRow, "title" | "company">): string | null {
  const parts = [row.title?.trim(), row.company?.name || row.company?.domain].filter((x): x is string => Boolean(x));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * A row's third line (owner 2026-10-21, UNIBOX-PREVIEW-ROW-1021, like Gmail): the first words of
 * the thread's last message as lead-service serves them, `You: …` when we wrote it. Null when no
 * preview is served: the row then shows no line, never a placeholder.
 */
export function uniboxRowPreview(row: Pick<UniboxRow, "lastMessage">): string | null {
  const text = row.lastMessage?.preview?.trim();
  if (!text) return null;
  return row.lastMessage?.side === "ours" ? `You: ${text}` : text;
}

export type UniboxRowTag = { dim: Exclude<UniboxDimension, "role">; value: string; label: string };

/**
 * The tags a list ROW carries (owner 2026-10-21): only what is NOT the default. Contacted, no reply
 * yet, prospect is what most rows are, so it shows nothing; a row speaks when the lead moved past
 * Contacted on the served ladder, waits on us, said no, became a customer or cannot be reached.
 * A display rule over served values only; the card beside the thread still states all six.
 */
export function uniboxRowTags(row: Pick<UniboxRow, "lifecycle" | "conversation" | "interest" | "status" | "contactability">, ladder: LifecycleRung[]): UniboxRowTag[] {
  const tags: UniboxRowTag[] = [];
  if (row.conversation === "waiting_on_us") tags.push({ dim: "conversation", value: row.conversation, label: dimensionValueLabel("conversation", row.conversation) });
  const contacted = ladder.find((r) => r.key === "contacted")?.rank ?? 0;
  if (row.lifecycle && row.lifecycle.rank > contacted) tags.push({ dim: "lifecycle", value: row.lifecycle.key, label: row.lifecycle.label });
  else if (row.status && row.status !== "prospect") tags.push({ dim: "status", value: row.status, label: dimensionValueLabel("status", row.status) });
  if (row.interest === "not_interested") tags.push({ dim: "interest", value: row.interest, label: dimensionValueLabel("interest", row.interest) });
  if (row.contactability !== "contactable") tags.push({ dim: "contactability", value: row.contactability, label: dimensionValueLabel("contactability", row.contactability) });
  return tags;
}

/** A lead's display name: the served name, else the first address or number. */
export function uniboxLeadName(row: Pick<UniboxRow, "name" | "emails" | "phones">): string {
  return row.name?.trim() || row.emails[0] || row.phones[0] || "Unknown";
}
