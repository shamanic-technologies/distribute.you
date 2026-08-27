/**
 * What to tell someone whose org switch did not go through.
 *
 * `handleOrgSwitch` bounds every leg of the switch with `withTimeout`, so a dead
 * network now produces a LOUD failure instead of a spinner that never ends. The
 * message that failure carried blamed the wrong party: "Couldn't reach the auth
 * service" reads as an outage on our side, and the case it fires on most is a
 * laptop that lost its connection. Reported from a console where EVERY request
 * on the page had failed `net::ERR_INTERNET_DISCONNECTED`, PostHog's CDN
 * included, so nothing about the auth service was in question.
 *
 * `navigator.onLine` is only trustworthy in ONE direction: `false` means the
 * browser has no network interface at all, which is decisive. `true` means it
 * has one and says nothing about whether anything is reachable. So it is read
 * ONLY to sharpen the offline case and never to claim the network is fine.
 *
 * Alias-free (no `@/…` import) so it carries real unit tests rather than a
 * source-substring guard - keep it that way.
 */

/** True for a failure produced by `withTimeout`. Kept structural rather than
 *  importing `isTimeoutError`, so this module stays dependency-free. */
function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

export const OFFLINE_MESSAGE =
  "You appear to be offline. Reconnect and try again.";
export const AUTH_UNREACHABLE_MESSAGE =
  "Couldn't reach the auth service. Check your connection and try again.";
export const GENERIC_MESSAGE = "Could not switch organization.";

/**
 * @param err     whatever `handleOrgSwitch` caught.
 * @param online  `navigator.onLine` at the moment of the failure. Passed in
 *                rather than read here so the module stays testable and has no
 *                opinion about running in a browser.
 */
export function orgSwitchErrorMessage(err: unknown, online: boolean): string {
  if (isTimeout(err)) {
    return online ? AUTH_UNREACHABLE_MESSAGE : OFFLINE_MESSAGE;
  }
  // A refusal states its own reason (a failed staff join names its status), and
  // that sentence is more useful than anything written here.
  if (err instanceof Error && err.message.trim()) return err.message;
  return GENERIC_MESSAGE;
}
