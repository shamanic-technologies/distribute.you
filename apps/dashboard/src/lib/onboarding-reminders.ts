// Pure gating logic + storage keys for the first-visit onboarding surfaces.
// Kept side-effect-free so the priority/visibility rules are unit-testable; the
// React components own the actual storage reads and fetches.

/** localStorage key: the welcome tour shows once per user, ever (per browser). */
export function welcomeSeenKey(userId: string): string {
  return `distribute:welcome-seen:${userId}`;
}

export type ReminderKind = "topup" | "audience";

/** sessionStorage key: a reminder modal is dismissable once per session, per brand. */
export function reminderDismissKey(brandId: string, kind: ReminderKind): string {
  return `distribute:reminder-dismissed:${kind}:${brandId}`;
}

export interface ReminderState {
  /** Billing account has auto top-up configured. */
  hasAutoTopup: boolean;
  /**
   * Off-session auto-reload is possible for the card's country. Absent => assume
   * supported (today's behavior). When `false` (e.g. India / RBI e-mandates),
   * auto-topup can never be enabled, so the funding reminder is a recharge that
   * shows ONLY when the wallet is out of credit (not as a proactive nudge).
   */
  autoReloadSupported?: boolean;
  /** Wallet balance is depleted (<= 0). Only used for auto-reload-blocked brands. */
  outOfCredit?: boolean;
  /** Number of audiences in `active` status for the brand. */
  activeAudienceCount: number;
  /** This-session dismissal flags (read from sessionStorage by the caller). */
  topupDismissed: boolean;
  audienceDismissed: boolean;
}

/**
 * Which reminder modal to show next, one at a time. Topup wins over audience
 * because a funded wallet is the upstream blocker (nothing runs without it).
 * Returns null when nothing is blocking or every blocker was dismissed this
 * session. The blocking CONDITION is what gates a reminder; once resolved the
 * modal never shows again.
 *
 * The funding blocker differs by card country:
 *  - auto-reload SUPPORTED   → nudge to enable auto-topup, until `hasAutoTopup`.
 *  - auto-reload UNSUPPORTED  → auto-topup is impossible, so the recharge reminder
 *    shows ONLY when the wallet is out of credit (`outOfCredit`).
 */
export function nextReminder(state: ReminderState): ReminderKind | null {
  const autoReloadSupported = state.autoReloadSupported ?? true;
  const fundingNeeded = autoReloadSupported
    ? !state.hasAutoTopup
    : (state.outOfCredit ?? false);
  if (fundingNeeded && !state.topupDismissed) return "topup";
  if (state.activeAudienceCount === 0 && !state.audienceDismissed) return "audience";
  return null;
}

/**
 * The persistent red banner (mirrors the credit runway banner) shows whenever a
 * brand is in view and has zero active audiences. Unlike the modal it is NOT
 * session-dismissable: it stays until the user actually adds an audience.
 * `loaded` guards against flashing the banner before the audiences query
 * resolves.
 */
export function shouldShowNoAudienceBanner(args: {
  brandId: string | null;
  activeAudienceCount: number;
  loaded: boolean;
}): boolean {
  return args.loaded && args.brandId !== null && args.activeAudienceCount === 0;
}
