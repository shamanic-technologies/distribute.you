import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const metricsPage = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/(dashboard)/metrics/page.tsx"),
  "utf-8",
);
const rootPage = fs.readFileSync(
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
const header = fs.readFileSync(
  path.join(__dirname, "../src/components/header.tsx"),
  "utf-8",
);
const proxy = fs.readFileSync(
  path.join(__dirname, "../src/proxy.ts"),
  "utf-8",
);

describe("cross-org build-in-public metrics page", () => {
  it("lives at /metrics and is reached from the header logo", () => {
    expect(metricsPage).toContain("distribute public metrics");
    expect(metricsPage).toContain('href="/orgs"');
    // Header logo points at the app root, which forwards to /orgs.
    expect(header).toContain('href="/"');
    // Bare root just forwards to /orgs.
    expect(rootPage).toContain('redirect("/orgs")');
    expect(rootPage).not.toContain("distribute public metrics");
  });

  it("is not per-viewer flag gated — the admin edge already staff-gates the app", () => {
    expect(metricsPage).not.toContain("isServerFeatureFlagEnabled");
    expect(metricsPage).not.toContain('FEATURE_GATES["public-metrics"]');
    expect(metricsPage).toContain('redirect("/sign-in")');
    // The onboarding first-run gate exempts /metrics (platform view).
    expect(proxy).toContain("isMetricsRoute");
    expect(proxy).toContain('createRouteMatcher(["/metrics(.*)"])');
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
    expect(metricsPage).toContain("fetchPublicStatsSummary");
    expect(metricsPage).toContain("Clerk /users/count total");
    expect(metricsPage).not.toContain("Pending");
  });

  it("renders the three requested public analytics sub-pages", () => {
    expect(metricsPage).toContain("Unique visitors over time");
    expect(metricsPage).toContain("Signups vs unique visitors");
    expect(metricsPage).toContain("Signup conversion over time");
    expect(metricsPage).toContain("Paid users vs signups");
    expect(metricsPage).toContain("Visitor origins");
    expect(metricsPage).toContain("Signup to paid conversion over time");
  });

  it("shows compound growth (CMGR/CWGR) on the monthly and weekly signup charts, no daily chart", () => {
    expect(metricsPage).toContain("CMGR since inception");
    expect(metricsPage).toContain("CWGR since inception");
    expect(metricsPage).toContain("CmgrStat");
    // The daily signup chart was removed (its bucket call + day-on-day line are gone).
    expect(metricsPage).not.toContain("dailySignups");
    expect(metricsPage).not.toContain("day-on-day");
    expect(metricsPage).not.toContain("DoD growth");
  });

  it("exposes the focused analytics navigation in the app-level sidebar", () => {
    expect(sidebar).toContain("Unique visitors");
    expect(sidebar).toContain("Signups");
    expect(sidebar).toContain("Paid users");
    expect(sidebar).toContain("/metrics?view=landing");
    expect(sidebar).not.toContain('href="/?view=landing"');
  });
});
