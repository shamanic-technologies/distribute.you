import { z } from "zod";
import type { AnyLeadTab } from "./goal-steps";
import type { LeadStageKey } from "./lead-funnel-stages";
import type { LeadBoardColumnKey } from "./lead-board";
import { STANDINGS_BY_COLUMN } from "./lead-board";
import type { LeadStandingState } from "./lead-standing";

/**
 * Asking lead-service for ONE page of a brand's leads, instead of all of them.
 *
 * The Leads page used to read every lead row and do the rest in the browser: the tab
 * counts, the search, the sort, the export and the board all derived from one array.
 * That array is 44.5 MB / 12,945 rows on one real brand and 99 MB on the largest, so it
 * blew the 2 MB on-disk cache entry cap (`persist-cache.ts`), was never cached, and the
 * page cold-loaded on every single visit — the customer-visible skeleton this replaces.
 *
 * lead-service answers all of it now (sales-lead-service, `GET /orgs/leads` gained
 * `limit`/`cursor`/`q`/`bucket`/`sort`/`format`, and `GET /orgs/leads/bucket-counts`
 * answers every tab's count without returning a single row). This module is the one
 * place that speaks that vocabulary: the tab-to-bucket map, the request builder, the
 * response parsers, and the rule for what the search box may send.
 *
 * Alias-free on purpose — its only imports are zod and a type that is erased at build —
 * so it carries REAL unit tests rather than source-substring guards. Keep it that way.
 */

/**
 * The engagement buckets lead-service names. These are ITS tokens, not the dashboard's
 * tab keys, and the two vocabularies are deliberately kept apart: the producer owns
 * which buckets exist, and `meeting_attended` has no tab here at all.
 */
export const LEAD_BUCKETS = [
  "contacted",
  "website_visit",
  "positive_reply",
  "signup",
  "meeting_booked",
  "meeting_attended",
  "form_submission",
  "sale",
] as const;
export type LeadBucket = (typeof LEAD_BUCKETS)[number];

/**
 * Which bucket a tab asks for. Several tabs could in principle share a bucket, and one
 * bucket (`meeting_attended`) is served with no tab pointing at it — that is the
 * producer's catalogue being wider than this surface, not a gap.
 *
 * The dashboard's `meetings` tab is the BOOKED meeting, matching `goal-steps`'
 * `leadField: "meetingBooked"`. Pointing it at `meeting_attended` would count a
 * different, smaller population under the label the stat cards already price.
 */
const BUCKET_BY_TAB: Record<AnyLeadTab, LeadBucket> = {
  outreach: "contacted",
  clicks: "website_visit",
  "positive-replies": "positive_reply",
  signups: "signup",
  meetings: "meeting_booked",
  "form-submissions": "form_submission",
  sales: "sale",
};

export function bucketForTab(tab: AnyLeadTab): LeadBucket {
  return BUCKET_BY_TAB[tab];
}

/**
 * Which bucket holds the people at one funnel STAGE.
 *
 * `LeadStageKey` and lead-service's bucket vocabulary are the same seven tokens — the
 * stage keys were spelled to match the producer, which is exactly why this is a checked
 * identity rather than a second table that could drift. `null` is the base of a funnel's
 * FIRST arrow: a lead that has been contacted is on no step yet, and "contacted" is the
 * base every funnel converts from.
 *
 * A stage the producer does not bucket returns null rather than a guess — the caller then
 * reads no rows for that column, which is honest, instead of reading the wrong ones.
 */
export function bucketForStage(stage: LeadStageKey | null): LeadBucket | null {
  if (stage === null) return "contacted";
  return (LEAD_BUCKETS as readonly string[]).includes(stage) ? (stage as LeadBucket) : null;
}

/** Rows per page. The page numbers the reader clicks are windows onto `total`. */
export const LEADS_PAGE_SIZE = 50;

/**
 * What the search box may send.
 *
 * lead-service 400s a blank search, one over 200 characters, and one over 8 words —
 * deliberately, so a search is never silently ignored. Sending one of those would take
 * the table down rather than return nothing, so the box refuses locally and says why.
 * A blank box is NOT a problem, it is the absence of a search: `null` means "send no
 * `q` at all", and only a non-empty-but-unusable value returns a sentence.
 */
