import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  lastBrandCookieName,
  explicitHierarchyHref,
  matchBrandPath,
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

describe("proxy.ts wiring — edge read + write", () => {
  const proxy = fs.readFileSync(
    path.join(__dirname, "../src/proxy.ts"),
    "utf-8",
  );

  it("redirects the bare org URL on the last-brand cookie (read side)", () => {
    // v1's bare org URL is redirected to v2 by `v2PathForV1`, which reads the cookie.
    expect(proxy).toContain("v2PathForV1");
    expect(proxy).toContain("lastBrandCookieName");
    expect(proxy).toContain("req.cookies.get");
  });

  it("writes the last-brand cookie on a brand URL (write side, httpOnly)", () => {
    expect(proxy).toContain("matchBrandPath");
    expect(proxy).toContain("res.cookies.set");
    expect(proxy).toContain("httpOnly: true");
  });
});

describe("hierarchy links — breadcrumb", () => {
  const breadcrumb = fs.readFileSync(
    path.join(__dirname, "../src/components/breadcrumb-nav.tsx"),
    "utf-8",
  );

  it("marks breadcrumb parent links as explicit hierarchy navigation", () => {
    // The breadcrumb serves the onboarding chrome.
    // Org root link uses the per-tab URL org, not the shared active org (#1948).
    expect(breadcrumb).toContain("explicitHierarchyHref(`/orgs/${orgId}`)");
    expect(breadcrumb).toContain("explicitHierarchyHref(`/orgs/${orgId}/brands/${brandId}`)");
  });
});
