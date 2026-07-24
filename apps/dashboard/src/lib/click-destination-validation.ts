// Pure validation for a brand's click-destination URL. No app/api imports so it
// can be unit-tested directly (vitest has no "@" alias). Used by the Brand
// Settings click-destination card; mirrors brand-service's fail-loud rule plus
// the "must be on the brand domain OR a WhatsApp link" constraint.

/** Strip a leading "www." so "www.acme.com" matches the www-stripped brand domain. */
export function bareHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

// Hosts recognised as WhatsApp click links (canonical, www-stripped). A WhatsApp
// link is accepted as a click destination regardless of the brand domain — the
// outreach click can land in a WhatsApp chat. Mirrors brand-service's
// WhatsApp-link normalizer host set.
const WHATSAPP_HOSTS = new Set(["wa.me", "whatsapp.com", "api.whatsapp.com", "chat.whatsapp.com"]);

export type ValidationResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validate a user-supplied destination. Accepts a bare host or a full URL;
 * requires http(s). The host must EITHER be a WhatsApp link (wa.me / whatsapp.com
 * / api.whatsapp.com / chat.whatsapp.com) OR equal the brand domain / be a
 * subdomain of it. Returns the normalized absolute URL on success.
 */
export function validateDestination(input: string, brandDomain: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a page URL on your brand domain, or a WhatsApp link." };
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "Enter a valid page URL (e.g. https://yoursite.com/pricing) or a WhatsApp link." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "The URL must start with http:// or https://." };
  }
  const host = bareHost(parsed.hostname);
  // A WhatsApp link is on no particular domain — accept it directly.
  if (WHATSAPP_HOSTS.has(host)) {
    return { ok: true, url: parsed.toString() };
  }
  const domain = bareHost(brandDomain);
  const onDomain = host === domain || host.endsWith(`.${domain}`);
  if (!onDomain) {
    return { ok: false, error: `The URL must be on your brand domain (${domain}) or a WhatsApp link.` };
  }
  return { ok: true, url: parsed.toString() };
}
