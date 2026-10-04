import { describe, expect, it } from "vitest";
import { legCampaignId } from "../src/lib/v2/leg-campaign";

const c = (id: string, legKey: string, status: string, createdAt: string, offerId = "o") => ({ id, offerId, legKey, status, createdAt });

describe("legCampaignId", () => {
  it("picks the live campaign of the leg on the offer", () => {
    expect(legCampaignId([c("a", "L", "stopped", "2026-10-03"), c("b", "L", "ongoing", "2026-10-01"), c("x", "M", "ongoing", "2026-10-04")], "o", "L")).toBe("b");
  });
  it("falls to the most recent when none is live, null when the leg has none", () => {
    expect(legCampaignId([c("a", "L", "stopped", "2026-10-01"), c("b", "L", "stopped", "2026-10-03")], "o", "L")).toBe("b");
    expect(legCampaignId([c("a", "L", "ongoing", "2026-10-01", "other")], "o", "L")).toBeNull();
  });
});
