// ONE poll cadence across the whole dashboard: 15s. The old 10s/30s `Slow`/`Slower`
// tiers were dropped (their only consumers were either deleted dead routes or
// repointed here). Idle/hidden-tab polling is still paused globally by
// `installIdleFocusManager` (idle-focus-manager.ts), so an AFK tab stops polling.
//
// PAIRED WITH features-service's Gold cache TTL (30s) — do not read one without the
// other. That cache serves a snapshot instantly while it is younger than the TTL, and
// past it serves instantly AND kicks one background refresh. So the TTL, not this
// interval, governs how often the expensive cross-service fan-out actually re-runs:
// at 15s the poll at t=15s is a free hit and the poll at t>=30s triggers one refresh.
// A number on screen is therefore at most ~45s old (30s TTL + this interval).
//
// Halving this while the TTL was still 5s would have made EVERY poll a stale hit and
// doubled the fan-out rate against the Neon-backed sibling services. The 30s TTL
// shipped in features-service v0.109.0; this change is only safe on top of it. If the
// TTL is ever lowered, raise this back — the rule is TTL >= poll interval.
export const POLL_INTERVAL = 15_000;

export const pollOptions = {
  refetchInterval: POLL_INTERVAL,
} as const;
