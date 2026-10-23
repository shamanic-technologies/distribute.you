import { z } from "zod";
import type { TimelineIcon, TimelineTag, TimelineTone } from "./timeline-tags";

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
    // The campaigns that reached this relation (lead-service v0.83.166, list rows only): the
    // customer's campaign once, its served name, newest first, within the read's scope. null =
    // campaign-service unreadable (`campaignsReason`). Optional until every cached body carries it.
    campaigns: z
      .array(z.object({ campaignId: z.string(), name: z.string(), pipeCampaignIds: z.array(z.string()), servedAt: z.string().nullable() }).passthrough())
      .nullish(),
    campaignsReason: z.string().nullish(),
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

/** Who the read is narrowed to (lead-service v0.83.164): one offer of the brand, and/or one campaign. */
export interface UniboxScope {
  offerId?: string | null;
  campaignId?: string | null;
}

/** The brand, the scope and each filter as a comma list (shared by the list and the counts). */
function scopedQuery(brandId: string, f: UniboxFilters, scope: UniboxScope): URLSearchParams {
  const qs = new URLSearchParams({ brandId });
  if (scope.offerId) qs.set("offerId", scope.offerId);
  if (scope.campaignId) qs.set("campaignId", scope.campaignId);
  for (const d of UNIBOX_DIMENSIONS) {
    const v = f[d];
    if (v && v.length > 0) qs.set(d, v.join(","));
  }
  return qs;
}

/** lead-service's query string for one page: the scope, each filter a comma list, `q`, the cursor. */
export function uniboxQuery(
  brandId: string,
  f: UniboxFilters,
  opts: { q?: string; limit: number; cursor?: string | null; sort?: UniboxSort | null } & UniboxScope,
): string {
  const qs = scopedQuery(brandId, f, opts);
  qs.set("limit", String(opts.limit));
  if (opts.q) qs.set("q", opts.q);
  if (opts.cursor) qs.set("cursor", opts.cursor);
  if (opts.sort) qs.set("sort", opts.sort);
  return qs.toString();
}

/**
 * The orders lead-service serves on the Unibox list (PEOPLE-SORT-BY-COMPANY-1023). Absent (null)
 * = its default, newest activity first. `company_*` keeps every person of one company together
 * across pages, so a client sees colleagues side by side. A cursor answers only the sort it was
 * issued for: drop the cursor when the sort changes.
 */
export type UniboxSort = "company_asc" | "company_desc" | "stage_desc" | "stage_asc" | "last_touch_asc";
export type UniboxSortColumn = "company" | "stage" | "lastTouch";

/** Each sortable column's orders, first click first; one more click returns to the default. */
const SORT_CYCLE: Record<UniboxSortColumn, (UniboxSort | null)[]> = {
  company: ["company_asc", "company_desc", null],
  stage: ["stage_desc", "stage_asc", null],
  // The default IS newest touch first, so this column only flips to oldest first and back.
  lastTouch: ["last_touch_asc", null],
};

/** The sort a click on `column`'s header asks for, given the sort in force. */
export function nextUniboxSort(column: UniboxSortColumn, current: UniboxSort | null): UniboxSort | null {
  const cycle = SORT_CYCLE[column];
  const at = current ? cycle.indexOf(current) : -1;
  if (at === -1) return cycle[0];
  return cycle[(at + 1) % cycle.length];
}

/** The arrow a column header shows: "asc", "desc", or null when the list is not ordered on it. */
export function uniboxSortArrow(column: UniboxSortColumn, current: UniboxSort | null): "asc" | "desc" | null {
  if (column === "lastTouch") return current === "last_touch_asc" ? "asc" : current === null ? "desc" : null;
  if (column === "company") return current === "company_asc" ? "asc" : current === "company_desc" ? "desc" : null;
  return current === "stage_asc" ? "asc" : current === "stage_desc" ? "desc" : null;
}

/** lead-service's query string for the per-rung counts: the same scope and filters, no paging. */
export function uniboxCountsQuery(brandId: string, f: UniboxFilters, scope: UniboxScope): string {
  return scopedQuery(brandId, f, scope).toString();
}

/**
 * How many people stand on each lifecycle rung, in one scope (lead-service
 * `GET /orgs/leads/unibox-lifecycle-counts`): every ladder key served, 0 included, plus `none`;
 * they add up to `total`. The Deals board's column sizes.
 */
export const UniboxLifecycleCountsSchema = z
  .object({
    brandId: z.string(),
    offerId: z.string().nullable(),
    campaignId: z.string().nullable(),
    lifecycleLadder: z.array(LifecycleRungSchema),
    total: z.number(),
    byLifecycle: z.record(z.string(), z.number()),
    builtAt: z.string().nullable(),
  })
  .passthrough();
export type UniboxLifecycleCounts = z.infer<typeof UniboxLifecycleCountsSchema>;

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

type Look = { tone: TimelineTone; icon: TimelineIcon };

