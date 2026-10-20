import { sendAuthNotification } from "@/lib/api";
import { pingOwner } from "@/lib/owner-ping-client";
import { LAUNCH_OUTCOME_NOUN, isNewAccount, signupEmailsSentKey } from "@/lib/new-account";

let inFlight: Promise<void> | null = null;

/**
 * The signup emails, once per new account, whatever page they signed up on: the staff
 * `signup_notification` and the user's `welcome`. transactional-email-service sends each
 * once per org and user; the browser latch only spares repeat calls. A failure leaves the
 * latch unset, so the next page load inside the new-account window tries again. Rejects on
 * failure: the caller logs it.
 */
export function sendSignupEmailsOnce(p: {
  userId: string;
  createdAt: Date | number | null | undefined;
  promoCode?: string | null;
}): Promise<void> {
  if (!isNewAccount(p.createdAt)) return Promise.resolve();
  const key = signupEmailsSentKey(p.userId);
  try {
    if (localStorage.getItem(key)) return Promise.resolve();
  } catch {
    // No storage: the server dedup is the only latch.
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    await Promise.all([
      sendAuthNotification("signup_notification", undefined, p.promoCode ? { promoCode: p.promoCode } : undefined),
      // User-facing, routed to the new user server-side, once-only on {orgId}:welcome:{userId}.
      sendAuthNotification("welcome"),
    ]);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // No storage: nothing to remember.
    }
    pingOwner({ event: "signed_up" });
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * The launch email (`goal_launched`), sent when a launch has started the campaigns. Sent per
 * launch, as the v1 wizard did before #4998 deleted it with the wizard. Awaited by the caller
 * before it navigates away, so the request is not cut by the page change.
 */
export async function sendLaunchEmail(): Promise<void> {
  await sendAuthNotification("goal_launched", undefined, { outcomeNoun: LAUNCH_OUTCOME_NOUN });
}
