import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { anonSessionStart, canReuseAnonSession } from "../src/lib/anon-session-start";
import { anonCallAllowed } from "../src/lib/anon-proxy-allowlist";

/**
 * "I have no website" is reachable before anyone has an account, and until this
 * it dead-ended there.
 *
 * That button renders on the URL step unconditionally, and the URL step is a
 * signed-out step. The path behind it called Clerk's `createOrganization`,
 * which is undefined with no session, so every signed-out visitor who has no
 * website got "Organization setup is not ready yet. Please try again." — a
 * sentence about us, on a retry that could never work.
 *
 * Two more things had to be true for the path to work at all, and neither was:
 * the session route refuses a blank website as the typo it usually is, and the
 * anonymous proxy's allowlist did not carry the one write the no-website path
 * makes (the pasted business context, which IS its extraction source).
 *
 * THE DECLARED FACT IS THE WHOLE DESIGN. A visitor saying they have no website
 * and a visitor leaving the field blank look identical on the wire and mean
 * opposite things, so the no-website case is carried as its own flag — never
 * inferred from an empty string. Same discipline as anonymity itself, which
 * client-service records at creation rather than reading off the shape of an id.
 */
const src = fs.readFileSync(
  path.join(__dirname, "..", "src/components/onboarding/onboarding.tsx"),
  "utf-8",
);
const route = fs.readFileSync(
  path.join(__dirname, "..", "src/app/api/anon/session/route.ts"),
  "utf-8",
);

describe("the decision lets a no-website visitor build", () => {
  it("starts with nothing to claim", () => {
    // `claim` is about a domain and there is none, so the two refusals that
    // protect another org's brand cannot apply.
    for (const claim of ["unclaimed", "claimed", "unknown"] as const) {
      const d = anonSessionStart({ website: "", claim, noWebsite: true });
      expect(d.start).toBe(true);
      if (d.start) expect(d.website).toBe("");
    }
  });

  it("still refuses a BLANK field, which is the typo it looks like", () => {
    // The whole reason the fact is DECLARED rather than inferred from an empty
    // string. The website rule itself treats empty as "not my business" (the
    // caller owns what empty means), so a blank field reaches the route with no
    // domain and is refused as unverifiable — which is correct, and is exactly
    // what a no-website visitor must NOT get.
    const d = anonSessionStart({ website: "", claim: "unknown" });
    expect(d.start).toBe(false);
    if (!d.start) expect(d.refusal.reason).toBe("cannot-verify");
  });

  it("still refuses a claimed domain when a website WAS given", () => {
    const d = anonSessionStart({ website: "https://acme.com", claim: "claimed" });
    expect(d.start).toBe(false);
    if (!d.start) expect(d.refusal.reason).toBe("claimed");
  });
});

describe("a second click does not mint a second org", () => {
  it("reuses a held no-website session", () => {
    expect(canReuseAnonSession({ domain: "" }, null, true)).toBe(true);
  });

  it("does not reuse a website session for a no-website walk", () => {
    expect(canReuseAnonSession({ domain: "acme.com" }, null, true)).toBe(false);
  });

  it("leaves the website reuse rule exactly as it was", () => {
    expect(canReuseAnonSession({ domain: "acme.com" }, "acme.com")).toBe(true);
    expect(canReuseAnonSession({ domain: "acme.com" }, "other.com")).toBe(false);
    expect(canReuseAnonSession({ domain: "" }, "acme.com")).toBe(false);
    expect(canReuseAnonSession(null, "acme.com")).toBe(false);
  });
});

describe("the one write the no-website path makes is reachable", () => {
  it("allows the business context, which is its only extraction source", () => {
    const brand = "11111111-2222-3333-4444-555555555555";
    expect(
      anonCallAllowed({
        method: "PUT",
        endpoint: `/brands/${brand}/business-context`,
        brandId: brand,
      }).allowed,
    ).toBe(true);
  });

  it("still binds it to THIS session's brand", () => {
    const r = anonCallAllowed({
      method: "PUT",
      endpoint: "/brands/99999999-9999-9999-9999-999999999999/business-context",
      brandId: "11111111-2222-3333-4444-555555555555",
    });
    expect(r.allowed).toBe(false);
    expect(r.refusal).toBe("wrong-brand");
  });
});

describe("the services step names a source it actually read", () => {
  it("does not interpolate an empty host into the sentence", () => {
    // `hostname` is empty on the no-website path, so the unguarded form printed
    // "We drafted these from ." — a bare full stop where the source belongs, on
    // the one step whose whole job is to say where the list came from. Observed
    // on a prod walk.
    expect(src).toContain("We drafted these from what you told us.");
    const at = src.indexOf("{servicesDrafted ? (");
    const block = src.slice(at, src.indexOf("Tell us what you sell", at));
    expect(block).toContain("hostname ? (");
  });
});

describe("the call sites", () => {
  it("the no-website path starts an anonymous session when signed out", () => {
    // A resolver nothing calls is the fix entirely absent with the module
    // perfectly correct.
    expect(src).toContain('startAnonSession("", { noWebsite: true })');
  });

  it("it no longer reaches Clerk while signed out", () => {
    // The Clerk branch must sit BEHIND the signed-out one, not before it — an
    // index compare, because a `toContain` cannot see ordering and the ordering
    // is the whole defect.
    const fn = src.slice(src.indexOf("async function createBrandNoWebsiteAndFetchServices("));
    const body = fn.slice(0, fn.indexOf("\n  async function", 1));
    const anon = body.indexOf("startAnonSession");
    const clerk = body.indexOf("createOrganization({ name })");
    expect(anon).toBeGreaterThan(-1);
    expect(clerk).toBeGreaterThan(-1);
    expect(anon).toBeLessThan(clerk);
  });

  it("does not write the resume cookie with no org to scope it to", () => {
    const fn = src.slice(src.indexOf("async function createBrandNoWebsiteAndFetchServices("));
    const body = fn.slice(0, fn.indexOf("\n  async function", 1));
    expect(body).toContain("if (targetOrgId) {");
  });

  it("the route reads the declared flag and never infers it", () => {
    expect(route).toContain("body.noWebsite === true");
    expect(route).toContain("noWebsite ? null : extractDomain(website)");
    expect(route).toContain("noWebsite ? null : websiteInputProblem(website)");
    expect(route).toContain("canReuseAnonSession(held, domain, noWebsite)");
  });
});
