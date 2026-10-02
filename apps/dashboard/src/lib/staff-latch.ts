/**
 * The signed-in email the staff gate reads, LATCHED: Clerk's `useUser()` reports `user: null`
 * for a moment while it rotates the session token (~1/min) and on tab focus. Read raw, that
 * blink turned Staff mode off for one render, so every staff page (StaffOnly) blanked and
 * remounted, and a reader on the Actual cost basis was flipped to User cost and back: the
 * Research pages "showed the data, then it vanished". A null only keeps the last resolved
 * email; a DIFFERENT non-null email (another account) replaces it at once.
 *
 * Alias-free so it carries a real unit test (tests/staff-latch.test.ts).
 */
export function latchedEmail(previous: string | null, live: string | null | undefined): string | null {
  return live ?? previous;
}
