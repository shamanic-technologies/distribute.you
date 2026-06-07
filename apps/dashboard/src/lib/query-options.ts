export const POLL_INTERVAL = 5_000;
export const POLL_INTERVAL_SLOW = 10_000;
export const POLL_INTERVAL_SLOWER = 30_000;

export const pollOptions = {
  refetchInterval: POLL_INTERVAL,
} as const;

export const pollOptionsSlow = {
  refetchInterval: POLL_INTERVAL_SLOW,
} as const;

export const pollOptionsSlower = {
  refetchInterval: POLL_INTERVAL_SLOWER,
} as const;
