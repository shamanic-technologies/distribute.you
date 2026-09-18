import { describe, expect, it } from "vitest";

import {
  ANON_ORG_PREFIX,
  ANON_PRINCIPAL,
  ANON_SESSION_MAX_AGE_SECONDS,
  isAnonOrgId,
  readAnonSession,
  signAnonSession,
  type AnonSession,
} from "../src/lib/anon-session-token";
import {
  ANON_SESSION_COOKIE,
  anonSessionCookie,
  anonTokenFromCookieHeader,
  clearAnonSessionCookie,
} from "../src/lib/anon-session-cookie";

/**
 * Real unit tests: both modules are deliberately alias-free and read no
 * `process.env`, so they import here. Keep them that way.
 */

const SECRET = "test-server-secret-not-the-real-one";
const NOW = 1_700_000_000;

const session: AnonSession = {
  anonOrgId: "anon_0f7c1a2e-0000-4000-8000-000000000001",
  orgId: "0f7c1a2e-0000-4000-8000-000000000009",
  brandId: "0f7c1a2e-0000-4000-8000-000000000003",
  domain: "acme.com",
  issuedAt: NOW,
};

describe("signAnonSession / readAnonSession", () => {
  it("round-trips a session it signed", () => {
    const token = signAnonSession(session, SECRET);
    const read = readAnonSession(token, SECRET, NOW);
    expect(read.refusal).toBeNull();
    expect(read.session).toEqual(session);
  });

  it("refuses a payload edited in the browser — the whole point of the signature", () => {
    const token = signAnonSession(session, SECRET);
    const [body, sig] = token.split(".");
    const stolen = { ...session, anonOrgId: "org_a_paying_customer" };
    const forged = `${Buffer.from(JSON.stringify(stolen), "utf8").toString("base64url")}.${sig}`;
    expect(forged).not.toBe(token);
    expect(body).toBeTruthy();

    const read = readAnonSession(forged, SECRET, NOW);
    expect(read.session).toBeNull();
    expect(read.refusal).toBe("bad-signature");
  });

  it("refuses a token signed with another secret", () => {
    const token = signAnonSession(session, "some-other-secret");
    expect(readAnonSession(token, SECRET, NOW).refusal).toBe("bad-signature");
  });

  it("does not throw on a signature of the wrong LENGTH — timingSafeEqual would", () => {
    const token = `${signAnonSession(session, SECRET).split(".")[0]}.short`;
    expect(() => readAnonSession(token, SECRET, NOW)).not.toThrow();
    expect(readAnonSession(token, SECRET, NOW).refusal).toBe("bad-signature");
  });

  it("expires exactly at the window, not before", () => {
    const token = signAnonSession(session, SECRET);
    const atEdge = NOW + ANON_SESSION_MAX_AGE_SECONDS;
    expect(readAnonSession(token, SECRET, atEdge).refusal).toBeNull();
    expect(readAnonSession(token, SECRET, atEdge + 1).refusal).toBe("expired");
  });

  it("reports malformed input as malformed and never as a session", () => {
    for (const bad of ["", "nodot", ".", "a.", null, undefined, "!!!.!!!"]) {
      const read = readAnonSession(bad as string, SECRET, NOW);
      expect(read.session).toBeNull();
      expect(read.refusal).not.toBeNull();
    }
  });

  it("ROUND-TRIPS a session that owns no brand yet — its first act creates one", () => {
    // Production bug: the validator required every string field to be non-empty,
    // so the app's own freshly-signed token (brandId "") read back as malformed
    // and the proxy 401'd one request after the session route returned 200.
    const fresh = { ...session, brandId: "", domain: "" };
    const read = readAnonSession(signAnonSession(fresh, SECRET), SECRET, NOW);
    expect(read.refusal).toBeNull();
    expect(read.session).toEqual(fresh);
  });

  it("still refuses a token naming no ORG — that is what it spends as", () => {
    for (const k of ["anonOrgId", "orgId"] as const) {
      const bad = { ...session, [k]: "" };
      expect(readAnonSession(signAnonSession(bad, SECRET), SECRET, NOW).refusal).toBe("malformed");
    }
  });

  it("refuses a payload missing a field rather than reading it half-way", () => {
    const partial = { anonOrgId: session.anonOrgId, issuedAt: NOW };
    const body = Buffer.from(JSON.stringify(partial), "utf8").toString("base64url");
    expect(readAnonSession(`${body}.whatever`, SECRET, NOW).refusal).toBe("malformed");
  });
});

describe("the anonymous org's identity", () => {
  it("carries the internal uuid the claim addresses, inside the signature", () => {
    const read = readAnonSession(signAnonSession(session, SECRET), SECRET, NOW);
    expect(read.session?.orgId).toBe(session.orgId);
    // Editing it is the same forgery as editing the org: it does not verify.
    const body = Buffer.from(
      JSON.stringify({ ...session, orgId: "0f7c1a2e-0000-4000-8000-00000000beef" }),
      "utf8",
    ).toString("base64url");
    const sig = signAnonSession(session, SECRET).split(".")[1];
    expect(readAnonSession(`${body}.${sig}`, SECRET, NOW).refusal).toBe("bad-signature");
  });

  it("is recognisable by its prefix, which is a LABEL and never the proof", () => {
    expect(isAnonOrgId(session.anonOrgId)).toBe(true);
    expect(isAnonOrgId("org_2abcDEF")).toBe(false);
    expect(session.anonOrgId.startsWith(ANON_ORG_PREFIX)).toBe(true);
  });

  it("acts as ONE system principal, never a row per visitor", () => {
    // `service-identity.ts` records what a per-caller external user id costs:
    // one `users` row each, and a public user count that reads them as people.
    expect(ANON_PRINCIPAL.startsWith("system-")).toBe(true);
  });
});

describe("the cookie", () => {
  it("is httpOnly — a credential the browser must not read", () => {
    const set = anonSessionCookie("tok", { secure: true });
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Secure");
    expect(set).toContain("SameSite=Lax");
    expect(set).toContain(`${ANON_SESSION_COOKIE}=tok`);
  });

  it("drops Secure off https so localhost can set it at all", () => {
    expect(anonSessionCookie("tok", { secure: false })).not.toContain("Secure");
  });

  it("clears with max-age=0 and stays httpOnly", () => {
    const cleared = clearAnonSessionCookie({ secure: true });
    expect(cleared).toContain("max-age=0");
    expect(cleared).toContain("HttpOnly");
  });

  it("reads its own value back out of a header carrying other cookies", () => {
    const header = `foo=1; ${ANON_SESSION_COOKIE}=${encodeURIComponent("a.b")}; bar=2`;
    expect(anonTokenFromCookieHeader(header)).toBe("a.b");
    expect(anonTokenFromCookieHeader("foo=1; bar=2")).toBeNull();
    expect(anonTokenFromCookieHeader(null)).toBeNull();
  });
});
