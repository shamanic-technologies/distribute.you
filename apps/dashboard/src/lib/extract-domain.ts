import { isFreeEmailDomain } from "./free-email-domains";

/** Extract a bare domain from user input (strips protocol, path, query, etc.).
 *  Returns null if the input does not parse as a valid hostname containing a dot.
 *  Accepts bare domains ("example.com"), protocol-less hosts, and full URLs. */
export function extractDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const hostname = new URL(withProtocol).hostname;
    if (!hostname || !hostname.includes(".")) return null;
    return hostname;
  } catch {
    return null;
  }
}

/** Shaped like a hostname whose last label is a letter TLD — rejects an IP
 *  literal ("192.168.1.1"), which `extractDomain` happily returns because it
 *  only checks for a dot. */
const HOSTNAME_WITH_LETTER_TLD = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;

/** The business domain behind an email address ("kevin@acme.com" -> "acme.com"),
 *  or null when the address is unusable or belongs to a free / personal / disposable
 *  provider (see `free-email-domains.ts` — "kevin@gmail.com" -> null, because
 *  gmail.com is a mailbox provider, not the product the user wants promoted).
 *
 *  Used to prefill the onboarding URL step. It is a GUESS, so callers must treat it
 *  as the weakest source: fill an empty field, never overwrite stated intent. */
export function businessDomainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  // Last "@": the local part may legally contain one inside a quoted string, and
  // the domain is always what follows the final separator.
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  const domain = extractDomain(trimmed.slice(at + 1));
  if (!domain || !HOSTNAME_WITH_LETTER_TLD.test(domain)) return null;
  if (isFreeEmailDomain(domain)) return null;
  return domain;
}

/** If the input URL carries a path beyond the root ("/"), return the full
 *  normalized URL (protocol + host + path + query). Used to pre-select a
 *  sub-page (e.g. "acme.com/pricing") as the outreach click destination.
 *  A bare domain or root path ("/") returns "" (→ homepage default). */
export function subpageDestinationFromUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const hasSubpage = (url.pathname && url.pathname !== "/") || Boolean(url.search);
    return hasSubpage ? url.toString() : "";
  } catch {
    return "";
  }
}
