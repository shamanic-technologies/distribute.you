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

export const pollOptions = {
  refetchInterval: pollIntervalFor,
} as const;
