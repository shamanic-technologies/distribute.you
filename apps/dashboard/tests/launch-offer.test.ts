import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { soleOfferId } from "../src/lib/launch-offer";

const onboarding = readFileSync(
  join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf-8",
);

/** The body of the function that launches, so a guard cannot match a neighbour. */
function launchWorkBody(): string {
  const at = onboarding.indexOf("async function runLaunchWork(");
  expect(at).toBeGreaterThan(-1);
  // Measured 2026-08-24: the campaign create sits 5726 chars in, the last thing
  // any guard here asserts on. 7000 keeps headroom for comments; every assertion
  // below is a toContain, so a slice running long costs nothing.
  return onboarding.slice(at, at + 7000);
}

describe("soleOfferId", () => {
  it("names the brand's only offer", () => {
    expect(soleOfferId([{ offerId: "231bb036-1fa4-4e0d-82a9-600b4f744e32" }])).toBe(
      "231bb036-1fa4-4e0d-82a9-600b4f744e32",
    );
  });

  it("names nothing when the brand has no offer yet", () => {
    expect(soleOfferId([])).toBeNull();
  });

  it("never picks one of several — there is no single correct answer", () => {
    expect(soleOfferId([{ offerId: "a" }, { offerId: "b" }])).toBeNull();
  });

  it("reads a blank id as absent rather than naming an empty offer", () => {
    expect(soleOfferId([{ offerId: "   " }])).toBeNull();
  });
});

describe("the launch names the offer on everything it creates", () => {
  it("states it on the campaign, which is (offer x funnel x channel)", () => {
    const body = launchWorkBody();
    expect(body).toContain("createCampaignWithoutBrandEnrichment({");
    expect(body).toContain("...(launchOfferId ? { offerId: launchOfferId } : {})");
  });

  it("states it on the ceiling that paces that campaign", () => {
    const body = launchWorkBody();
    expect(body).toContain("stateBrandFunnelBudgets(pending.brandId, funnelBudgetRows)");
    expect(body).toContain("...(launchOfferId ? { offerId: launchOfferId } : {})");
  });

  it("resolves it from the brand's own offers, never from a guess", () => {
    const body = launchWorkBody();
    expect(body).toContain("listBrandOffers(pending.brandId)");
    expect(body).toContain("soleOfferId(");
  });

  it("never strands a paid launch on the attribution read", () => {
    const body = launchWorkBody();
    // The read is best-effort BY DESIGN: the customer has already been charged,
    // and both consumers adopt an unattributed row on their own cadence, so a
    // failure here is logged loud and the launch continues.
    expect(body).toContain("[dashboard] launch could not name the brand's offer");
  });
});
