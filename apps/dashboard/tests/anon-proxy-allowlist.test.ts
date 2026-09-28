import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { anonBodyRefusal, anonCallAllowed } from "../src/lib/anon-proxy-allowlist";

/**
 * Real unit tests: `anon-proxy-allowlist.ts` is alias-free. Keep it that way.
 *
 * This is the boundary in front of a signed-out WRITE surface, so the tests
 * that matter are the ones asserting what is REFUSED. A test suite that only
 * proves the happy path passes against an allowlist that permits everything.
 */

const BRAND = "0f7c1a2e-0000-4000-8000-000000000003";
const OTHER = "0f7c1a2e-0000-4000-8000-00000000dead";

const allow = (method: string, endpoint: string, brandId = BRAND) =>
  anonCallAllowed({ method, endpoint, brandId });

describe("what the signed-out wizard may call", () => {
  it("permits the brand, audience and projection calls it makes", () => {
    const calls: [string, string][] = [
      ["POST", "/brands"],
      ["GET", `/brands/${BRAND}`],
      ["POST", "/brands/extract-fields"],
      ["GET", `/brands/${BRAND}/user-fields`],
      ["PUT", `/brands/${BRAND}/user-fields`],
      ["GET", `/brands/${BRAND}/offers`],
      ["GET", `/brands/${BRAND}/sales-economics-effective`],
      ["PUT", `/brands/${BRAND}/click-destination`],
      ["PUT", `/brands/${BRAND}/business-context`],
      ["POST", `/brands/${BRAND}/icp/suggest`],
      ["GET", "/orgs/audiences?brandId=x&status=active"],
      ["POST", "/orgs/audiences/suggest"],
      ["GET", "/features/sales-cold-email-outreach"],
      ["GET", "/features/sales-cold-email-outreach/workflow-projection?brandId=x"],
    ];
    for (const [method, endpoint] of calls) {
      expect(allow(method, endpoint), `${method} ${endpoint}`).toEqual({
        allowed: true,
        refusal: null,
      });
    }
  });

  it("is case-insensitive on the method but not on the path", () => {
    expect(allow("get", `/brands/${BRAND}`).allowed).toBe(true);
    expect(allow("GET", `/BRANDS/${BRAND}`).allowed).toBe(false);
  });
});

describe("what it may NOT call", () => {
  it("refuses every send path — the no-outreach promise is structural", () => {
    for (const endpoint of [
      "/orgs/campaigns",
      "/campaigns",
      "/orgs/leads",
      "/leads",
      "/emails",
      "/orgs/instantly/accounts",
      "/orgs/audiences/abc/serve-next",
    ]) {
      expect(allow("POST", endpoint).allowed, endpoint).toBe(false);
      expect(allow("GET", endpoint).allowed, endpoint).toBe(false);
    }
  });

  it("refuses every money path", () => {
    for (const endpoint of [
      "/billing/accounts",
      "/credits/grant",
      "/billing/checkout-sessions",
      "/billing/credits/grants",
      "/portal-sessions",
    ]) {
      expect(allow("POST", endpoint).allowed, endpoint).toBe(false);
      expect(allow("GET", endpoint).allowed, endpoint).toBe(false);
    }
  });

  it("refuses the retired sales-funnel routes: the flow states no funnel", () => {
    expect(allow("GET", `/brands/${BRAND}/sales-funnels`).allowed).toBe(false);
    expect(allow("PUT", `/brands/${BRAND}/sales-funnels`).allowed).toBe(false);
  });

  it("refuses a method the rule does not carry", () => {
    // Reading a brand is fine; deleting one is not a call this flow makes.
    expect(allow("GET", `/brands/${BRAND}`).allowed).toBe(true);
    expect(allow("DELETE", `/brands/${BRAND}`).allowed).toBe(false);
    expect(allow("PATCH", `/brands/${BRAND}`).allowed).toBe(false);
  });

  it("refuses ANOTHER brand — extracted fields are keyed on the brand with no org column", () => {
    expect(allow("GET", `/brands/${OTHER}`)).toEqual({
      allowed: false,
      refusal: "wrong-brand",
    });
    expect(allow("GET", `/brands/${OTHER}/user-fields`).refusal).toBe("wrong-brand");
    expect(allow("PUT", `/brands/${OTHER}/business-context`).refusal).toBe("wrong-brand");
    expect(allow("POST", `/brands/${OTHER}/icp/suggest`).refusal).toBe("wrong-brand");
  });

  it("refuses a traversal or an absolute URL rather than matching a rule by luck", () => {
    for (const endpoint of [
      "/brands/../billing/accounts",
      `/brands/${BRAND}/../../credits/grant`,
      "https://evil.test/brands",
      "brands",
      "",
    ]) {
      expect(allow("GET", endpoint).allowed, endpoint).toBe(false);
    }
  });

  it("refuses every brand-scoped route when the session owns no brand yet", () => {
    expect(allow("GET", `/brands/${BRAND}`, "")).toEqual({
      allowed: false,
      refusal: "wrong-brand",
    });
    expect(allow("PUT", `/brands/${BRAND}/user-fields`, "").allowed).toBe(false);
  });

  it("but STILL lets it create one — its first act names no brand", () => {
    // Refusing the whole allowlist on an empty id would mean a session could
    // never create the brand that fills it.
    expect(allow("POST", "/brands", "").allowed).toBe(true);
    expect(allow("POST", "/brands/extract-fields", "").allowed).toBe(true);
    expect(allow("GET", "/features/sales-cold-email-outreach", "").allowed).toBe(true);
  });

  it("does not let a longer path ride a shorter rule", () => {
    expect(allow("GET", `/brands/${BRAND}/user-fields/secret`).allowed).toBe(false);
    expect(allow("POST", "/brands/extract-fields/all").allowed).toBe(false);
  });
});

