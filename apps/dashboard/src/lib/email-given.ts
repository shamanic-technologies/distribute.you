/**
 * A visitor who types their email to get a sign-up code becomes a lead at that moment,
 * before the code arrives (owner 2026-11-24, netzrecruiter.com: three codes asked, none
 * received, the person left and we held no address to write to).
 *
 * The address goes on their PostHog person, the same way the phone and name typed at
 * onboarding do (get-started.tsx `recordVisitor`): crm-service's PostHog connector, the
 * one any client plugs, mirrors every person holding an email into the Unibox, where our
 * campaign on Lead events decides whether to write. The person property keeps the LAST
 * address; each attempt is also an event carrying its own address, so a visitor who tries
 * several addresses leaves every one of them on record.
 *
 * Alias-free on purpose: the caller passes its PostHog client, so a unit test can run it.
 */

export type EmailGivenSurface = "get-started" | "sign-up";

export interface PosthogLike {
  setPersonProperties(props: Record<string, unknown>): void;
  capture(event: string, props?: Record<string, unknown>): void;
}

export const EMAIL_GIVEN_EVENT = "signup_email_given";

export function recordEmailGiven(
  posthog: PosthogLike,
  raw: string,
  surface: EmailGivenSurface,
): void {
  const email = raw.trim().toLowerCase();
  if (!email) return;
  posthog.setPersonProperties({ email });
  posthog.capture(EMAIL_GIVEN_EVENT, { email, surface });
}
