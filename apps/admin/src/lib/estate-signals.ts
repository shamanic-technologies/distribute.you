/**
 * The billing vendor of a domain (as instantly-service names it on `provider`) and where a staff
 * operator goes to act on it. The rest of this module (renewal events, DNS issues, renewal window)
 * went with the admin cold-email pages (MONITORING-ADMIN-PORT-1019).
 *
 * Deliberately alias-free so it carries REAL unit tests.
 */

export interface VendorConsole {
  /** How the vendor writes its own name. */
  label: string;
  /** The vendor's own domain, for the logo. */
  logoDomain: string;
  /**
   * Where a staff operator goes to act. VERIFIED to resolve on 2026-09-22.
   *
   * These are dashboard ROOTS, not per-domain deep links, and that is measured
   * rather than lazy: Gandi's console is a catch-all SPA (`/zzzznotaroute`
   * answers 301, `/domain/zzz-not-a-domain.tld` answers 302 to its login with
   * the path preserved), so a per-domain URL cannot be told apart from a route
   * that does not exist. A CTA that 404s after a login round-trip is worse than
   * one that lands on the list with the domain named beside it.
   */
  href: string;
}

/**
 * The vendors that bill us for a domain, as instantly-service names them on
 * `provider`. This is the BILLING vendor, a different concept from the
 * connection protocol (`google` / `microsoft` / `imap`) `ProviderLogo` draws.
 *
 * A vendor absent from this map gets NO logo and NO link rather than a guessed
 * one — an unrecognised provider is a producer vocabulary we have not read yet,
 * not a reason to send an operator somewhere.
 */
export const VENDOR_CONSOLES: Record<string, VendorConsole> = {
  gandi: {
    label: "Gandi",
    logoDomain: "gandi.net",
    href: "https://admin.gandi.net/domain",
  },
  primeforge: {
    label: "Primeforge",
    logoDomain: "primeforge.ai",
    href: "https://app.primeforge.ai",
  },
  mailforge: {
    label: "Mailforge",
    logoDomain: "mailforge.ai",
    href: "https://app.mailforge.ai",
  },
  "instantly-dfy": {
    label: "Instantly DFY",
    logoDomain: "instantly.ai",
    href: "https://app.instantly.ai/app/accounts",
  },
};

export function vendorConsole(provider: string | null | undefined): VendorConsole | null {
  if (!provider) return null;
  return VENDOR_CONSOLES[provider] ?? null;
}
