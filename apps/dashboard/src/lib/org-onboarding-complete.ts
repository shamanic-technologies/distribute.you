/**
 * Has this org already been set up?
 *
 * ONE rule, because two surfaces ask it about the same org and a second spelling
 * is how they come to disagree: the onboarding chrome decides whether a person
 * is trapped on the first-run flow or gets a way back to a live tenant, and the
 * wizard decides whether it may rename the org it is standing on.
 *
 * `publicMetadata.onboardingComplete` is the authoritative answer and is written
 * once, at the terminal launch (`POST /api/onboarding/complete`), by the server.
 * It is the SAME fact `proxy.ts` reads off the session claim to decide whether a
 * dashboard URL opens at all — so an org this returns `true` for is, by
 * construction, one somebody has already finished setting up and is using.
 *
 * ⚠️ Anything else that LOOKS like a first-run signal is not one. The URL shape
 * is the tempting substitute (`/onboarding` with no `?from=add`), and it is
 * wrong: `/start` redirects onto that exact address and the landing sends every
 * visitor through it, signed-in customers included.
 *
 * Structural on purpose (no Clerk import), so it stays alias-free and carries
 * real unit tests. `undefined` — the org read has not resolved yet — answers
 * FALSE rather than throwing: every caller treats false as "not established",
 * which is the safe reading for a first-run trap and, for the rename, one that
 * cannot fire anyway while `organization` is still null.
 */
export type OrgOnboardingMetadata = {
  publicMetadata?: { onboardingComplete?: unknown } | null | undefined;
};

export function orgOnboardingComplete(
  org: OrgOnboardingMetadata | null | undefined,
): boolean {
  return org?.publicMetadata?.onboardingComplete === true;
}

/** Does this person already hold an org they have finished setting up? */
export function hasCompletedOrg(
  orgs: ReadonlyArray<OrgOnboardingMetadata> | null | undefined,
): boolean {
  return !!orgs?.some((org) => orgOnboardingComplete(org));
}
