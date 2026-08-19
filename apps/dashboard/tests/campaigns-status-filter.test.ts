import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

/**
 * campaign-service's `status` accepts exactly `ongoing` and `stopped`, and 400s
 * anything else. "Every status" is therefore the ABSENCE of the parameter, not a
 * value named "all".
 *
 * Sending `status=all` 400'd downstream, surfaced as a 500 through the gateway,
 * and made every campaign surface render its empty state — a brand with a live
 * campaign read "No campaign yet". Nothing went red: the request succeeded in
 * the sense that it returned, and the query simply threw.
 */
describe("listCampaignsByBrand asks for every status by omitting the filter", () => {
  const api = read("lib/api.ts");
  const marker = "export async function listCampaignsByBrand(";
  const body = api.slice(api.indexOf(marker), api.indexOf(marker) + 340);

  it("sends no status parameter at all", () => {
    expect(body).toContain("`/campaigns?brandId=${brandId}`");
    expect(body).not.toContain("status=");
  });

  // An enum belongs to the service that validates it, and "all" is almost never
  // a member of one — it is the absence of the filter. This guard is the whole
  // repo's copy of that lesson for this call.
  it("invents no status value the producer does not accept", () => {
    expect(api).not.toContain("campaigns?brandId=${brandId}&status=all");
  });
});
