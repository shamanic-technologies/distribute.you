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

/**
 * The audience blocker is not binary. A brand needs at least one active audience
 * that still has people left to contact:
 *  - `zero-active`   → no active audience at all (first-run setup).
 *  - `exhausted`     → active audiences exist but every one is fully contacted (0%).
 *  - `low-remaining` → active audiences exist but all are almost drained (< threshold).
 *  - `none`          → at least one active audience still has a healthy pool.
 */
export type AudienceNudgeTier = "none" | "zero-active" | "exhausted" | "low-remaining";

/** Minimal audience shape the nudge needs. `availableToContactPct` is the
 *  backend-computed % of the pool still contactable (0 = fully sent, 100 = fresh);
 *  optional until human-service serves it in prod (decoupled rollout). */
export interface AudienceNudgeInput {
  status: string;
  availableToContactPct?: number;
}

export interface AudienceNudge {
  tier: AudienceNudgeTier;
  /** For `low-remaining`: the best (max) remaining pct among active audiences. */
  remainingPct?: number;
}

/** An active audience counts as usable while its remaining pool is at or above
 *  this %. Below it (but > 0) we warn; at 0 we say it is done. Matches the
 *  audiences page "Remaining" red threshold. */
export const LOW_REMAINING_THRESHOLD_PCT = 5;

/**
 * Classify a brand's audience health for the reminder/banner surfaces. An ABSENT
 * `availableToContactPct` is treated as HEALTHY: the field is optional until
 * human-service serves it, and we never fabricate an exhaustion we cannot prove.
 * So the nudge fires only when every active audience has a KNOWN pct below the
 * threshold.
 */
export function audienceNudge(audiences: AudienceNudgeInput[]): AudienceNudge {
  const active = audiences.filter((a) => a.status === "active");
  if (active.length === 0) return { tier: "zero-active" };
  const healthy = active.some(
    (a) =>
      a.availableToContactPct == null ||
      a.availableToContactPct >= LOW_REMAINING_THRESHOLD_PCT,
  );
  if (healthy) return { tier: "none" };
  const maxRemaining = Math.max(
    ...active.map((a) => a.availableToContactPct ?? 0),
  );
  if (maxRemaining <= 0) return { tier: "exhausted" };
  return { tier: "low-remaining", remainingPct: maxRemaining };
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
  /** Audience health for the brand: zero active, exhausted, low, or none. */
  audienceNudge: AudienceNudge;
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
  if (state.audienceNudge.tier !== "none" && !state.audienceDismissed)
    return "audience";
  return null;
}

/**
 * The persistent red banner (mirrors the credit runway banner) shows whenever a
 * brand is in view and has no usable audience: none active, or every active one
 * is contacted out (exhausted / almost drained). Unlike the modal it is NOT
 * session-dismissable: it stays until the user extends or adds an audience.
 * `loaded` guards against flashing the banner before the audiences query
 * resolves.
 */
export function shouldShowNoAudienceBanner(args: {
  brandId: string | null;
  audienceNudge: AudienceNudge;
  loaded: boolean;
}): boolean {
  return args.loaded && args.brandId !== null && args.audienceNudge.tier !== "none";
}
