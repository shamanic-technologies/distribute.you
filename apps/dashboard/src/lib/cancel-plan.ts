/**
 * The cancel-plan flow's rules, kept alias-free so they get real unit tests.
 *
 * Owner 2026-10-03: cancelling must give the customer every reason to stay. Four
 * screens (what you lose, why you leave, an offer fitted to the reason, the final
 * confirm). The way out stays visible on every screen: online-cancel laws (California
 * auto-renewal, the EU cancel button, ROSCA) and Stripe disputes punish a cancel the
 * customer cannot find.
 */

/** What the customer loses, in the owner's order. */
export const SUBSCRIPTION_LOSSES = [
  "Your outreach stops. No new prospect gets an email.",
  "Follow-ups stop, so the conversations already started go quiet.",
  "Replies from your leads are no longer handled, and you lose them.",
  "You lose access to your contact list.",
  "You lose access to the history of every email we sent.",
] as const;

/**
 * The cancel flow opens with one screen per loss (owner 2026-10-03): a red cross, what
 * stops the moment they cancel, and what staying keeps doing for them.
 */
export const CANCEL_LOSS_STEPS = [
  {
    id: "loss_outreach",
    loss: "Your outreach stops now.",
    detail: "No new prospect gets an email from you again.",
    keep: "Stay, and new prospects hear from you every day.",
  },
  {
    id: "loss_follow_ups",
    loss: "Your follow-ups stop now.",
    detail: "The conversations already started go quiet.",
    keep: "Stay, and every follow-up goes out on time.",
  },
  {
    id: "loss_replies",
    loss: "Your replies go unanswered from now on.",
    detail: "Leads who write back hear nothing, and you lose them.",
    keep: "Stay, and every reply is handled for you.",
  },
  {
    id: "loss_contacts",
    loss: "You lose your contact list now.",
    detail: "Every prospect we found for you is gone.",
    keep: "Stay, and your list keeps growing.",
  },
  {
    id: "loss_history",
    loss: "You lose every email we sent.",
    detail: "The full history of your outreach is gone.",
    keep: "Stay, and you keep every email and every reply.",
  },
] as const;
export type CancelLossStep = (typeof CANCEL_LOSS_STEPS)[number]["id"];

export const CANCEL_STEPS = [...CANCEL_LOSS_STEPS.map((l) => l.id), "reason", "offer", "confirm"] as const;
export type CancelStep = CancelLossStep | "reason" | "offer" | "confirm";

export function lossStep(step: CancelStep) {
  return CANCEL_LOSS_STEPS.find((l) => l.id === step) ?? null;
}

export const CANCEL_REASONS = [
  { id: "too_expensive", label: "It costs too much" },
  { id: "no_results", label: "I am not getting results" },
  { id: "need_a_break", label: "I need a break" },
  { id: "other", label: "Something else" },
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number]["id"];

/** The smallest plan on billing's ladder, and the stay-for-less form's prefill. */
export const LOWEST_PLAN_CENTS = 9900;

/** The least a customer may type to stay (owner 2026-10-03). */
export const STAY_MIN_USD = 29;

/** The typed amount in cents when it is whole dollars from $29, else null. */
export function stayAmountCents(typed: string): number | null {
  const t = typed.trim().replace(/^\$/, "");
  if (!/^\d+$/.test(t)) return null;
  const usd = Number(t);
  return usd >= STAY_MIN_USD ? usd * 100 : null;
}

export type SaveOffer = "lower_plan" | "pause" | "talk";

/** The pause lengths billing accepts. */
export const PAUSE_MONTHS = [1, 2, 3] as const;
export type PauseMonths = (typeof PAUSE_MONTHS)[number];

/**
 * The offer that answers the reason. Price: stay for less (any amount from $29, owner
 * 2026-10-03) when billing says the amount can move now (a trial counts: it starts
 * paying at once), else a pause. A break: a pause. A pause only when billing says the
 * plan can pause. Everything else, and a skipped reason, is a talk with Kevin.
 */
export function saveOfferFor(
  reason: CancelReason | null,
  plan: { monthlyAmountCents: number; canChangeAmount: boolean; canPause: boolean },
): SaveOffer {
  if (reason === "too_expensive" && plan.canChangeAmount) return "lower_plan";
  if ((reason === "too_expensive" || reason === "need_a_break") && plan.canPause) return "pause";
  return "talk";
}

export function nextCancelStep(step: CancelStep): CancelStep {
  const i = CANCEL_STEPS.indexOf(step);
  return CANCEL_STEPS[Math.min(i + 1, CANCEL_STEPS.length - 1)];
}

export const TALK_EMAIL = "kevin@distribute.you";

export function talkHref(reason: CancelReason | null): string {
  const label = CANCEL_REASONS.find((r) => r.id === reason)?.label ?? "I was about to cancel";
  return `mailto:${TALK_EMAIL}?subject=${encodeURIComponent("Before I cancel my plan")}&body=${encodeURIComponent(`${label}.\n\n`)}`;
}
