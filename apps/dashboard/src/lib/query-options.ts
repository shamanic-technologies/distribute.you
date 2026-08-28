// ONE poll cadence across the whole dashboard: 60s. The old 10s/30s `Slow`/`Slower`
// tiers were dropped (their only consumers were either deleted dead routes or
// repointed here). Idle/hidden-tab polling is still paused globally by
// `installIdleFocusManager` (idle-focus-manager.ts), so an AFK tab stops polling.
//
// RAISED 15s -> 60s, owner-decided: "je favoriserais le instant print, pas grave si
// la data met quelques secondes a etre mise a jour". The poll is what the dashboard
// pays CONTINUOUSLY — 48 call sites re-fetching and re-rendering, against a
// cross-service fan-out — and none of it is what a reader is waiting for, because the
// local-first cache paints the previous answer instantly. `refetchOnWindowFocus` and
// `refetchOnReconnect` still fire, so arriving at a tab is fresh on arrival; the
// interval only governs how stale a number gets while you sit and watch it.
//
// PAIRED WITH features-service's Gold cache TTL (30s) — do not read one without the
// other. That cache serves a snapshot instantly while it is younger than the TTL, and
// past it serves instantly AND kicks one background refresh. So the TTL, not this
// interval, governs how often the expensive fan-out actually re-runs. A number on
// screen is at most ~90s old (30s TTL + this interval), which is the freshness being
// traded away for the instant paint.
//
// LOWERING this is the dangerous direction: below the TTL every poll is a stale hit
// and the fan-out rate against the Neon-backed sibling services multiplies. The 30s
// TTL shipped in features-service v0.109.0; the rule is TTL >= poll interval, so
// raising the interval is always safe and lowering it needs the TTL checked first.
export const POLL_INTERVAL = 60_000;

export const pollOptions = {
  refetchInterval: POLL_INTERVAL,
} as const;
