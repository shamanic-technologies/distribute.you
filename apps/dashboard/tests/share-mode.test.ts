import { describe, it, expect } from "vitest";
import {
  SHARE_PATH_PREFIX,
  isSharePathname,
  shareApiBasePath,
  shareBrandBasePath,
  shareContextFromPathname,
  shareTokenFromPathname,
} from "../src/lib/share-mode";

// `lib/share-mode.ts` carries no `@` import, so it is runtime-importable and gets
// real unit tests rather than source-substring guards. Keep it that way.

describe("shareTokenFromPathname", () => {
  it("reads the credential off a share path", () => {
    expect(shareTokenFromPathname("/share/bshr_abc")).toBe("bshr_abc");
    expect(shareTokenFromPathname("/share/bshr_abc/orgs/o1/brands/b1")).toBe("bshr_abc");
  });

  it("is null anywhere else, so the dashboard is untouched", () => {
    expect(shareTokenFromPathname("/orgs/o1/brands/b1/audiences")).toBeNull();
    expect(shareTokenFromPathname("/")).toBeNull();
    expect(shareTokenFromPathname(null)).toBeNull();
    expect(shareTokenFromPathname(undefined)).toBeNull();
  });

  // A bare `/share` names no credential and must not read as one.
  it("is null for the prefix alone", () => {
    expect(shareTokenFromPathname(SHARE_PATH_PREFIX)).toBeNull();
    expect(shareTokenFromPathname("/share/")).toBeNull();
  });

  it("decodes an encoded token", () => {
    expect(shareTokenFromPathname("/share/a%2Fb/orgs/o/brands/b")).toBe("a/b");
  });
});

describe("isSharePathname", () => {
  it("separates the two trees", () => {
    expect(isSharePathname("/share/t/orgs/o/brands/b")).toBe(true);
    expect(isSharePathname("/orgs/o/brands/b")).toBe(false);
  });
});

describe("shareContextFromPathname", () => {
  it("parses the mirrored org and brand", () => {
    expect(shareContextFromPathname("/share/t1/orgs/org-1/brands/brand-1")).toEqual({
      token: "t1",
      orgId: "org-1",
      brandId: "brand-1",
    });
  });

  it("keeps working on a sub-route", () => {
    expect(
      shareContextFromPathname("/share/t1/orgs/org-1/brands/brand-1/audiences/leads"),
    ).toEqual({ token: "t1", orgId: "org-1", brandId: "brand-1" });
  });

  // `/share/<token>` alone only resolves and redirects — it renders no brand data,
  // so there is no context to hand out.
  it("is null on the entry route", () => {
    expect(shareContextFromPathname("/share/t1")).toBeNull();
  });

  it("is null in the authed tree", () => {
    expect(shareContextFromPathname("/orgs/org-1/brands/brand-1")).toBeNull();
  });
});

describe("shareBrandBasePath", () => {
  it("composes the route the credential lands on", () => {
    expect(shareBrandBasePath("t1", "org-1", "brand-1")).toBe(
      "/share/t1/orgs/org-1/brands/brand-1",
    );
  });

  it("round-trips through the parser", () => {
    const path = shareBrandBasePath("t1", "org-1", "brand-1");
    expect(shareContextFromPathname(path)).toEqual({
      token: "t1",
      orgId: "org-1",
      brandId: "brand-1",
    });
  });
});

describe("shareApiBasePath", () => {
  // Composed in ONE place so the browser client and the route handler cannot
  // disagree about where the share proxy lives.
  it("points at the share tree's own proxy, never /api/v1", () => {
    expect(shareApiBasePath("t1")).toBe("/share/t1/api/v1");
  });
});
