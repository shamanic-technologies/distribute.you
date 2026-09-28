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

/**
 * Everyone invited is an Admin: there is one role on a team today (owner-decided
 * 2026-09-28, "vire le concept de member pour now"). Stated once, here, so the day a
 * second role comes back it is added in one place.
 */
export const INVITE_ROLE = "org:admin";

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
/** One of our dashboard origins, else prod: a link we mint never points at somebody else's site. */
export function dashboardOrigin(origin: string | null | undefined): string {
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : DASHBOARD_ORIGIN;
}

export function inviteRedirectUrl(
  origin: string | null | undefined,
  orgId: string,
  brand?: InviteBrand | null,
): string {
  const base = dashboardOrigin(origin);
  const q = brandQuery(brand);
  return `${base}/invite?org=${encodeURIComponent(orgId)}${q ? `&${q}` : ""}`;
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
  /**
   * Set for a black-and-white brand: its dominant colour (`#000000`). The page then
   * wears black and white instead of our blue, and the logo sits on this colour.
   */
  mono?: string | null;
}

const HEX_SHAPE = /^#[0-9a-f]{6}$/;
function cleanHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = (raw.startsWith("#") ? raw : `#${raw}`).toLowerCase();
  return HEX_SHAPE.test(h) ? h : null;
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
    mono: cleanHex(b.mono),
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
    mono: cleanHex(params.get("bm")),
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

// ── Invite LINK: one shareable link per org, no email, anyone holding it joins as Admin ──
//
// Owner-decided 2026-09-28: simple on purpose. No expiry, no single use; the guard is
// that every existing admin is emailed when somebody joins, and the link can be revoked
// (which invalidates it at once, since the code is compared on every join).
//
// The token is `<orgId>.<code>`: the org id tells the join route which org's stored code
// to compare against, the code is the secret. Stored on the Clerk org's
// privateMetadata, which the browser cannot read.

/** Read on the way back from sign-up / sign-in so the join survives any auth route. */
export const JOIN_COOKIE = "distribute_join";
const JOIN_COOKIE_MAX_AGE_S = 24 * 60 * 60;

const ORG_ID_SHAPE = /^org_[A-Za-z0-9]+$/;
const CODE_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

export function joinToken(orgId: string, code: string): string {
  return `${orgId}.${code}`;
}

export function parseJoinToken(raw: string | null | undefined): { orgId: string; code: string } | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const orgId = raw.slice(0, dot);
  const code = raw.slice(dot + 1);
  return ORG_ID_SHAPE.test(orgId) && CODE_SHAPE.test(code) ? { orgId, code } : null;
}

/** The link an admin copies. The brand rides along so the page can greet with it, like an email invite. */
export function joinLinkUrl(origin: string, orgId: string, code: string, brand?: InviteBrand | null): string {
  const q = brandQuery(brand);
  return `${origin}/join/${encodeURIComponent(joinToken(orgId, code))}${q ? `?${q}` : ""}`;
}

export function brandQuery(brand?: InviteBrand | null): string {
  if (!brand) return "";
  const q = new URLSearchParams({ bn: brand.name });
  if (brand.domain) q.set("bd", brand.domain);
  if (brand.logoUrl) q.set("bl", brand.logoUrl);
  if (brand.tint) {
    q.set("th", String(brand.tint.hue));
    q.set("tc", String(brand.tint.chromaScale));
    q.set("td", String(brand.tint.hueDelta));
  }
  if (brand.mono) q.set("bm", brand.mono.replace(/^#/, ""));
  return q.toString();
}

export function joinCookieAssignment(token: string): string {
  return `${JOIN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${JOIN_COOKIE_MAX_AGE_S}; samesite=lax`;
}

export function clearJoinCookieAssignment(): string {
  return `${JOIN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function readJoinCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === JOIN_COOKIE) {
      const token = decodeURIComponent(v.join("="));
      return parseJoinToken(token) ? token : null;
    }
  }
  return null;
}
