/**
 * A query's data only when it belongs to the query's CURRENT key.
 *
 * The app-wide `placeholderData: keepPreviousData` hands a re-keyed query the previous
 * key's data while the new key loads, and a query re-keyed to a disabled key (no lead row
 * for a CRM-only person) keeps serving it forever. A per-entity read (one person, one lead)
 * renders that as the NEW entity's facts: the Unibox showed the last person's outreach on a
 * person we never emailed. Read per-entity data through this, never `q.data`.
 */
export function ownQueryData<T>(q: { data: T | undefined; isPlaceholderData: boolean }): T | undefined {
  return q.isPlaceholderData ? undefined : q.data;
}
