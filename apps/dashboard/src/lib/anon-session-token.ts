/**
 * The token that IS the anonymous session.
 *
 * The signed-out half of onboarding does real, org-scoped work: it creates a
 * brand, declares funnels, suggests audiences, extracts an offer. Every one of
 * those is an ordinary org-scoped write, because an anonymous session IS an org
 * — one client-service has minted with no Clerk org attached yet. At signup we
 * write the new Clerk org id onto that same row, so nothing moves.
 *
 * Which means the browser is holding, in a cookie, the identity of an org that
 * can spend money. So the cookie carries a SIGNED payload and nothing else: the
 * server reads the org id out of the signature it minted, never off a value the
 * browser could edit. A visitor who rewrites the cookie to another org's uuid
 * produces a token whose HMAC does not verify, and the proxy answers 401.
 *
 * STATELESS BY DESIGN. A session store would be a second place for this to go
 * wrong and a table to garbage-collect; the payload is three ids and a
 * timestamp, so it fits in the signature. The one thing statelessness costs is
 * revocation, which the expiry covers: a session is worth at most its credit
 * line, and that line is billing's, not ours.
 *
 * Alias-free so it carries real unit tests, and the SECRET IS AN ARGUMENT rather
 * than an env read for the same reason — a module that reads `process.env` at
 * import time cannot be tested and cannot be reasoned about. Do not add an
 * `@/…` import, and do not reach for `process.env` here.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a signed-out session may keep working. Long enough to leave the
 *  flow and come back after lunch, short enough that a leaked cookie is not a
 *  standing credential. */
export const ANON_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

/** The payload the signature covers. Three ids and when it was minted. */
export interface AnonSession {
  /**
   * The org this session spends as, named by its EXTERNAL id.
   *
   * Deliberately the external id and not the internal uuid: the gateway already
   * resolves an external org id through client-service on every admin-key call,
   * upserting the row on first sight. So the session needs no create step, and
   * the browser never holds an internal uuid — the one identifier every other
   * org in the fleet is addressed by.
   *
   * Always `anon_<uuid>`, which is what makes an anonymous org recognisable in
   * the ledger afterwards and what the claim re-points to the real Clerk org.
   */
  anonOrgId: string;
  /** The brand this session is building. One session, one brand. */
  brandId: string;
  /** The domain the visitor typed, carried so a screen can state it without a read. */
  domain: string;
  /** Seconds since epoch. Read back to expire the token. */
  issuedAt: number;
}

const FIELD_ORDER = ["anonOrgId", "brandId", "domain", "issuedAt"] as const;

/** The prefix every anonymous org's external id carries. */
export const ANON_ORG_PREFIX = "anon_";

/**
 * The ONE principal every anonymous session acts as.
 *
 * Keyed on the JOB and not on the session, in the `system-` namespace
 * client-service already excludes from its public user count. A per-session id
 * would mint a `users` row per visitor and inflate the figure the investors
 * page prints — the exact bug `service-identity.ts` records, at signup volume.
 */
export const ANON_PRINCIPAL = "system-anonymous-onboarding";

/** True when an external org id belongs to a session that has not signed up. */
export function isAnonOrgId(externalOrgId: string): boolean {
  return externalOrgId.startsWith(ANON_ORG_PREFIX);
}

/**
 * The key the signature is taken with.
 *
 * DERIVED from a secret the dashboard server already holds rather than read
 * from an env var of its own: an invented variable name looks right in review
 * and is unset on the box, which would make every anonymous session fail to
 * verify in production while passing every test. The label pins this use to
 * this purpose, so the derived key is not the admin key and cannot be replayed
 * as one.
 */
export function anonSigningKey(serverSecret: string): Buffer {
  return createHmac("sha256", serverSecret).update("anon-session-v1").digest();
}

/** The canonical string the HMAC is taken over. Field ORDER is part of the
 *  contract: a reordering would verify a payload it never signed. */
function canonical(session: AnonSession): string {
  return FIELD_ORDER.map((k) => `${k}=${String(session[k])}`).join("\n");
}

function sign(session: AnonSession, key: Buffer): string {
  return createHmac("sha256", key).update(canonical(session)).digest("base64url");
}

/** Mint a token for a session. The returned string is the whole cookie value. */
export function signAnonSession(session: AnonSession, serverSecret: string): string {
  const key = anonSigningKey(serverSecret);
  const body = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${body}.${sign(session, key)}`;
}

/** Why a token was refused. Rendered nowhere — it is a log line, and the caller
 *  answers 401 either way. Distinguishing them is what makes a real incident
 *  legible against the ordinary expiry. */
export type AnonTokenRefusal = "malformed" | "bad-signature" | "expired";

export interface AnonTokenRead {
  session: AnonSession | null;
  refusal: AnonTokenRefusal | null;
}

/**
 * Read a token back.
 *
 * Returns the session ONLY when the signature verifies and the token is inside
 * its window. Every other outcome is `session: null` plus the reason — there is
 * no partial read, and a caller cannot accidentally use an unverified payload
 * because it is never returned.
 */
export function readAnonSession(
  token: string | null | undefined,
  serverSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): AnonTokenRead {
  if (typeof token !== "string" || token.length === 0) {
    return { session: null, refusal: "malformed" };
  }
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) {
    return { session: null, refusal: "malformed" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token.slice(0, dot), "base64url").toString("utf8"));
  } catch {
    return { session: null, refusal: "malformed" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { session: null, refusal: "malformed" };
  }

  const candidate = parsed as Record<string, unknown>;
  for (const k of FIELD_ORDER) {
    const v = candidate[k];
    if (k === "issuedAt") {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return { session: null, refusal: "malformed" };
      }
    } else if (typeof v !== "string" || v.length === 0) {
      return { session: null, refusal: "malformed" };
    }
  }
  const session = candidate as unknown as AnonSession;

  // Constant-time, and length-checked first: `timingSafeEqual` THROWS on a
  // length mismatch, which a forged token can trivially produce.
  const expected = Buffer.from(sign(session, anonSigningKey(serverSecret)), "utf8");
  const given = Buffer.from(token.slice(dot + 1), "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { session: null, refusal: "bad-signature" };
  }

  if (nowSeconds - session.issuedAt > ANON_SESSION_MAX_AGE_SECONDS) {
    return { session: null, refusal: "expired" };
  }

  return { session, refusal: null };
}
