import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(process.cwd(), "src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);
const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");

// Measured from `function OfferSection(` to its closing brace. A `not.toContain`
// slice that runs PAST the function reads the next one's body and fails on
// correct code, so this is the distance, not a padded guess. Re-measure when the
// function changes; do not widen it "to be safe".
const OFFER_SECTION_LEN = 1112;

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
    const body = src.slice(src.indexOf(marker), src.indexOf(marker) + OFFER_SECTION_LEN);
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
    const body = src.slice(src.indexOf(marker), src.indexOf(marker) + OFFER_SECTION_LEN);
    expect(body).toContain("offer.name ??");
    expect(body).toContain("offer.id");
  });

  it("types the field as optional and nullable on the wire", () => {
    expect(api).toContain("offer?: { id: string; name: string | null } | null;");
  });

  // One thing wears one mark everywhere: the top bar, the tenant switcher, the
  // Offers table and this panel all draw the SHARED `OfferMark`. A second icon
  // definition is how two surfaces come to disagree about what an offer looks
  // like.
  it("leads the panel's offer name with the shared mark", () => {
    const body = src.slice(
      src.indexOf("function OfferSection("),
      src.indexOf("function OfferSection(") + OFFER_SECTION_LEN,
    );
    expect(body).toContain("<OfferMark size=\"sm\" />");
    expect(src).toContain('import { OfferMark } from "@/components/marks/offer-mark"');
  });
});

describe("the leads table states the OFFER, not the industry", () => {
  // A lead's industry is a fact about the company; the offer is what WE were
  // selling it, which is the question the page is about. Every tab shares this
  // one table, so the swap covers all of them.
  it("replaced the Industry column with Offer", () => {
    expect(src).toContain('hidden lg:table-cell">Offer</th>');
    expect(src).not.toContain("Industry</th>");
  });

  // The same served field the right panel renders. The dashboard holds neither
  // the campaign-to-offer map nor the offer's name, so a client-side join is the
  // wrong layer even where it is possible.
  it("reads the served field and draws the shared mark", () => {
    // The Offer CELL, anchored on its own conditional. Measured to its closing
    // `</td>`: 529 chars. A longer slice runs into the Status cell and the
    // `not.toContain` below would then assert about code it does not mean.
    const marker = "{lead.offer ? (";
    const cell = src.slice(src.indexOf(marker), src.indexOf(marker) + 529);
    expect(cell).toContain("lead.offer.name");
    expect(cell).toContain("<OfferMark size=\"sm\" />");
    // No client-side join, and the company's industry is gone from the table.
    expect(src).not.toContain("org?.industry");
  });

  // A column has to hold its cell shape, so the dash stays — but a mark beside
  // nothing would assert an attribution lead-service could not resolve.
  it("renders a plain dash and no mark when the lead has no offer", () => {
    expect(src).toContain("{lead.offer ? (");
  });
});
