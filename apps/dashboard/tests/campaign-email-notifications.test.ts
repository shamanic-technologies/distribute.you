import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");

/**
 * `sendCampaignEmail` was removed from the customer dashboard: it had zero callers
 * there, while the staff console (which keeps its own api.ts) sends campaign email
 * from seven places. Operating a campaign is a staff action.
 */
describe("sendCampaignEmail is not a customer-dashboard concern", () => {
  const apiSrc = fs.readFileSync(apiPath, "utf-8");

  it("is absent from the customer api client", () => {
    expect(apiSrc).not.toContain("export async function sendCampaignEmail");
  });
});
