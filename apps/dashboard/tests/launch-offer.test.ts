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
  // Bounded to the next declaration rather than a measured length, so the slice
  // moves with the file.
  return onboarding.slice(at, onboarding.indexOf("async function resolveLaunchCampaigns(", at));
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
  it("states it on the campaign, which is (offer x leg x channel)", () => {
    const body = launchWorkBody();
    expect(body).toContain("createCampaignWithoutBrandEnrichment({");
    expect(body).toContain("offerId: launchOfferId,");
  });

  it("states it on the ceiling that paces that campaign", () => {
    const body = launchWorkBody();
    expect(body).toContain("saveCampaignBudget(");
    expect(body).toContain("{ offerId: launchOfferId, legKey: c.legKey, featureSlug: c.featureSlug }");
  });

  it("resolves it from the brand's own offers, never from a guess", () => {
    const body = launchWorkBody();
    expect(body).toContain("listBrandOffers(pending.brandId)");
    expect(body).toContain("soleOfferId(");
  });

  it("logs a failed attribution read, and funds nothing it cannot name", () => {
    const body = launchWorkBody();
    // billing keys a ceiling on (offer, leg, channel), so a launch that names no
    // offer has nowhere to put the money: it logs loud and refuses rather than
    // inventing an offer.
    expect(body).toContain("[dashboard] launch could not name the brand's offer");
    expect(body).toContain("if (!launchOfferId) {");
  });
});
