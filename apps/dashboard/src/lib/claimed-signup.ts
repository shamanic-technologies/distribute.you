/**
 * Where a refused signed-out setup sends the visitor, and what the sign-up
 * page says when it gets there.
 *
 * The signed-out flow runs only on a website nobody holds. When the server
 * refuses because somebody already does (`reason: "claimed"`), the visitor was
 * sent to a bare `/sign-up` that read "Create your account" over a form, with
 * nothing saying why the setup stopped. This module carries the reason across:
 * the redirect names the website, and the page states the situation.
 *
 * The other refusals (a typo, a check we could not run) are ours, and the page
 * stays generic for them. Alias-free so it carries real unit tests.
 */

/** Query key on `/sign-up` naming the website somebody already holds. */
export const CLAIMED_PARAM = "claimed";

/**
 * The `/sign-up` href for a refused setup. `url` rides along on every refusal
 * so signing up lands back on the website they typed; `claimed` only when the
 * server said somebody holds it.
 */
export function claimedSignUpHref(input: {
  reason: string;
  domain: string | null | undefined;
  brandUrl: string;
}): string {
  const params = new URLSearchParams();
  const domain = input.domain?.trim();
  if (input.reason === "claimed" && domain) params.set(CLAIMED_PARAM, domain);
  if (input.brandUrl.trim()) params.set("url", input.brandUrl.trim());
  const query = params.toString();
  return query ? `/sign-up?${query}` : "/sign-up";
}

/**
 * What the URL step offers under a refusal, INLINE, instead of sending the
 * visitor away. The redirect shipped for one day (#4296) and stranded a
 * visitor whose website was already held: the sign-up wall had no way back to
 * the field, so they could not change the website (owner 2026-09-19: "I arrive
 * here directly and I am stuck because I want to change the brand. It should
 * instead bring me back to the step about input the URL"). The step keeps the
 * typed website editable and states the two exits as links; nobody is sent.
 *
 * `signIn` exists only for a website somebody holds: signing in is the answer
 * when it is theirs. Every refusal offers `signUp`, carrying the website so the
 * account lands back on it.
 */
export interface RefusalExits {
  signIn: { href: string; label: string; lead: string } | null;
  signUp: { href: string; label: string };
}

export function refusalExits(input: {
  reason: string;
  domain: string | null | undefined;
  brandUrl: string;
}): RefusalExits {
  const domain = input.domain?.trim();
  return {
    signIn:
      input.reason === "claimed" && domain
        ? { href: "/sign-in", label: "sign in", lead: `If ${domain} is yours,` }
        : null,
    signUp: { href: claimedSignUpHref(input), label: "Create an account anyway" },
  };
}

export interface ClaimedSignUpCopy {
  heading: string;
  /** Sentence before the sign-in link. */
  lead: string;
  signInLabel: string;
  /** Sentence after the sign-in link. */
  tail: string;
}

/**
 * The heading block for a website somebody already holds. `null` when the
 * param is absent or blank, so the page renders exactly as it did before.
 */
export function claimedSignUpCopy(claimed: string | null | undefined): ClaimedSignUpCopy | null {
  const domain = claimed?.trim();
  if (!domain) return null;
  return {
    heading: `${domain} is already set up with us`,
    lead: "If it is yours,",
    signInLabel: "sign in",
    tail: "to pick it up. Otherwise create your account and we get you started with it right after.",
  };
}
