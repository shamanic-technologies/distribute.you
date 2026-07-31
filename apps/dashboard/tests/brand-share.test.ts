import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  BRAND_SHARE_PATH,
  brandFromPathname,
  brandShareUrl,
} from "../src/lib/brand-share";

// `lib/brand-share.ts` carries no `@` import, so it is runtime-importable and
// gets real unit tests rather than source-substring guards. Keep it that way.

describe("brandShareUrl", () => {
  it("composes the public link from an origin and a token", () => {
    expect(brandShareUrl("https://dashboard.distribute.you", "abc123")).toBe(
      "https://dashboard.distribute.you/share/abc123",
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(brandShareUrl("https://dashboard.distribute.you/", "abc123")).toBe(
      "https://dashboard.distribute.you/share/abc123",
    );
  });

  // "Not shared" and "shared at /share/" are different statements, and the
  // second one is a URL that opens nothing.
  it("returns null for an absent or blank token", () => {
    expect(brandShareUrl("https://x.com", null)).toBeNull();
    expect(brandShareUrl("https://x.com", "")).toBeNull();
    expect(brandShareUrl("https://x.com", "   ")).toBeNull();
  });

  it("escapes a token so it cannot break out of the path", () => {
    expect(brandShareUrl("https://x.com", "a/b?c")).toBe("https://x.com/share/a%2Fb%3Fc");
  });
});

describe("brandFromPathname", () => {
  it("matches a bare brand route", () => {
    expect(brandFromPathname("/orgs/org_1/brands/b-2")).toEqual({
      orgId: "org_1",
      brandId: "b-2",
    });
  });

  it("matches a brand sub-route", () => {
    expect(brandFromPathname("/orgs/org_1/brands/b-2/audiences/leads")).toEqual({
      orgId: "org_1",
      brandId: "b-2",
    });
  });

  // The header renders on every page. A "share this brand" button on billing or
  // the brand LIST names nothing, so these must not match.
  it("does not match org-level or brand-list routes", () => {
    expect(brandFromPathname("/orgs/org_1")).toBeNull();
    expect(brandFromPathname("/orgs/org_1/brands")).toBeNull();
    expect(brandFromPathname("/orgs/org_1/billing")).toBeNull();
    expect(brandFromPathname("/onboarding")).toBeNull();
    expect(brandFromPathname(null)).toBeNull();
    expect(brandFromPathname(undefined)).toBeNull();
  });
});

describe("the public route is reachable without a session", () => {
  it("proxy.ts lists the share path as public", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/proxy.ts"),
      "utf-8",
    );
    // The credential in the URL is the whole authority; requiring a session
    // would defeat the point of a link handed to someone outside the org.
    expect(src).toContain('"/share(.*)"');
  });

  it("the page lives OUTSIDE the (authed) tree, where ClerkProvider mounts", () => {
    expect(
      fs.existsSync(path.join(__dirname, "../src/app/share/[token]/page.tsx")),
    ).toBe(true);
    expect(BRAND_SHARE_PATH).toBe("/share");
  });
});

describe("the public view publishes by NAMING safe fields", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/lib/share-report.ts"),
    "utf-8",
  );

  // A link handed to an investor or a client must not carry the customer's P&L.
  // Building the payload by naming safe fields (rather than forwarding one and
  // deleting the unsafe keys) is what stops a producer that adds a field later
  // from silently publishing it.
  it("never reads a money field off the revenue payload", () => {
    for (const forbidden of [
      "costEconomics",
      "totalSpentCents",
      "roiMultiple",
      "cacPct",
      "dailyBudget",
      "cpprCents",
      "cpcCents",
    ]) {
      expect(src).not.toContain(forbidden);
    }
  });

  it("never reads prospect contact details", () => {
    for (const forbidden of ["leadEmail", "listBrandLeads", "contactEmail"]) {
      expect(src).not.toContain(forbidden);
    }
  });

  // brand-service's resolve returns no org id, and the outreach figures live
  // behind org-scoped endpoints. Reaching for them would mean inventing a
  // lookup the producer deliberately did not hand out.
  it("makes no second, org-scoped call to enrich the payload", () => {
    expect(src).not.toContain("x-org-id");
    expect(src).not.toContain("/features/");
  });

  // A credential in a URL lands in access logs and proxy traces.
  it("sends the credential in the body, never in the path", () => {
    expect(src).toContain("/v1/share-tokens/resolve");
    expect(src).toContain('JSON.stringify({ shareToken })');
  });

  it("is server-only", () => {
    expect(src).toContain('import "server-only"');
  });
});

describe("the share page does not index", () => {
  it("marks itself noindex", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/app/share/[token]/page.tsx"),
      "utf-8",
    );
    // A shared link is a private capability, not a web page.
    expect(src).toContain("index: false");
  });
});
