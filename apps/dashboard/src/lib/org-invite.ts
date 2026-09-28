/**
 * Inviting a teammate into an organization.
 *
 * Clerk owns the invitation (it stores it, mails it, and turns the link into a
 * membership), so this module only states our side of it: which roles a person may
 * be invited as, what an address has to look like before we ask Clerk, where the
 * link in the email lands, and where the new member goes once they are in.
 *
 * Alias-free on purpose so every rule here carries real unit tests.
 */

export const INVITE_ROLES = ["org:admin", "org:member"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const INVITE_ROLE_LABEL: Record<InviteRole, string> = {
  "org:admin": "Admin",
  "org:member": "Member",
};

export function isInviteRole(value: unknown): value is InviteRole {
  return typeof value === "string" && (INVITE_ROLES as readonly string[]).includes(value);
}

// Shape only: whether the address can receive mail is Clerk's answer.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isInvitableEmail(raw: string): boolean {
  return EMAIL_SHAPE.test(normalizeInviteEmail(raw));
}

/** The origin a link in the invitation email may point at. Anything else falls back to prod. */
export const DASHBOARD_ORIGIN = "https://dashboard.distribute.you";
const ALLOWED_ORIGINS = new Set([
  DASHBOARD_ORIGIN,
  "https://app.distribute.you",
  "http://localhost:3001",
]);

/**
 * Where the link in Clerk's email lands. Clerk appends `__clerk_ticket` and
 * `__clerk_status` to it; `/invite` reads both. The org id rides along so the new
 * member is made active in THAT org, rather than whichever org Clerk picks first.
 * A caller-supplied origin is only honoured when it is one of ours, so an invite can
 * never be pointed at somebody else's site.
 */
export function inviteRedirectUrl(
  origin: string | null | undefined,
  orgId: string,
  brand?: InviteBrand | null,
): string {
  const base = origin && ALLOWED_ORIGINS.has(origin) ? origin : DASHBOARD_ORIGIN;
  const q = new URLSearchParams({ org: orgId });
  if (brand) {
    q.set("bn", brand.name);
    if (brand.domain) q.set("bd", brand.domain);
    if (brand.logoUrl) q.set("bl", brand.logoUrl);
    if (brand.tint) {
      q.set("th", String(brand.tint.hue));
      q.set("tc", String(brand.tint.chromaScale));
      q.set("td", String(brand.tint.hueDelta));
    }
  }
  return `${base}/invite?${q.toString()}`;
}

/**
 * The brand the invitation is about, carried in the link so the invite page can
 * greet the invitee with it before they have an account (nothing about the org is
 * readable signed out). Display only: every field is validated on the way in AND on
 * the way out, rendered as text or as an https image, and a bad field is dropped
 * rather than shown.
 */
export interface InviteBrand {
  name: string;
  domain: string | null;
  logoUrl: string | null;
  /** The brand's resolved accent, the three numbers `BrandTint` writes on <html>. */
  tint: { hue: number; chromaScale: number; hueDelta: number } | null;
}

const DOMAIN_SHAPE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const MAX_NAME = 80;
const MAX_LOGO_URL = 400;

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name && name.length <= MAX_NAME ? name : null;
}

function cleanDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.trim().toLowerCase();
  return d.length <= 253 && DOMAIN_SHAPE.test(d) ? d : null;
}

function cleanLogoUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > MAX_LOGO_URL) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

function cleanTint(hue: unknown, chromaScale: unknown, hueDelta: unknown): InviteBrand["tint"] {
  const h = Number(hue);
  const c = Number(chromaScale);
  const d = Number(hueDelta);
  if (typeof hue === "string" && hue.trim() === "") return null;
  if (![h, c, d].every(Number.isFinite)) return null;
  if (h < 0 || h > 360 || c <= 0 || c > 4 || Math.abs(d) > 360) return null;
  return { hue: h, chromaScale: c, hueDelta: d };
}

/** A brand as the inviter's page describes it, or null when it has no usable name. */
export function sanitizeInviteBrand(raw: unknown): InviteBrand | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const name = cleanName(b.name);
  if (!name) return null;
  const tint = b.tint && typeof b.tint === "object" ? (b.tint as Record<string, unknown>) : null;
  return {
    name,
    domain: cleanDomain(b.domain),
    logoUrl: cleanLogoUrl(b.logoUrl),
    tint: tint ? cleanTint(tint.hue, tint.chromaScale, tint.hueDelta) : null,
  };
}

/** The brand back out of the invite link's query string. */
export function parseInviteBrand(params: { get(name: string): string | null }): InviteBrand | null {
  const name = cleanName(params.get("bn"));
  if (!name) return null;
  return {
    name,
    domain: cleanDomain(params.get("bd")),
    logoUrl: cleanLogoUrl(params.get("bl")),
    tint: params.get("th") === null ? null : cleanTint(params.get("th"), params.get("tc"), params.get("td")),
  };
}

/** Where a member lands once the invitation is accepted: the org itself, which resolves its last brand. */
export function inviteLandingHref(orgId: string | null): string {
  return orgId ? `/orgs/${encodeURIComponent(orgId)}` : "/orgs";
}

export type InviteTicketStatus = "sign_up" | "sign_in" | "complete";

/** Clerk's `__clerk_status`, read as one of the three values it documents, or null. */
export function parseInviteStatus(raw: string | null): InviteTicketStatus | null {
  return raw === "sign_up" || raw === "sign_in" || raw === "complete" ? raw : null;
}
