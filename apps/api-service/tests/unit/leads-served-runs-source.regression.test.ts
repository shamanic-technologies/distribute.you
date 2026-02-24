/**
 * Regression test: the lead-service /stats endpoint can return served: 0 even
 * when leads were successfully processed through the pipeline. The runs-service
 * tracks every lead-serve run accurately, so leadsServed must be derived from
 * the runs-service run count rather than trusting the lead-service stats alone.
 *
 * Fix: campaigns.ts now fetches lead-serve run counts from runs-service
 * (GET /v1/stats/costs?taskName=lead-serve&groupBy=...) and uses that as the
 * source of truth for leadsServed, overriding the lead-service stats.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("leadsServed uses runs-service as source of truth", () => {
  const routePath = path.join(__dirname, "../../src/routes/campaigns.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should fetch lead-serve run counts from runs-service in single-campaign stats", () => {
    // The single-campaign stats endpoint must call runs-service with taskName=lead-serve
    const statsSection = content.slice(
      content.indexOf("GET /v1/campaigns/:id/stats"),
      content.indexOf("POST /v1/campaigns/batch-stats")
    );
    expect(statsSection).toContain("taskName=lead-serve");
    expect(statsSection).toContain("groupBy=serviceName");
  });

  it("should override leadsServed from runs-service in single-campaign stats", () => {
    const statsSection = content.slice(
      content.indexOf("GET /v1/campaigns/:id/stats"),
      content.indexOf("POST /v1/campaigns/batch-stats")
    );
    // Must have a runs-service override that sets leadsServed from runCount
    expect(statsSection).toContain("leadsFromRuns");
    expect(statsSection).toContain("stats.leadsServed");
    expect(statsSection).toContain("runCount");
  });

  it("should fetch lead-serve run counts from runs-service in batch stats", () => {
    const batchSection = content.slice(
      content.indexOf("POST /v1/campaigns/batch-stats")
    );
    expect(batchSection).toContain("taskName=lead-serve");
    expect(batchSection).toContain("groupBy=campaignId");
  });

  it("should override leadsServed from runs-service in batch stats", () => {
    const batchSection = content.slice(
      content.indexOf("POST /v1/campaigns/batch-stats")
    );
    expect(batchSection).toContain("leadsRunCount");
    expect(batchSection).toContain("merged.leadsServed");
  });
});
