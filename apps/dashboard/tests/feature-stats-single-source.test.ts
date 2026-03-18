import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the feature overview page must derive ALL funnel and reply
 * stats from a single data source (getCampaignBatchStats) so that the bar
 * chart and campaign list cards update in sync on every poll cycle.
 *
 * Previously, emailsContacted/delivered/opened/replied came from a separate
 * getBrandDeliveryStats call that polled independently, causing visible
 * desync between the overview chart and the campaign list.
 */
describe("Feature page stats use a single data source", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should NOT import getBrandDeliveryStats", () => {
    expect(content).not.toContain("getBrandDeliveryStats");
  });

  it("should NOT fetch from email-gateway/stats", () => {
    expect(content).not.toContain("email-gateway/stats");
  });

  it("should aggregate emailsContacted from batch stats", () => {
    // The totals reducer must include emailsContacted from the same batch source
    expect(content).toContain("emailsContacted: acc.emailsContacted + (s.emailsContacted");
  });

  it("should aggregate emailsDelivered from batch stats", () => {
    expect(content).toContain("emailsDelivered: acc.emailsDelivered + (s.emailsDelivered");
  });

  it("should aggregate emailsOpened from batch stats", () => {
    expect(content).toContain("emailsOpened: acc.emailsOpened + (s.emailsOpened");
  });

  it("should aggregate emailsReplied from batch stats", () => {
    expect(content).toContain("emailsReplied: acc.emailsReplied + (s.emailsReplied");
  });

  it("should aggregate reply classifications from batch stats", () => {
    expect(content).toContain("willingToMeet: acc.willingToMeet + (s.repliesWillingToMeet");
    expect(content).toContain("interested: acc.interested + (s.repliesInterested");
    expect(content).toContain("notInterested: acc.notInterested + (s.repliesNotInterested");
  });
});
