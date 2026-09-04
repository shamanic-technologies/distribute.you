import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(
  join(process.cwd(), "src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);
const sections = readFileSync(
  join(process.cwd(), "src/components/audiences/lead-campaign-sections.tsx"),
  "utf8",
);
const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");

/** Bounded to the NEXT declaration rather than a measured length: a `toContain` cannot
 *  be hurt by a slice running long, and the boundary then moves with the file instead
 *  of expiring on the next comment added to the function. */
const sliceTo = (src: string, marker: string, next: string) => {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  const end = src.indexOf(next, at);
  return src.slice(at, end > at ? end : undefined);
};

describe("the lead panel names the offer the lead was contacted for", () => {
  // The offer is a CAMPAIGN's answer — lead-service resolves it off the campaign the
  // lead was served under — so it bands the campaigns that sold it rather than sitting
  // at person level. A person contacted by campaigns of nine different offers had one
  // of those nine printed as theirs.
  it("bands the offer above its campaigns rather than stating one per person", () => {
    expect(sections).toContain("function OfferBand(");
    expect(page).not.toContain("<OfferSection offer=");
    // The tree groups on the row's own served offer; nothing joins a campaign to an
    // offer in the browser.
    const tree = readFileSync(join(process.cwd(), "src/lib/lead-campaign-tree.ts"), "utf8");
    expect(tree).toContain("row.offer?.id ?? null");
  });

  // lead-service resolves it off the campaign and serves it on the row. The dashboard
  // holds neither the campaign-to-offer map nor the offer's name, and the audience is
  // this repo's own precedent for why that join belongs upstream even where possible.
  it("reads the served field rather than joining anything", () => {
    const body = sliceTo(sections, "function OfferBand(", "function CampaignCard(");
    expect(body).not.toContain("useAuthQuery");
    expect(body).not.toContain("listCampaigns");
    expect(body).not.toContain("getBrandOffer");
  });

  // lead-service is fail-soft on this field, so an absent offer means "we could not
  // say" as often as "there is none" — and the campaigns under the band are real
  // either way, so the band renders with no name and no link rather than vanishing
  // with the campaigns inside it.
  it("still draws the band, without a link, when the offer could not be resolved", () => {
    const body = sliceTo(sections, "function OfferBand(", "function CampaignCard(");
    expect(body).toContain("Unnamed offer");
    expect(body).toContain("{offer.offerId && (");
  });

  it("types the field as optional and nullable on the wire", () => {
    expect(api).toContain("offer?: { id: string; name: string | null } | null;");
  });

  // One thing wears one mark everywhere: the top bar, the tenant switcher, the Offers
  // table and this band all draw the SHARED `OfferMark`. A second icon definition is
  // how two surfaces come to disagree about what an offer looks like.
  it("leads the offer name with the shared mark", () => {
    const body = sliceTo(sections, "function OfferBand(", "function CampaignCard(");
    expect(body).toContain('<OfferMark size="sm" />');
    expect(sections).toContain('import { OfferMark } from "@/components/marks/offer-mark"');
  });
});

describe("the leads table states the OFFER, not the industry", () => {
  // A lead's industry is a fact about the company; the offer is what WE were
  // selling it, which is the question the page is about. Every tab shares this
  // one table, so the swap covers all of them.
  it("replaced the Industry column with Offer", () => {
    expect(page).toContain('hidden lg:table-cell">Offer</th>');
    expect(page).not.toContain("Industry</th>");
  });

  // The same served field the right panel renders. The dashboard holds neither
  // the campaign-to-offer map nor the offer's name, so a client-side join is the
  // wrong layer even where it is possible.
  it("reads the served field and draws the shared mark", () => {
    // The Offer CELL, anchored on its own conditional. Measured to its closing
    // `</td>`: 529 chars. A longer slice runs into the Status cell and the
    // `not.toContain` below would then assert about code it does not mean.
    const marker = "{lead.offer ? (";
    const cell = page.slice(page.indexOf(marker), page.indexOf(marker) + 529);
    expect(cell).toContain("lead.offer.name");
    expect(cell).toContain('<OfferMark size="sm" />');
    // No client-side join, and the company's industry is gone from the table.
    expect(page).not.toContain("org?.industry");
  });

  // A column has to hold its cell shape, so the dash stays — but a mark beside
  // nothing would assert an attribution lead-service could not resolve.
  it("renders a plain dash and no mark when the lead has no offer", () => {
    expect(page).toContain("{lead.offer ? (");
  });
});
