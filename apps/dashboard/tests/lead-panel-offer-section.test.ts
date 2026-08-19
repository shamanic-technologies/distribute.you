import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(process.cwd(), "src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);
const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");

describe("the lead panel names the offer the lead belongs to", () => {
  // The order IS the model: an offer is WHAT we were selling this person, an
  // audience is WHY we picked them for it. The audience was chosen for the
  // offer, so top-down reads proposition before reason.
  it("renders the offer ABOVE the audience", () => {
    const offerAt = src.indexOf("<OfferSection offer=");
    const audienceAt = src.indexOf("<AudienceSection inline=");
    expect(offerAt).toBeGreaterThan(-1);
    expect(audienceAt).toBeGreaterThan(-1);
    expect(offerAt).toBeLessThan(audienceAt);
  });

  // lead-service resolves it off the campaign the lead was served under and
  // serves it on the row. The dashboard holds neither the campaign-to-offer map
  // nor the offer's name, and the audience card is this repo's own precedent
  // for why that join belongs upstream even where it is possible.
  it("reads the served field rather than joining anything", () => {
    expect(src).toContain("selectedLead.offer");
    const marker = "function OfferSection(";
    const body = src.slice(src.indexOf(marker), src.indexOf(marker) + 1200);
    expect(body).not.toContain("useAuthQuery");
    expect(body).not.toContain("listCampaigns");
    expect(body).not.toContain("getBrandOffer");
  });

  // lead-service is fail-soft on this field, so an absent offer means "we could
  // not say" as often as "there is none". A card reading "-" would assert the
  // second.
  it("renders nothing at all when the lead has no offer", () => {
    expect(src).toContain("{selectedLead.offer && <OfferSection");
  });

  // The attribution is real and the link works; hiding it over a missing label
  // would lose a true fact.
  it("still renders a present id whose name is null", () => {
    const marker = "function OfferSection(";
    const body = src.slice(src.indexOf(marker), src.indexOf(marker) + 1200);
    expect(body).toContain("offer.name ??");
    expect(body).toContain("offer.id");
  });

  it("types the field as optional and nullable on the wire", () => {
    expect(api).toContain("offer?: { id: string; name: string | null } | null;");
  });
});
