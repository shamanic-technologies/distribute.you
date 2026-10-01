import { isSubscriptionArm } from "./subscription-plan";

/**
 * Where the landing's `/start` sends a visitor (owner 2026-10-01: onboarding v2,
 * `/get-started`, replaces `/onboarding` as the public entry; v1 stays served).
 *
 * The `subscription` arm (`lp_variant` cookie) keeps `/onboarding` until v2 sells
 * the $99/month plan and its trial: until then v2 would charge them the Ads budget
 * model. A signed-in visitor goes to v2 too, which sends them to their dashboard.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */
export function startDestination(cookieHeader: string | null | undefined): "/get-started" | "/onboarding" {
  if (isSubscriptionArm(cookieHeader)) return "/onboarding";
  return "/get-started";
}
