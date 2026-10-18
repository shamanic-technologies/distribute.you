/**
 * What a new client's organisation is called. Never "Personal".
 *
 * Clerk creates the org at signup from the instance template
 * `{{user.full_name}}`, falling back to "Personal" when the person gave no
 * name. A business that signs up through /get-started then sees its work filed
 * under "Personal" (cexo@cexoai.com, 2026-10-17, renamed by hand next day).
 *
 * Owner rule (2026-10-18): the org is named after the BRAND; with no brand,
 * after the email's DOMAIN unless it is a free-mail domain (gmail & co); with
 * neither, after the person's FULL NAME. When even that is missing we use the
 * email's local part: still the person, never a placeholder.
 *
 * Alias-free on purpose so it carries real unit tests.
 */

/** Free-mail providers whose domain says nothing about a business. Matched on
 *  the exact domain, so a company's own `mail.acme.io` is never caught. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr", "hotmail.co.uk", "live.com", "live.fr", "msn.com",
  "yahoo.com", "yahoo.fr", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "pm.me",
  "aol.com", "gmx.com", "gmx.de", "gmx.fr", "gmx.net", "mail.com", "web.de",
  "zoho.com", "yandex.com", "yandex.ru", "mail.ru", "qq.com", "163.com",
  "fastmail.com", "hey.com", "tutanota.com", "tuta.io",
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net",
]);

/** Free-mail families that exist under many country TLDs (`yahoo.es`,
 *  `hotmail.it`, `outlook.de`): the label before the first dot. */
const FREE_MAIL_FAMILIES = new Set(["gmail", "outlook", "hotmail", "live", "yahoo", "gmx", "yandex"]);

export function isFreeMailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (FREE_MAIL_DOMAINS.has(d)) return true;
  return FREE_MAIL_FAMILIES.has(d.split(".")[0]);
}

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : null;
}

export interface OrgNameInput {
  brandName?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** The person's full name as Clerk's `{{user.full_name}}` spells it. */
export function fullNameOf(firstName?: string | null, lastName?: string | null): string | null {
  return clean([clean(firstName), clean(lastName)].filter(Boolean).join(" "));
}

/**
 * The name the org should carry, or `null` when nothing at all is known (no
 * brand, no email, no name): the caller then leaves the org as it is.
 */
export function orgNameFor(input: OrgNameInput): string | null {
  const brand = clean(input.brandName);
  if (brand) return brand;

  const email = clean(input.email)?.toLowerCase() ?? null;
  const at = email ? email.lastIndexOf("@") : -1;
  const domain = email && at > 0 ? clean(email.slice(at + 1)) : null;
  if (domain && !isFreeMailDomain(domain)) return domain;

  const full = fullNameOf(input.firstName, input.lastName);
  if (full) return full;

  return email && at > 0 ? clean(email.slice(0, at)) : null;
}

/**
 * Is `current` the name Clerk gave the org on its own (so ours may replace it),
 * rather than one the person typed? Clerk's auto value is the full name, or
 * "Personal" when there was none.
 */
export function isClerkAutoOrgName(
  current: string | null | undefined,
  firstName?: string | null,
  lastName?: string | null,
): boolean {
  const name = clean(current);
  if (!name) return true;
  if (name === "Personal") return true;
  const full = fullNameOf(firstName, lastName);
  return full !== null && name === full;
}
