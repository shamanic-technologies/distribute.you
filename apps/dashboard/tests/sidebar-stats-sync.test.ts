import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the campaign sidebar badges (Leads, Emails) must use the
 * same data source as the funnel bar chart (stats from getCampaignStats) so
 * that the numbers displayed in the sidebar and the graph always match.
 *
 * Previously, the sidebar used leads.length and emails.length (from
 * listCampaignLeads / listCampaignEmails), while the graph used
 * stats.leadsServed / stats.emailsGenerated. These came from different API
 * endpoints that polled independently, causing visible number mismatches.
 */
describe("Campaign sidebar badges use stats counters", () => {
  const wrapperPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/campaigns/[id]/sidebar-wrapper.tsx"
  );
  const content = fs.readFileSync(wrapperPath, "utf-8");

  it("should derive leadCount from stats.leadsServed", () => {
    expect(content).toContain("stats?.leadsServed");
  });

  it("should derive emailCount from stats.emailsGenerated", () => {
    expect(content).toContain("stats?.emailsGenerated");
  });

  it("should NOT pass leads.length directly as leadCount", () => {
    // leads.length should only appear as a fallback, not as the primary value
    expect(content).not.toMatch(/leadCount={leads\.length}/);
  });

  it("should NOT pass emails.length directly as emailCount", () => {
    expect(content).not.toMatch(/emailCount={emails\.length}/);
  });
});