/**
 * ONE look per served value, on every surface (list row, lead card, filter menus), so a word reads
 * in the same colour everywhere (owner 2026-10-21: "Engaged" grey in the list, green in the header).
 * One heat scale: grey = nothing yet, teal = they engaged, amber = a buying signal or a move on us,
 * green = meeting attended or paid, rose = a closed door. Same tones as the thread and the header
 * (`STANDING_LOOK`, `STEP_LOOK`, the fact labels). A display lookup only, never a verdict.
 */
const VALUE_LOOK: Record<string, Look> = {
  "lifecycle:lead_found": { tone: "neutral", icon: "dot" },
  "lifecycle:contacted": { tone: "neutral", icon: "sent" },
  "lifecycle:engaged": { tone: "reply", icon: "reply" },
  "lifecycle:signup_or_form": { tone: "hot", icon: "check" },
  "lifecycle:meeting_booked": { tone: "hot", icon: "meeting" },
  "lifecycle:meeting_attended": { tone: "won", icon: "meeting" },
  "lifecycle:paid_client": { tone: "won", icon: "money" },
  "interest:interested": { tone: "hot", icon: "flame" },
  "interest:not_interested": { tone: "lost", icon: "lost" },
  "interest:unsure": { tone: "neutral", icon: "dot" },
  "interest:not_asked": { tone: "neutral", icon: "dot" },
  "conversation:waiting_on_us": { tone: "hot", icon: "reply" },
  "conversation:waiting_on_them": { tone: "reply", icon: "sent" },
  "conversation:no_reply_yet": { tone: "neutral", icon: "sent" },
  "conversation:closed": { tone: "neutral", icon: "dot" },
  "contactability:contactable": { tone: "neutral", icon: "check" },
  "contactability:unsubscribed": { tone: "lost", icon: "lost" },
  "contactability:bounced": { tone: "lost", icon: "lost" },
  "contactability:do_not_contact": { tone: "lost", icon: "lost" },
  "fit:fit": { tone: "neutral", icon: "check" },
  "fit:wrong_person": { tone: "lost", icon: "lost" },
  "fit:not_our_target": { tone: "lost", icon: "lost" },
  "status:prospect": { tone: "neutral", icon: "dot" },
  "status:customer": { tone: "won", icon: "money" },
  "status:churned": { tone: "lost", icon: "lost" },
};

/** One served value as its tag: its words and its look (grey with a dot for a value we do not know yet). */
export function uniboxValueTag(dim: UniboxDimension, value: string, label: string): TimelineTag {
  return { label, ...(VALUE_LOOK[`${dim}:${value}`] ?? { tone: "neutral", icon: "dot" }) };
}

/** The tone of a filter option (the dot beside it in the menu). */
export function uniboxValueTone(dim: UniboxDimension, value: string): TimelineTone {
  return VALUE_LOOK[`${dim}:${value}`]?.tone ?? "neutral";
}

/**
 * The ONE tag a list row carries (owner 2026-10-21): where the lead stands, the hottest true fact
 * first, nothing for the default (lead found or contacted, no answer, prospect). A customer first;
 * then a closed door (unreachable, not interested, churned: it ends the conversation); then a stage
 * past Engaged (signup, meeting, paid); then Interested (hotter than Engaged); then Engaged. Whether
 * they wait on US is not a stage: the row says it apart (`uniboxWaitsOnUs`).
 */
export function uniboxRowTag(row: Pick<UniboxRow, "lifecycle" | "interest" | "status" | "contactability">, ladder: LifecycleRung[]): TimelineTag | null {
  const rank = (key: string) => ladder.find((r) => r.key === key)?.rank ?? null;
  const engaged = rank("engaged") ?? rank("contacted") ?? 0;
  const stage = row.lifecycle;
  const past = (n: number) => stage !== null && stage.rank > n;
  if (row.status === "customer") return past(engaged) ? uniboxValueTag("lifecycle", stage!.key, stage!.label) : uniboxValueTag("status", "customer", dimensionValueLabel("status", "customer"));
  if (row.contactability !== "contactable") return uniboxValueTag("contactability", row.contactability, dimensionValueLabel("contactability", row.contactability));
  if (row.interest === "not_interested") return uniboxValueTag("interest", row.interest, dimensionValueLabel("interest", row.interest));
  if (row.status === "churned") return uniboxValueTag("status", "churned", dimensionValueLabel("status", "churned"));
  if (past(engaged)) return uniboxValueTag("lifecycle", stage!.key, stage!.label);
  if (row.interest === "interested") return uniboxValueTag("interest", row.interest, dimensionValueLabel("interest", row.interest));
  if (past(rank("contacted") ?? engaged)) return uniboxValueTag("lifecycle", stage!.key, stage!.label);
  return null;
}

/** They wrote and wait on us: the row's amber dot, like an unread mark. */
export function uniboxWaitsOnUs(row: Pick<UniboxRow, "conversation">): boolean {
  return row.conversation === "waiting_on_us";
}

/** A lead's display name: the served name, else the first address or number. */
export function uniboxLeadName(row: Pick<UniboxRow, "name" | "emails" | "phones">): string {
  return row.name?.trim() || row.emails[0] || row.phones[0] || "Unknown";
}
