import { isFreeEmailDomain } from "./free-email-domains";

/**
 * Is the string a person typed in a WEBSITE field actually a website.
 *
 * This app owns the rule, so the rule lives here: the field feeds brand
 * creation, and brand-service takes whatever domain we send it. There is no
 * producer to ask and no second copy to drift from.
 *
 * SHAPE only. It answers "could this be a website at all", never "does this
 * site exist" (that needs a fetch) and never "is this the right site" (only the
 * person knows). So it refuses what cannot be one and accepts everything else.
 *
 * Why it exists: the field used to accept anything containing a dot, so an
 * email address passed. `kevin@gmail.com` parses as a URL whose hostname is
 * `gmail.com`, so the brand was created on Gmail's domain, brand-service read
 * Google's marketing site, and the customer watched their own offer described
 * with Gmail's pitch. Nothing errored anywhere. Measured 2026-09-12: three
 * signups reached that state, and because brand-service shares a brand by
 * domain, each new one joined the same poisoned row rather than getting a
 * fresh broken one.
 *
 * Note the asymmetry with `businessDomainFromEmail`, which has always refused a
 * free-mail domain: the GUESS derived from the signup email was guarded while
 * the value the person actually TYPED was not. A typed value is stated intent,
 * which is exactly why it reads as trustworthy, and it is also the one that can
 * be a typo.
 *
 * An EMPTY string is NOT a problem here. The caller decides what empty means:
 * the onboarding button is already disabled on it, and the landing carry simply
 * stores nothing.
 *
 * Alias-free on purpose so it carries real unit tests rather than
 * source-substring guards. Keep it that way.
 */

/**
 * Shaped like a hostname whose last label is a letter TLD. Rejects an IP
 * literal, a bare `localhost`, a single label, and a trailing-dot or
 * trailing-dash host, none of which a customer means as their website.
 *
 * Deliberately a copy of the shape `businessDomainFromEmail` checks rather than
 * an import from `extract-domain.ts`: that module's `extractDomain` is
 * intentionally lax (four callers depend on it accepting a stored brand URL
 * verbatim), so tightening it there would reach further than this field.
 */
const HOSTNAME_WITH_LETTER_TLD = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;

/** What we say when the string is an email address rather than a website. */
export const EMAIL_IN_WEBSITE_FIELD =
  "That looks like an email address. We need the website you want us to promote.";

/** What we say when it is neither an email nor a usable hostname. */
export const NOT_A_WEBSITE = "That doesn't look like a website. Try something like acme.com.";

/**
 * The one sentence to show, or `null` when the input is a website we can use.
 * Every branch names what we need instead, because a refusal that only says
 * "invalid" makes the person guess which part we did not like.
 */
export function websiteInputProblem(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  // Caught before parsing: an address that does not parse at all should still
  // be told it looks like an email, which is the actionable half.
  if (trimmed.includes("@")) return EMAIL_IN_WEBSITE_FIELD;

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return NOT_A_WEBSITE;
  }

  // A `javascript:`/`data:` input parses fine and must never be stored, let
  // alone rendered back into a field somebody then submits.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return NOT_A_WEBSITE;

  // Userinfo is the other spelling of an email address (`https://kevin@gmail.com`),
  // and no website a customer types carries it.
  if (parsed.username || parsed.password) return EMAIL_IN_WEBSITE_FIELD;

  const host = parsed.hostname.toLowerCase();
  if (!HOSTNAME_WITH_LETTER_TLD.test(host)) return NOT_A_WEBSITE;

  // A mailbox provider typed on its own (`gmail.com`). Same message as the
  // address form, because it is the same mistake one step further along.
  if (isFreeEmailDomain(host)) return EMAIL_IN_WEBSITE_FIELD;

  return null;
}
