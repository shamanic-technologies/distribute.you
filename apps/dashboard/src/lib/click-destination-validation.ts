// Pure validation for a brand's click-destination URL. No app/api imports so it
// can be unit-tested directly (vitest has no "@" alias). Used by the Brand
// Settings click-destination card; mirrors brand-service's fail-loud rule plus
// the dashboard-only "must be on the brand domain" constraint.

/** Strip a leading "www." so "www.acme.com" matches the www-stripped brand domain. */
export function bareHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

export type ValidationResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validate a user-supplied destination against the brand domain. Accepts a bare
 * host or a full URL; requires http(s); requires the host to equal the brand
 * domain or be a subdomain of it. Returns the normalized absolute URL on success.
 */
export function validateDestination(input: string, brandDomain: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a page URL on your brand domain." };
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "Enter a valid page URL (e.g. https://yoursite.com/pricing)." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "The URL must start with http:// or https://." };
  }
  const domain = bareHost(brandDomain);
  const host = bareHost(parsed.hostname);
  const onDomain = host === domain || host.endsWith(`.${domain}`);
  if (!onDomain) {
    return { ok: false, error: `The URL must be on your brand domain (${domain}).` };
  }
  return { ok: true, url: parsed.toString() };
}
