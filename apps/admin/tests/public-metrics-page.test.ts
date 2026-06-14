import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const page = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/(dashboard)/page.tsx"),
  "utf-8",
);
const publicStats = fs.readFileSync(
  path.join(__dirname, "../src/lib/public-stats.ts"),
  "utf-8",
);
const sidebar = fs.readFileSync(
  path.join(__dirname, "../src/components/context-sidebar.tsx"),
  "utf-8",
);
const proxy = fs.readFileSync(
  path.join(__dirname, "../src/proxy.ts"),
  "utf-8",
);
const serverFeatureFlag = fs.readFileSync(
  path.join(__dirname, "../src/lib/server-feature-flag.ts"),
  "utf-8",
);

describe("dashboard global build-in-public page", () => {
  it("does not auto-redirect the logo landing page into the active org", () => {
    expect(page).not.toContain("router.replace");
    expect(page).not.toContain("useOrganization");
    expect(page).toContain("distribute public metrics");
    expect(page).toContain('href="/orgs"');
  });

  it("gates the global metrics root behind the public-metrics alpha flag", () => {
    const publicRouteBlock = proxy.slice(
      proxy.indexOf("const isPublicRoute"),
      proxy.indexOf("const isAuthRoute"),
    );
    expect(publicRouteBlock).not.toContain('"/"');
    expect(page).toContain("isServerFeatureFlagEnabled");
    expect(page).toContain('FEATURE_GATES["public-metrics"].flag');
    expect(page).toContain('redirect("/sign-in")');
    expect(page).toContain('redirect("/orgs")');
    const dashboardHome = page.slice(page.indexOf("export default async function DashboardHome"));
    expect(dashboardHome.indexOf("isServerFeatureFlagEnabled")).toBeLessThan(
      dashboardHome.indexOf("fetchPublicStatsSummary"),
    );
    expect(serverFeatureFlag).toContain("/decide/?v=3");
    expect(serverFeatureFlag).toContain("cache: \"no-store\"");
  });

  it("uses real producer sources instead of client-side placeholders", () => {
    expect(publicStats).toContain("/public/stats/users");
    expect(publicStats).toContain("/users/count");
    expect(publicStats).toContain("CLERK_SECRET_KEY");
    expect(publicStats).toContain("/public/stats/billing");
    expect(publicStats).toContain("/public/stats/runs");
    expect(publicStats).toContain("POSTHOG_PERSONAL_API_KEY");
    expect(publicStats).toContain("STRIPE_SECRET_KEY");
    expect(publicStats).toContain("FROM sessions");
    expect(publicStats).toContain("uniq(distinct_id) AS visitors");
    expect(publicStats).toContain("signup_completed");
    expect(publicStats).toContain("/payment_methods");
    expect(page).toContain("fetchPublicStatsSummary");
    expect(page).toContain("Clerk /users/count total");
    expect(page).not.toContain("Pending");
  });

  it("renders the three requested public analytics sub-pages", () => {
    expect(page).toContain("Unique visitors over time");
    expect(page).toContain("Signups vs unique visitors");
    expect(page).toContain("Signup conversion over time");
    expect(page).toContain("Cards added over time");
    expect(page).toContain("Visitor origins");
    expect(page).toContain("Signup to card conversion over time");
  });

  it("replaces the app-level feature list with focused analytics navigation", () => {
    expect(sidebar).toContain('FEATURE_GATES["public-metrics"]');
    expect(sidebar).toContain("publicMetricsOk");
    expect(sidebar).toContain("Unique visitors");
    expect(sidebar).toContain("Signup conversions");
    expect(sidebar).toContain("Cards added");
    expect(sidebar).toContain("/?view=landing");
    expect(sidebar).not.toContain('href: `/features/${f.slug}`');
  });
});
