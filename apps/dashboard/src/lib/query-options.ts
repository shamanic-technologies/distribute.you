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

export const pollOptions = {
  refetchInterval: POLL_INTERVAL,
} as const;

// The one exception, and it is about PAYLOAD SIZE rather than freshness. The brand's
// leads list is unpaginated by design (the revenue engine and the leads page both want
// the whole population) and runs to ~100MB of slim rows on a heavy brand — polling that
// every 5s is 12x the transfer of the old cadence, continuously, per open tab, for a
// list whose contents only move when the backend sends. Every USER action that can
// change it invalidates it explicitly (see `write-invalidation.ts`), so the interval is
// only the backstop for somebody else's sending.
export const LEADS_POLL_INTERVAL = 15_000;

export const leadsPollOptions = {
  refetchInterval: LEADS_POLL_INTERVAL,
} as const;
