import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

const apiContent = read("src/lib/api.ts");

// NOTE: the funnel-metrics / reply-breakdown / leads-stats-panel components and
// the campaign-level leads page were removed with the campaign concept (the UI
// collapses to the brand level). Their registry-driven-renderer guards went with
// them. The api.ts contract below is the surviving, still-relevant assertion.

describe("api.ts — deprecated apollo stats removed", () => {
  it("does not export ApolloStats interface", () => {
    expect(apiContent).not.toMatch(/export interface ApolloStats\b/);
  });

  it("does not declare apollo? field on CampaignStats", () => {
    const cs = apiContent.match(/export interface CampaignStats[\s\S]*?^}/m);
    expect(cs, "CampaignStats interface not found").toBeTruthy();
    expect(cs![0]).not.toMatch(/\bapollo\?:/);
  });
});
