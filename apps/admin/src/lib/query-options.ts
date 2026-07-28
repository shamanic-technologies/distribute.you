// ONE poll cadence across the whole admin app: 30s (mirrors apps/dashboard).
// The old 5s base and the 10s `Slow` tier are gone: every polled query here goes
// through the /api/v1 proxy, and a 5s cadence on the unbounded brand list queries
// (emails / leads / outlets / journalists / articles — full payloads fetched only
// to render a sidebar count badge) kept several multi-MB responses in flight on
// the same fluid-compute instance, which OOM-killed it and 500'd unrelated
// requests. Idle/hidden-tab polling is paused globally by `installIdleFocusManager`
// (idle-focus-manager.ts), so an AFK tab stops polling regardless of cadence.
export const POLL_INTERVAL = 30_000;

export const pollOptions = {
  refetchInterval: POLL_INTERVAL,
} as const;

// Aliases so the existing `pollOptionsSlow` / `pollOptionsSlower` call sites keep
// working. All three are the same 30s cadence — do not re-introduce a faster tier.
export const POLL_INTERVAL_SLOW = POLL_INTERVAL;
export const POLL_INTERVAL_SLOWER = POLL_INTERVAL;

export const pollOptionsSlow = pollOptions;

export const pollOptionsSlower = pollOptions;
