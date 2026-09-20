/**
 * May this visitor build anonymously, and what do they see if not?
 *
 * The signed-out half of onboarding spends real money for somebody with no
 * account, so it does not start for everyone. This is the one place that
 * decides, and it is pure: the caller gathers the facts, this reads them.
 *
 * THE REFUSALS ARE NOT SYMMETRIC, and that is the design. A refused visitor is
 * not turned away — they get the flow we shipped before this existed, where the
 * card comes first. So every refusal here costs us a better first experience
 * and costs the visitor nothing, which is what makes failing closed cheap
 * enough to do on every uncertain case.
 *
 * Alias-free apart from the website rule it shares with every other field that
 * takes a URL, which is itself alias-free. Keep both that way: these are real
 * unit tests, and the refusals are the half worth testing.
 */

import { websiteInputProblem } from "./website-input";

/** What the caller knows about the domain, from the service that owns the answer. */
export type DomainClaim =
  /** No organisation claims it. The ordinary case for a new visitor. */
  | "unclaimed"
  /** Somebody already owns this brand. */
  | "claimed"
  /** We could not ask. Treated exactly like `claimed` — see `refusal`. */
  | "unknown";

export interface StartInput {
  /** Whatever the visitor typed. Not normalised; that is this module's job. */
  website: string;
  claim: DomainClaim;
  /**
   * The visitor said they HAVE no website ("I have no website" on the URL step).
   *
   * DECLARED, never inferred from an empty string — an empty `website` is also
   * what a blank or half-typed field gives, and that must keep being refused as
   * the typo it is. Same discipline as anonymity itself, which client-service
   * records at creation rather than reading off the shape of an id.
   *
   * A visitor with no website has NOTHING TO CLAIM: the claim question is about
   * a domain, and there is no domain. So the two refusals that exist to protect
   * another organisation's brand cannot apply, and asking them anyway would
   * refuse every no-website visitor on a question nobody can answer.
   */
  noWebsite?: boolean;
}

/** Why an anonymous session did not start. Shown to the visitor verbatim. */
export interface StartRefusal {
  reason: "bad-website" | "claimed" | "cannot-verify";
  /** One sentence, in the visitor's words, stating what happens next. */
  message: string;
}

export type StartDecision =
  | { start: true; website: string; refusal: null }
  | { start: false; website: null; refusal: StartRefusal };

/**
 * Said to a visitor whose domain somebody already owns.
 *
 * States what happens (the flow continues, with the card first) and NOTHING
 * about the other organisation — not that it exists, not who it is. A stranger
 * learning that a domain is "already taken" learns something about one of our
 * customers, and the honest phrasing costs nothing: from their side it is
 * simply which flow they get.
 */
export const CLAIMED_MESSAGE =
  "We already have this website set up. Sign in, or continue and we'll get you started.";

/**
 * Said when the claim question could not be answered.
 *
 * Deliberately the SAME outcome as a claimed domain, because the alternative is
 * to start spending on a domain that might belong to a paying customer — and
 * the thing that would be leaked is their scraped site and their extracted
 * offer. A worse first experience is the cheaper mistake, every time.
 */
export const CANNOT_VERIFY_MESSAGE =
  "We couldn't check this website just now. Continue and we'll get you started.";

/**
 * May this request REUSE the session the browser is already holding?
 *
 * A visitor who reloads, presses back, or simply types the same website twice
 * is the SAME walk, and minting a second org for them is not merely wasteful —
 * each one costs another trial seed and orphans everything the first one built.
 * It is also the common case: 8 of the 21 anonymous orgs alive when this shipped
 * held no brand at all, i.e. somebody started and immediately started again.
 *
 * The caller passes a session it has ALREADY VERIFIED (signature and expiry),
 * so reaching here at all is proof this browser minted that org. That is why no
 * claim check runs on this path: the visitor is not a stranger asking about a
 * domain, they are the person who already started it. Re-asking would find the
 * domain unclaimed — their own org does not claim it, which is the whole point
 * of the fix above — and mint the duplicate this exists to prevent.
 *
 * An EMPTY stored domain refuses. It is a legal token shape, and a session that
 * cannot say which website it is for cannot be shown to be this one.
 */
export function canReuseAnonSession(
  existing: { domain: string } | null | undefined,
  domain: string | null,
  noWebsite = false,
): boolean {
  if (!existing) return false;
  // A NO-WEBSITE walk has no domain to match on, and that is the whole of its
  // identity: this browser holds a session, and the visitor has said again that
  // they have no website, so it is the same walk. Without this the second click
  // mints a second org and a second trial seed and orphans the first, which is
  // exactly what the domain check above exists to prevent for everybody else.
  if (noWebsite) return existing.domain.length === 0;
  if (!domain) return false;
  return existing.domain.length > 0 && existing.domain === domain;
}

/**
 * The decision.
 *
 * `bad-website` is the visitor's own typo and carries the website rule's own
 * sentence, so the field says the same thing here as it does everywhere else a
 * URL is typed. The other two are ours, and neither blames the visitor.
 */
export function anonSessionStart({ website, claim, noWebsite }: StartInput): StartDecision {
  // Nothing to check and nothing to claim. Stated first because both rules
  // below are about a domain, and this visitor has none by their own account.
  if (noWebsite) return { start: true, website: "", refusal: null };

  const badWebsite = websiteInputProblem(website);
  if (badWebsite) {
    return { start: false, website: null, refusal: { reason: "bad-website", message: badWebsite } };
  }

  if (claim === "claimed") {
    return { start: false, website: null, refusal: { reason: "claimed", message: CLAIMED_MESSAGE } };
  }
  if (claim !== "unclaimed") {
    return {
      start: false,
      website: null,
      refusal: { reason: "cannot-verify", message: CANNOT_VERIFY_MESSAGE },
    };
  }

  return { start: true, website: website.trim(), refusal: null };
}
