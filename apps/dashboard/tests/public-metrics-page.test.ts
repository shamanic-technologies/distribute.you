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

describe("dashboard global build-in-public page", () => {
  it("does not auto-redirect the logo landing page into the active org", () => {
    expect(page).not.toContain("router.replace");
    expect(page).not.toContain("useOrganization");
    expect(page).toContain("distribute public metrics");
    expect(page).toContain('href="/orgs"');
  });

  it("uses the existing public stats endpoints instead of a client-side workaround", () => {
    expect(publicStats).toContain("/public/stats/users");
    expect(publicStats).toContain("/public/stats/billing");
    expect(publicStats).toContain("/public/stats/runs");
    expect(page).toContain("fetchPublicStatsSummary");
  });

  it("documents PostHog and GA4 as separate bronze sources feeding one silver/gold funnel", () => {
    expect(page).toContain("PostHog events raw");
    expect(page).toContain("GA4 events or report snapshots raw");
    expect(page).toContain("Canonical web sessions and funnel steps");
    expect(page).toContain("public_funnel_daily / weekly / all_time");
  });

  it("keeps unavailable producer metrics explicit", () => {
    expect(page).toContain("visitor-to-signup rate");
    expect(page).toContain("auto-top-up count");
    expect(page).toContain("credit-purchaser count");
    expect(page).not.toContain("accounts_with_auto_topup");
  });
});
