import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CANNOT_VERIFY_MESSAGE,
  CLAIMED_MESSAGE,
  anonSessionStart,
  canReuseAnonSession,
} from "../src/lib/anon-session-start";

/** Real unit tests: the module is alias-free apart from the website rule, which
 *  is itself alias-free. Keep both that way. */

describe("who may build anonymously", () => {
  it("starts for a real website nobody claims — the ordinary new visitor", () => {
    const d = anonSessionStart({ website: "acme.com", claim: "unclaimed" });
    expect(d.start).toBe(true);
    expect(d.website).toBe("acme.com");
    expect(d.refusal).toBeNull();
  });

  it("trims what was typed rather than storing the whitespace", () => {
    const d = anonSessionStart({ website: "  https://acme.com/pricing  ", claim: "unclaimed" });
    expect(d.website).toBe("https://acme.com/pricing");
  });
});

describe("what it refuses, and why each refusal is cheap", () => {
  it("refuses a typo with the website field's OWN sentence, not one of its own", () => {
    const d = anonSessionStart({ website: "kevin@gmail.com", claim: "unclaimed" });
    expect(d.start).toBe(false);
    expect(d.refusal?.reason).toBe("bad-website");
    // The message belongs to the shared website rule. Asserting it is non-empty
    // and NOT one of ours is the point: a second sentence here would be a second
    // vocabulary for one field.
    expect(d.refusal?.message).toBeTruthy();
    expect(d.refusal?.message).not.toBe(CLAIMED_MESSAGE);
    expect(d.refusal?.message).not.toBe(CANNOT_VERIFY_MESSAGE);
  });

  it("refuses a domain a paying org already owns", () => {
    const d = anonSessionStart({ website: "acme.com", claim: "claimed" });
    expect(d.start).toBe(false);
    expect(d.refusal).toEqual({ reason: "claimed", message: CLAIMED_MESSAGE });
  });

  it("FAILS CLOSED when it could not ask — the same outcome as claimed", () => {
    const d = anonSessionStart({ website: "acme.com", claim: "unknown" });
    expect(d.start).toBe(false);
    expect(d.refusal?.reason).toBe("cannot-verify");
  });

  it("checks the website BEFORE the claim, so a typo never depends on a read", () => {
    const d = anonSessionStart({ website: "not a website", claim: "unknown" });
    expect(d.refusal?.reason).toBe("bad-website");
  });

  it("never starts on anything but an explicit unclaimed", () => {
    for (const claim of ["claimed", "unknown", "", "UNCLAIMED", undefined, null]) {
      const d = anonSessionStart({ website: "acme.com", claim: claim as never });
      expect(d.start, String(claim)).toBe(false);
    }
  });
});

describe("what a stranger is told", () => {
  const messages = [CLAIMED_MESSAGE, CANNOT_VERIFY_MESSAGE];

  it("says nothing about the organisation that owns the domain", () => {
    for (const m of messages) {
      for (const leak of ["org", "account exists", "already taken", "owner", "customer"]) {
        expect(m.toLowerCase(), m).not.toContain(leak);
      }
    }
  });

  it("states what happens next rather than stopping the visitor", () => {
    for (const m of messages) expect(m.toLowerCase()).toContain("continue");
  });

  it("carries no em-dash — it is user-facing copy", () => {
    for (const m of messages) expect(m).not.toContain("—");
  });
});

describe("the file itself", () => {
  it("stays alias-free so these are real unit tests", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/anon-session-start.ts"), "utf8");
    expect(src).not.toMatch(/from\s+"@\//);
  });
});

describe("canReuseAnonSession — the same browser walking the same domain twice", () => {
  it("reuses a held session for the same domain", () => {
    expect(canReuseAnonSession({ domain: "acme.com" }, "acme.com")).toBe(true);
  });

  it("does NOT reuse across different domains", () => {
    expect(canReuseAnonSession({ domain: "acme.com" }, "other.com")).toBe(false);
  });

  it("does NOT reuse when no session is held", () => {
    expect(canReuseAnonSession(null, "acme.com")).toBe(false);
    expect(canReuseAnonSession(undefined, "acme.com")).toBe(false);
  });

  it("does NOT reuse when the request names no domain", () => {
    expect(canReuseAnonSession({ domain: "acme.com" }, null)).toBe(false);
  });

  // An empty stored domain is a LEGAL token shape, so it must refuse rather
  // than match another empty — a session that cannot say which website it is
  // for cannot be shown to be this one.
  it("does NOT reuse a session that names no domain", () => {
    expect(canReuseAnonSession({ domain: "" }, "acme.com")).toBe(false);
  });
});

describe("the session route wires reuse ahead of the claim question", () => {
  const route = fs.readFileSync(
    path.join(__dirname, "../src/app/api/anon/session/route.ts"),
    "utf8",
  );

  it("decides reuse before asking whether the domain is claimed", () => {
    const reuse = route.indexOf("canReuseAnonSession(held, domain");
    const claim = route.indexOf("await domainClaim(domain)");
    expect(reuse).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(-1);
    expect(reuse).toBeLessThan(claim);
  });

  // extractDomain is looser than the website rule, so a held session for
  // acme.com would let `kevin@acme.com` through if the rule ran after reuse.
  it("refuses a bad website before it can reuse anything", () => {
    const rule = route.indexOf("websiteInputProblem(website)");
    const reuse = route.indexOf("canReuseAnonSession(held, domain");
    expect(rule).toBeGreaterThan(-1);
    expect(rule).toBeLessThan(reuse);
  });

  it("keeps the held session when the typed website is refused", () => {
    expect(route).toContain('refuse(req, badWebsite, "bad-website", { clearSession: false })');
  });

  // Re-signing would move issuedAt and turn a bounded session into a rolling
  // credential, which its own expiry exists to prevent.
  it("re-sets the SAME token on reuse rather than minting a new one", () => {
    const at = route.indexOf("canReuseAnonSession(held, domain");
    const body = route.slice(at, route.indexOf("// The claim question needs a domain"));
    expect(body).not.toContain("signAnonSession");
    expect(body).not.toContain("createAnonymousOrg");
    expect(body).not.toContain("seedTrialCredit");
  });
});
