// ONE poll cadence across the whole dashboard: 30s. The old 10s/30s `Slow`/`Slower`
// tiers were dropped (their only consumers were either deleted dead routes or
// repointed here). Idle/hidden-tab polling is still paused globally by
// `installIdleFocusManager` (idle-focus-manager.ts), so an AFK tab stops polling.
export const POLL_INTERVAL = 30_000;

export const pollOptions = {
  refetchInterval: POLL_INTERVAL,
} as const;
