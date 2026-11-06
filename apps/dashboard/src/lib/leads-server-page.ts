import { z } from "zod";

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
 * `limit`/`cursor`/`q`/`bucket`/`sort`/`format`; every count is a Unibox read now). This module is the one
 * place that speaks that vocabulary: the tab-to-bucket map, the request builder, the
 * response parsers, and the rule for what the search box may send.
 *
 * Alias-free on purpose — its only imports are zod and a type that is erased at build —
 * so it carries REAL unit tests rather than source-substring guards. Keep it that way.
 */

/**
 * The engagement buckets lead-service names. These are ITS tokens, not the dashboard's
 * tab keys, and the two vocabularies are deliberately kept apart: the producer owns
 * which buckets exist. `meeting_attended` has no tab.
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
  // People an AI Instant Call campaign placed a booking call with (lead-service v0.83.31).
  "booking_call",
] as const;
export type LeadBucket = (typeof LEAD_BUCKETS)[number];

/**
 * The bucket the PAGE is about: everyone we contacted.
 *
 * It is what the title counts (`reachablePopulation`) and what an export downloads, and
 * those two must be ONE constant or the header states a population the file does not
 * carry — which is exactly how a correct export came to read as truncated by three
 * orders of magnitude. The other buckets are subsets of it, so it is the union's floor
 * and the only honest answer to "all of them".
 */
export const REACHABLE_BUCKET: LeadBucket = "contacted";

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
 * The query lead-service reads. Every key is omitted when it carries no instruction, so
 * an unfiltered first page is byte-identical to what this endpoint has always answered
 * plus the bound — which is what keeps the producer's "absent means unchanged" promise
 * meaningful on this caller.
 */
function leadsScopeQuery(bucket: LeadBucket, search: string): Record<string, string> {
  const query: Record<string, string> = {
    view: "basic",
    bucket,
    sort: "activity",
  };
  const q = leadsSearchParam(search);
  if (q) query.q = q;
  return query;
}

/**
 * The EXPORT's query — every lead the page holds, whatever tab is open, and NO bound.
 *
 * Two different truncations have made this download read as broken, and they are worth
 * keeping apart because the second one is invisible.
 *
 * The bound: the export reused `leadsPageQuery({ ..., page: 0 })` for a while, which
 * always carries `limit=50`, and lead-service honours that on the CSV path exactly as on
 * the JSON one. A customer pressing Export on a tab whose header read `8,135 leads`
 * downloaded 50 — a valid file, right columns, right headings, right scope. Absent
 * `limit` is the producer's own word for "the whole matching set".
 *
 * The TAB: the query then followed `activeTab`, so a press on Positive replies downloaded
 * that bucket alone — 20 rows against a header reading 16,212, measured in production.
 * Nothing was wrong with the file; the page simply stated one population and exported
 * another, which reads as a truncation of three orders of magnitude. Owner-decided: the
 * download is EVERY row the page has, regardless of the tab being looked at. So it names
 * `REACHABLE_BUCKET` — the same bucket the title counts — and the file and the header
 * can no longer disagree.
 *
 * The SEARCH still travels: it is what the reader typed, and a download that silently
 * ignored it would surprise in the other direction.
 */
export function leadsExportQuery(req: { search: string }): Record<string, string> {
  return leadsScopeQuery(REACHABLE_BUCKET, req.search);
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

