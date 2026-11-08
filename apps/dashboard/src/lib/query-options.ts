// ONE poll cadence across the whole dashboard: 5s. The old 10s/30s `Slow`/`Slower`
// tiers were dropped (their only consumers were either deleted dead routes or
// repointed here). Idle/hidden-tab polling is still paused globally by
// `installIdleFocusManager` (idle-focus-manager.ts), so an AFK tab stops polling.
//
// PAIRED WITH features-service's view-cache TTL, which is 5s — read the producer, not
// this comment: `src/lib/view-cache.ts` `DEFAULT_TTL_MS = 5_000`, and no
// `FEATURE_VIEW_SNAPSHOT_TTL_MS` override is set on the box. Inside the TTL a request
// is served from the snapshot with no fan-out; past it the snapshot is served ANYWAY
// and one background refresh is kicked. So the expensive cross-service fan-out runs at
// most once per TTL no matter how often this polls — the interval buys freshness on
// screen, it does not multiply work upstream.
//
// A number on screen is therefore at most ~10s old (5s snapshot age + 5s until the next
// poll). This was 60s and was corrected: the owner's rule is that a refresh may lag but
// never by more than about 5s. The comment that used to sit here claimed a 30s producer
// TTL and warned that lowering the interval was dangerous; both were stale.
export const POLL_INTERVAL = 5_000;

/**
 * The poll interval for one query at one moment: every 5s, EXCEPT a read that has
 * failed and holds no data. React Query resets such a query to `pending` on every
 * refetch, so polling it flips its surface skeleton, error, skeleton each tick: the
 * page blinks. It stops polling and retries on the next window focus or navigation.
 * A read that has data keeps polling whatever its last fetch did (keepPreviousData
 * holds the last answer on screen, so a failed refetch repaints nothing).
 */
export function pollIntervalFor(query: { state: { status: string; data: unknown } }): number | false {
  return query.state.status === "error" && query.state.data === undefined ? false : POLL_INTERVAL;
}

/**
 * Whether a read refetches when the user comes back to the tab (window focus) or the
 * network comes back: always, EXCEPT a read that failed and holds no data. Same reason as
 * `pollIntervalFor`: the refetch resets it to `pending`, and every page that reveals once
 * its reads have answered (`data !== undefined || isError`) goes back to its skeleton until
 * the failure comes back again (owner 2026-11-08: Outcomes re-showed its skeleton on every
 * return from another macOS desktop). Such a read retries on the next navigation.
 */
export function refetchOnReturn(query: { state: { status: string; data: unknown } }): boolean {
  return !(query.state.status === "error" && query.state.data === undefined);
}

export const pollOptions = {
  refetchInterval: pollIntervalFor,
} as const;

/**
 * The public channel catalogue (`["publicCatalogue"]`: steps, legs, channel names, marks and
 * terms) is not a figure: it moves only when staff edit the catalogue. Polled at the 5s cadence it
 * was re-read 2-3 times per page view by every open tab (21KB each, the dashboard's most repeated
 * read, 2026-11-07), so it refreshes once a minute and on navigation instead. Same no-data-error
 * stop as `pollIntervalFor`.
 */
export const CATALOGUE_REFRESH_MS = 60_000;
export const catalogueReadOptions = {
  staleTime: CATALOGUE_REFRESH_MS,
  refetchInterval: (query: { state: { status: string; data: unknown } }): number | false =>
    query.state.status === "error" && query.state.data === undefined ? false : CATALOGUE_REFRESH_MS,
} as const;

/**
 * Data whose PRODUCER moves on minutes (owner 2026-11-08, PAGE-SPEED-1107 option A): lead-service's
 * reads (Needs your call, Unibox, Deals, lead stages, a person's history and conversation, team queue)
 * are refreshed every 30 s to 3 min at the producer, and crm-service's people per outcome every 1-2 min.
 * Re-asked every 5 s by every tab they returned the same answer 6-36 times while the box sat
 * CPU-saturated. A user's OWN write still shows at once (write-invalidation re-reads its roots).
 */
const everyMs = (ms: number) => (query: { state: { status: string; data: unknown } }): number | false =>
  query.state.status === "error" && query.state.data === undefined ? false : ms;
export const LEAD_READ_REFRESH_MS = 30_000;
export const leadReadOptions = { refetchInterval: everyMs(LEAD_READ_REFRESH_MS) } as const;
export const PEOPLE_OUTCOMES_REFRESH_MS = 60_000;
export const peopleOutcomesReadOptions = { refetchInterval: everyMs(PEOPLE_OUTCOMES_REFRESH_MS) } as const;