describe("the file itself", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/lib/anon-proxy-allowlist.ts"),
    "utf8",
  );

  it("names no sending or charging route, so adding one is a visible diff", () => {
    // Read the RULES block alone: the doc comment above it legitimately
    // explains which families are absent, and a whole-file check would fail on
    // its own rationale.
    // `content/preview-email` is the one reviewed exception: it WRITES a preview for
    // the signed-out onboarding v2 and creates nothing that can be sent.
    const rules = src
      .slice(src.indexOf("const RULES"), src.indexOf("export interface AllowInput"))
      .replace('"preview-email"', "")
      // The reviewed email CHECKS of the sampled people: they reveal and verify an address
      // on this anonymous org and return only its masked domain. Nothing is sent.
      .replaceAll('"email-checks"', "");
    for (const banned of ["campaign", "lead", "instantly", "billing", "credit", "stripe", "email"]) {
      expect(rules.toLowerCase(), banned).not.toContain(banned);
    }
  });

  it("stays alias-free so these are real unit tests", () => {
    expect(src).not.toMatch(/from\s+"@\//);
  });
});

describe("the brand a BODY names is bound to the session too", () => {
  const body = (o: unknown) => JSON.stringify(o);
  const refuse = (endpoint: string, b: string | undefined, brandId = BRAND) =>
    anonBodyRefusal({ method: "POST", endpoint, body: b, brandId });

  it("lets the session read its own brand's fields and audiences", () => {
    expect(refuse("/brands/extract-fields", body({ brandIds: [BRAND], fields: [] }))).toBeNull();
    expect(refuse("/orgs/audiences/suggest", body({ brandId: BRAND, nlPrompt: "x" }))).toBeNull();
  });

  it("refuses a body naming another brand, or mixing one in", () => {
    expect(refuse("/brands/extract-fields", body({ brandIds: [OTHER] }))).toBe("wrong-brand");
    expect(refuse("/brands/extract-fields", body({ brandIds: [BRAND, OTHER] }))).toBe("wrong-brand");
    expect(refuse("/orgs/audiences/suggest", body({ brandId: OTHER }))).toBe("wrong-brand");
  });

  it("refuses an empty, missing or unreadable body on a bound route", () => {
    expect(refuse("/brands/extract-fields", body({ brandIds: [] }))).toBe("not-allowlisted");
    expect(refuse("/brands/extract-fields", undefined)).toBe("not-allowlisted");
    expect(refuse("/brands/extract-fields", "{not json")).toBe("not-allowlisted");
  });

  it("refuses everything bound while the session owns no brand", () => {
    expect(refuse("/brands/extract-fields", body({ brandIds: [BRAND] }), "")).toBe("wrong-brand");
  });

  it("leaves routes that name no brand in their body alone", () => {
    expect(anonBodyRefusal({ method: "POST", endpoint: "/brands", body: body({ url: "x" }), brandId: "" })).toBeNull();
    expect(anonBodyRefusal({ method: "GET", endpoint: "/orgs/audiences?brandId=x", body: undefined, brandId: BRAND })).toBeNull();
  });
});

describe("the onboarding v2 preview reads", () => {
  it("permits the audience sample and the preview email", () => {
    expect(allow("GET", "/orgs/audiences/9b1c/preview").allowed).toBe(true);
    expect(allow("POST", "/content/preview-email").allowed).toBe(true);
    expect(allow("GET", "/orgs/audiences/9b1c/preview/email-checks").allowed).toBe(true);
    expect(allow("POST", "/orgs/audiences/9b1c/preview/email-checks/next").allowed).toBe(true);
    // Only those two shapes: no other verb, no deeper path.
    expect(allow("POST", "/orgs/audiences/9b1c/preview/email-checks").allowed).toBe(false);
    expect(allow("GET", "/orgs/audiences/9b1c/preview/email-checks/next").allowed).toBe(false);
    expect(allow("POST", "/orgs/audiences/9b1c/preview/email-checks/next/x").allowed).toBe(false);
    // No body, so nothing for the body binding to refuse.
    expect(anonBodyRefusal({ method: "POST", endpoint: "/orgs/audiences/9b1c/preview/email-checks/next", body: undefined, brandId: BRAND })).toBeNull();
  });

  it("binds the preview email's brand to the session", () => {
    const b = (brandId: string) => JSON.stringify({ brandId, recipient: { firstName: "A" } });
    expect(anonBodyRefusal({ method: "POST", endpoint: "/content/preview-email", body: b(BRAND), brandId: BRAND })).toBeNull();
    expect(anonBodyRefusal({ method: "POST", endpoint: "/content/preview-email", body: b(OTHER), brandId: BRAND })).toBe("wrong-brand");
  });

  it("still refuses everything else under those paths", () => {
    expect(allow("POST", "/orgs/audiences/9b1c/preview").allowed).toBe(false);
    expect(allow("POST", "/orgs/audiences/9b1c/status").allowed).toBe(false);
    expect(allow("POST", "/content/generate").allowed).toBe(false);
  });
});
