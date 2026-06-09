import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  lastBrandCookieName,
  explicitHierarchyHref,
  hasExplicitHierarchyIntent,
  matchOrgLanding,
  matchBrandPath,
  resolveLandingBrand,
  resolveFeatureLanding,
} from "../src/lib/last-brand";

describe("lastBrandCookieName — org-scoped", () => {
  it("includes the org id so a switch never reads the wrong tenant's brand", () => {
    expect(lastBrandCookieName("org_abc")).toBe("last-brand-org_abc");
    expect(lastBrandCookieName("org_abc")).not.toBe(
      lastBrandCookieName("org_def"),
    );
  });
});

describe("explicit hierarchy intent — user-requested back navigation", () => {
  it("marks hierarchy links with a query param that survives through root redirects", () => {
    expect(explicitHierarchyHref("/")).toBe("/?view=overview");
    expect(explicitHierarchyHref("/orgs/org_123")).toBe(
      "/orgs/org_123?view=overview",
    );
    expect(explicitHierarchyHref("/orgs/org_123?tab=usage")).toBe(
      "/orgs/org_123?tab=usage&view=overview",
    );
  });

  it("detects only the explicit overview marker", () => {
    expect(
      hasExplicitHierarchyIntent(new URLSearchParams("view=overview")),
    ).toBe(true);
    expect(hasExplicitHierarchyIntent(new URLSearchParams(""))).toBe(false);
    expect(hasExplicitHierarchyIntent(new URLSearchParams("view=brand"))).toBe(
      false,
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

  it("does not redirect a bare org URL when the user explicitly asked for hierarchy overview", () => {
    expect(proxy).toContain("hasExplicitHierarchyIntent");
    expect(proxy).toContain("!hasExplicitHierarchyIntent(req.nextUrl.searchParams)");
  });

  it("treats /?view=overview as authenticated dashboard navigation, not public metrics", () => {
    expect(proxy).toContain("isExplicitDashboardRoot");
    expect(proxy).toContain('pathname === "/"');
    expect(proxy).toContain('const orgsUrl = new URL("/orgs", req.url)');
    expect(proxy).toContain("orgsUrl.search = req.nextUrl.search");
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

  it("keeps the org overview reachable on explicit hierarchy navigation", () => {
    expect(page).toContain("hasExplicitHierarchyIntent");
    expect(page).toContain("!explicitHierarchy && brandsData");
  });

  it("does not flash Overview while resolving (returns null until decided)", () => {
    expect(page).toMatch(/if \(!brandsData \|\| landingBrandId\)/);
  });
});

describe("resolveFeatureLanding — auto-skip into the single GA feature", () => {
  const sales = { slug: "sales-cold-email-outreach" };
  const journalists = { slug: "journalists-quotes" };

  it("routes to the feature when its campaign(s) exist", () => {
    expect(
      resolveFeatureLanding([sales], [{ featureSlug: "sales-cold-email-outreach" }]),
    ).toEqual({ featureSlug: "sales-cold-email-outreach", needsCampaign: false });
  });

  it("routes to new-campaign when the brand has no campaign for it", () => {
    expect(resolveFeatureLanding([sales], [])).toEqual({
      featureSlug: "sales-cold-email-outreach",
      needsCampaign: true,
    });
  });

  it("ignores campaigns belonging to other features when deciding needsCampaign", () => {
    expect(
      resolveFeatureLanding([sales], [{ featureSlug: "journalists-quotes" }]),
    ).toEqual({ featureSlug: "sales-cold-email-outreach", needsCampaign: true });
  });

  it("returns null with 2+ GA features (overview renders the choice)", () => {
    expect(resolveFeatureLanding([sales, journalists], [])).toBeNull();
  });

  it("returns null with no GA features", () => {
    expect(resolveFeatureLanding([], [])).toBeNull();
  });
});

describe("brand overview page — auto-skip into the feature", () => {
  const page = fs.readFileSync(
    path.join(
      __dirname,
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
    ),
    "utf-8",
  );

  it("computes the landing via the shared pure helper", () => {
    expect(page).toContain("resolveFeatureLanding");
    expect(page).toContain("router.replace");
  });

  it("only considers GA + implemented features (posthog-independent, no flash)", () => {
    expect(page).toContain("GA_BRAND_FEATURES.has(f.slug)");
  });

  it("renders nothing while the redirect is certain (no overview flash)", () => {
    expect(page).toMatch(/if \(willRedirect\)/);
  });

  it("keeps the brand overview reachable on explicit hierarchy navigation", () => {
    expect(page).toContain("hasExplicitHierarchyIntent");
    expect(page).toContain("!explicitHierarchy");
  });
});

describe("hierarchy links — breadcrumb, header, sidebar", () => {
  const breadcrumb = fs.readFileSync(
    path.join(__dirname, "../src/components/breadcrumb-nav.tsx"),
    "utf-8",
  );
  const header = fs.readFileSync(
    path.join(__dirname, "../src/components/header.tsx"),
    "utf-8",
  );
  const contextSidebar = fs.readFileSync(
    path.join(__dirname, "../src/components/context-sidebar.tsx"),
    "utf-8",
  );
  const campaignSidebar = fs.readFileSync(
    path.join(__dirname, "../src/components/campaign-sidebar.tsx"),
    "utf-8",
  );

  it("marks logo and breadcrumb parent links as explicit hierarchy navigation", () => {
    expect(header).toContain('explicitHierarchyHref("/")');
    expect(breadcrumb).toContain("explicitHierarchyHref(`/orgs/${organization.id}`)");
    expect(breadcrumb).toContain("explicitHierarchyHref(`/orgs/${orgId}/brands/${brandId}`)");
  });

  it("marks sidebar back links and overview rows as explicit hierarchy navigation", () => {
    expect(contextSidebar).toContain("href={explicitHierarchyHref(href)}");
    expect(contextSidebar).toContain("explicitHierarchyHref(`/orgs/${orgId}`)");
    expect(contextSidebar).toContain("explicitHierarchyHref(basePath)");
    expect(campaignSidebar).toContain("explicitHierarchyHref(");
  });
});