export const LEADS_SEARCH_MAX_CHARS = 200;
export const LEADS_SEARCH_MAX_WORDS = 8;

export function leadsSearchProblem(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > LEADS_SEARCH_MAX_CHARS) {
    return `Search is limited to ${LEADS_SEARCH_MAX_CHARS} characters.`;
  }
  if (trimmed.split(/\s+/).length > LEADS_SEARCH_MAX_WORDS) {
    return `Search is limited to ${LEADS_SEARCH_MAX_WORDS} words.`;
  }
  return null;
}

/** The value to put on the wire, or null to send no search at all. */
export function leadsSearchParam(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return leadsSearchProblem(trimmed) ? null : trimmed;
}

/**
 * One page request. `offset` rather than `cursor` because the table offers numbered
 * pages: a cursor can only walk forward, and a reader clicking "page 7" has no cursor
 * for it. lead-service documents both over the SAME total order and warns that an
 * offset walk shifts if a row leaves the filtered set mid-walk — acceptable for a
 * numbered pager over a 30s poll, and the ordering is total so no page can repeat a
 * lead within itself.
 */
export interface LeadsPageRequest {
  tab: AnyLeadTab;
  search: string;
  page: number;
}

/**
 * The query lead-service reads. Every key is omitted when it carries no instruction, so
 * an unfiltered first page is byte-identical to what this endpoint has always answered
 * plus the bound — which is what keeps the producer's "absent means unchanged" promise
 * meaningful on this caller.
 */
export function leadsPageQuery(req: LeadsPageRequest): Record<string, string> {
  const query: Record<string, string> = {
    view: "basic",
    bucket: bucketForTab(req.tab),
    sort: "activity",
    limit: String(LEADS_PAGE_SIZE),
  };
  const offset = Math.max(0, Math.trunc(req.page)) * LEADS_PAGE_SIZE;
  if (offset > 0) query.offset = String(offset);
  const q = leadsSearchParam(req.search);
  if (q) query.q = q;
  return query;
}

/** The counts query — same scope and same search as the list, no bucket and no bound. */
export function leadBucketCountsQuery(search: string): Record<string, string> {
  const query: Record<string, string> = {};
  const q = leadsSearchParam(search);
  if (q) query.q = q;
  return query;
}

/**
 * `total` is REQUIRED-but-nullable in spirit here: lead-service documents it as present
 * whenever the caller named a bound or a filter, and absent on an unbounded unfiltered
 * read. This caller always names a bound, so it is always present in practice — but a
 * reader that REQUIRED it would throw on the one body the producer says it may omit,
 * which is the `.optional()`-vs-`.nullable()` trap this repo keeps recording. `null`
 * therefore means "we were not told", never zero.
 */
export const LeadsPageEnvelopeSchema = z.object({
  nextCursor: z.string().nullable(),
  total: z.number().optional(),
});
export type LeadsPageEnvelope = z.infer<typeof LeadsPageEnvelopeSchema>;

/** Every key is always present on this response — a bucket nobody is in is 0. */
export const LeadBucketCountsSchema = z.object({
  total: z.number(),
  counts: z.object({
    contacted: z.number(),
    website_visit: z.number(),
    positive_reply: z.number(),
    signup: z.number(),
    meeting_booked: z.number(),
    meeting_attended: z.number(),
    form_submission: z.number(),
    sale: z.number(),
  }),
});
export type LeadBucketCounts = z.infer<typeof LeadBucketCountsSchema>;

/**
 * How many leads a tab holds. `null` while the counts read is unsettled — a tab whose
 * count we have not been told is not a tab with zero leads, and rendering `0` there
 * states something we do not know.
 */
export function tabCount(counts: LeadBucketCounts | undefined, tab: AnyLeadTab): number | null {
  if (!counts) return null;
  return counts.counts[bucketForTab(tab)];
}

/**
 * The population the page can reach, for the title.
 *
 * It is the CONTACTED bucket, not `bucket-counts.total`: that total is the whole scoped
 * population INCLUDING the people who carry no evidence at all (about 5,000 of the
 * 12,945 on the brand that surfaced this), and those can appear under no tab, so
 * advertising them is the bug #3071 fixed.
 *
 * Contacted is the base tab by construction — "every lead we contacted is in it
 * whatever the funnel" — so it is the union's floor. Residual: a tracker could attribute
 * an outcome to somebody we never contacted, who would then be in an outcome tab and
 * outside this number. That tab states its own count, and the alternative (summing
 * buckets, which are not exclusive) would overstate it instead.
 */
