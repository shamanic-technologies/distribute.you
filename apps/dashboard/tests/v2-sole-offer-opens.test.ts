import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Owner 2026-11-18: a brand with ONE offer never sees the Offers list, it opens that offer;
// New offer then lives on the offer page and its crumb stops linking back to the list.
const src = readFileSync(join(__dirname, "../src/components/v2/setup-pages.tsx"), "utf8");
const listPage = src.slice(src.indexOf("export function V2OffersPage("), src.indexOf("function OfferListCard("));
const offerPage = src.slice(src.indexOf("export function V2OfferPage("), src.indexOf("type TargetingView"));

describe("Setup > Offers with a single offer", () => {
  it("the list replaces itself with the sole offer's page", () => {
    expect(listPage).toContain("offers?.length === 1 ? offers[0].offerId : null");
    expect(listPage).toContain("router.replace(v2OfferHref(orgId, brandId, sole))");
    expect(listPage).toContain("!settled || sole ?");
  });

  it("the sole offer's page carries New offer and an unlinked Offers crumb", () => {
    expect(offerPage).toContain("isSole ? { label: \"Offers\" }");
    expect(offerPage).toContain("<V2NewOfferModal");
    expect(offerPage).toContain("New offer");
  });
});
