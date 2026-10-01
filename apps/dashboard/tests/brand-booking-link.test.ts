import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// The booking link lived on a settings card retired in #4433 while
// brand-service kept the value per offer. These pin that it is editable again, on
// the Brand Settings surface, through a write that sends nothing else.
describe("brand settings booking link", () => {
  const card = read("src/components/settings/brand-booking-link-card.tsx");
  const api = read("src/lib/api.ts");

  it("reads bookingUrl on the offer economics, as the producer serves it", () => {
    expect(api).toContain("bookingUrl: z.string().nullable(),");
  });

  it("writes the booking link alone, never restating the rest of the economics", () => {
    const at = api.indexOf("export async function saveOfferBookingUrl(");
    expect(at).toBeGreaterThan(-1);
    const body = api.slice(at, api.indexOf("\n}\n", at));
    expect(body).toContain("body: { bookingUrl }");
    expect(body).not.toContain("lifetimeRevenueUsd");
  });

  it("is one field per offer, written through saveOfferBookingUrl", () => {
    expect(card).toContain("listBrandOffers(brandId)");
    expect(card).toContain("saveOfferBookingUrl(brandId, offer.offerId");
    expect(card).toContain('["offerEconomics", brandId, offer.offerId]');
  });

  it("is mounted on the Brand Settings page", () => {
    expect(read("src/components/v2/brand-settings-page.tsx")).toContain(
      "<BrandBookingLinkCard brandId={brandId} bare />",
    );
  });
});