export function reachablePopulation(counts: LeadBucketCounts | undefined): number | null {
  if (!counts) return null;
  return counts.counts.contacted;
}

/**
 * The STANDING dimension — what the board partitions on, and a different question from
 * the engagement buckets above.
 *
 * A bucket asks what HAPPENED to somebody and they are not exclusive: a person who
 * bought was also contacted, and appears under both. A standing asks WHERE THEY STAND on
 * the funnel their campaign sells, and it is a partition — exactly one per lead — which
 * is what a column can be drawn from and what makes the counts add up to the population.
 * Conflating the two would state a wrong number rather than a truncated one.
 */
export const LEAD_STANDINGS = [
  "unresolved",
  "not_contacted",
  "contacted",
  "engaged",
  "sales_interest",
  "customer",
  "opted_out",
  "disqualified",
] as const;

/** Counts only — never any rows. Every key is always present; a state nobody is in is 0. */
export const LeadStandingCountsSchema = z.object({
  total: z.number(),
  counts: z.object({
    unresolved: z.number(),
    not_contacted: z.number(),
    contacted: z.number(),
    engaged: z.number(),
    sales_interest: z.number(),
    customer: z.number(),
    opted_out: z.number(),
    disqualified: z.number(),
  }),
});
export type LeadStandingCounts = z.infer<typeof LeadStandingCountsSchema>;

/** Same scope and same search as the list, no standing and no bound. */
export function standingCountsQuery(search: string): Record<string, string> {
  const query: Record<string, string> = {};
  const q = leadsSearchParam(search);
  if (q) query.q = q;
  return query;
}

/**
 * How many people a board COLUMN holds — the producer's own per-standing counts, added
 * up over the standings that column holds.
 *
 * Adding them is a DISPLAY LOOKUP, not a computed metric: a standing is a partition, so
 * the counts are disjoint and their sum is a count of the same kind, at the grain this
 * surface renders. Nothing is divided and nothing is inferred. The alternative — sizing
 * a column from the rows a bounded page happened to return — is what made every number
 * on this page describe a different population.
 *
 * `null` while the counts are unsettled: a column whose size we have not been told is
 * not a column with nobody in it.
 */
export function boardColumnTotals(
  counts: LeadStandingCounts | undefined,
): Record<LeadBoardColumnKey, number> | null {
  if (!counts) return null;
  const out = {} as Record<LeadBoardColumnKey, number>;
  for (const [column, standings] of Object.entries(STANDINGS_BY_COLUMN) as [
    LeadBoardColumnKey,
    readonly LeadStandingState[],
  ][]) {
    out[column] = standings.reduce((sum, state) => sum + counts.counts[state], 0);
  }
  return out;
}

/**
 * ONE board column's page.
 *
 * `standing` takes the column's standings as a comma-separated SET (the same list form
 * `status` has always had), so a column holding two standings is one bounded, ordered,
 * walkable page with one `total` — not two lists stitched in the browser, which cannot
 * be ordered across, cannot be grown, and would put the column straight back to stating
 * whichever half it consumed as its size.
 *
 * `shown` is how many cards the reader has asked for, so growing a column is a wider
 * bound rather than an offset: the column is a set somebody is working top-down, and a
 * second request starting where the first stopped would let a row that moved in between
 * be skipped or drawn twice.
 */
export function leadsColumnPageQuery(req: {
  column: LeadBoardColumnKey;
  search: string;
  shown: number;
}): Record<string, string> {
  const query: Record<string, string> = {
    view: "basic",
    standing: STANDINGS_BY_COLUMN[req.column].join(","),
    sort: "activity",
    limit: String(Math.max(1, Math.trunc(req.shown))),
  };
  const q = leadsSearchParam(req.search);
  if (q) query.q = q;
  return query;
}

/** Pages available for a total, never fewer than one (an empty tab still has page 1). */
export function pageCountFor(total: number | null | undefined): number {
  if (total == null) return 1;
  return Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
}
