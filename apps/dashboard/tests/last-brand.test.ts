import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  lastBrandCookieName,
  matchOrgLanding,
  matchBrandPath,
  resolveLandingBrand,
} from "../src/lib/last-brand";

describe("lastBrandCookieName — org-scoped", () => {
  it("includes the org id so a switch never reads the wrong tenant's brand", () => {
    expect(lastBrandCookieName("org_abc")).toBe("last-brand-org_abc");
    expect(lastBrandCookieName("org_abc")).not.toBe(
      lastBrandCookieName("org_def"),
    );
  });
});

describe("matchOrgLanding — bare /orgs/:orgId only", () => {
  it("matches the bare org URL (with or without a trailing slash)", () => {
    expect(matchOrgLanding("/orgs/org_123")).toEqual({ orgId: "org_123" });
    expect(matchOrgLanding("/orgs/org_123/")).toEqual({ orgId: "org_123" });
  });

  it("does NOT match org sub-routes — they stay reachable, no redirect", () => {
    expect(matchOrgLanding("/orgs/org_123/brands")).toBeNull();
    expect(matchOrgLanding("/orgs/org_123/brands/brand_1")).toBeNull();
    expect(matchOrgLanding("/orgs/org_123/settings")).toBeNull();
    expect(matchOrgLanding("/orgs")).toBeNull();
    expect(matchOrgLanding("/features/x/new")).toBeNull();
  });
});

describe("matchBrandPath — any brand URL incl. sub-routes", () => {
  it("matches the brand overview and deep sub-routes", () => {
    expect(matchBrandPath("/orgs/o1/brands/b1")).toEqual({
      orgId: "o1",
      brandId: "b1",
    });
    expect(matchBrandPath("/orgs/o1/brands/b1/features/sales")).toEqual({
      orgId: "o1",
      brandId: "b1",
    });
  });

  it("does NOT match the brand list or non-brand org routes", () => {
    expect(matchBrandPath("/orgs/o1/brands")).toBeNull();
    expect(matchBrandPath("/orgs/o1")).toBeNull();
  });
});

describe("resolveLandingBrand — last-visited, else first (decision B)", () => {
  const brands = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("returns the last-visited brand when it still exists", () => {
    expect(resolveLandingBrand(brands, "b")).toBe("b");
  });

  it("falls back to the FIRST brand when the last-visited was deleted", () => {
    expect(resolveLandingBrand(brands, "zzz")).toBe("a");
  });

  it("falls back to the FIRST brand when there is no last-visited (no cookie)", () => {
    expect(resolveLandingBrand(brands, null)).toBe("a");
  });

  it("single-brand org always lands on that brand", () => {
    expect(resolveLandingBrand([{ id: "only" }], null)).toBe("only");
    expect(resolveLandingBrand([{ id: "only" }], "stale")).toBe("only");
  });

  it("returns null for an empty org (the onboarding gate owns this case)", () => {
    expect(resolveLandingBrand([], null)).toBeNull();
    expect(resolveLandingBrand([], "x")).toBeNull();
  });
});

describe("proxy.ts wiring — edge read + write", () => {
  const proxy = fs.readFileSync(
    path.join(__dirname, "../src/proxy.ts"),
    "utf-8",
  );

  it("redirects the bare org URL on the last-brand cookie (read side)", () => {
    expect(proxy).toContain("matchOrgLanding");
    expect(proxy).toContain("lastBrandCookieName");
    expect(proxy).toContain("req.cookies.get");
  });

  it("writes the last-brand cookie on a brand URL (write side, httpOnly)", () => {
    expect(proxy).toContain("matchBrandPath");
    expect(proxy).toContain("res.cookies.set");
    expect(proxy).toContain("httpOnly: true");
  });

  it("does not redirect during the autoCreate brand-creation hop", () => {
    expect(proxy).toContain('searchParams.has("autoCreate")');
  });
});

describe("org landing page — client fallback redirect", () => {
  const page = fs.readFileSync(
    path.join(
      __dirname,
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/page.tsx",
    ),
    "utf-8",
  );

  it("redirects to the resolved brand when one exists", () => {
    expect(page).toContain("resolveLandingBrand");
    expect(page).toContain("router.replace");
  });

  it("does not flash Overview while resolving (returns null until decided)", () => {
    expect(page).toMatch(/if \(!brandsData \|\| landingBrandId\)/);
  });
});
