import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { offerImageLookup } from "../src/lib/offer-image";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

const APP = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";
const OFFER_SETTINGS = `${APP}/offers/[offerId]/settings/page.tsx`;

/**
 * An offer's NAME and its MARK — the two things that tell one proposition from
 * another, and neither was editable anywhere in the product before this.
 */
describe("offerImageLookup", () => {
  const offers = [
    { offerId: "a", imageUrl: "https://cdn/a.png" },
    { offerId: "b", imageUrl: null },
    { offerId: "c" },
  ];

  it("answers an image for an offer that has one", () => {
    expect(offerImageLookup(offers)("a")).toBe("https://cdn/a.png");
  });

  it("reads an offer with no image, an absent field and an unknown id the SAME way — the mark keeps its glyph", () => {
    const at = offerImageLookup(offers);
    expect(at("b")).toBeNull();
    expect(at("c")).toBeNull();
    expect(at("nobody")).toBeNull();
  });

  it("answers null while the list is still in flight rather than throwing", () => {
    expect(offerImageLookup(undefined)("a")).toBeNull();
  });

  it("answers null for no offer at all — a lead attributed to none has nothing to draw", () => {
    const at = offerImageLookup(offers);
    expect(at(null)).toBeNull();
    expect(at(undefined)).toBeNull();
  });
});

describe("OfferMark carries the offer's own image", () => {
  const mark = read("components/marks/offer-mark.tsx");

  it("takes a imageUrl and renders it", () => {
    expect(mark).toContain("imageUrl?: string | null");
    expect(mark).toContain("src={imageUrl}");
  });

  it("falls back to the glyph — an offer created today has no image, and neither does one whose image fails to decode", () => {
    expect(mark).toContain("onError={() => setBroken(true)}");
    expect(mark).toContain("TagIcon");
  });

  it("gives a NEW image a fresh chance to decode, so a regeneration is not swallowed by a sticky failure flag", () => {
    expect(mark).toContain("useEffect(() => setBroken(false), [imageUrl])");
  });

  it("keeps the tinted tile inside the html.dark remap's closed set", () => {
    expect(mark).toContain("bg-purple-50");
    expect(mark).toContain("tone-tile");
  });
});

describe("every surface that CAN resolve an offer's image passes it", () => {
  it("the top bar reads the offer's own row", () => {
    expect(read("components/header-page-context.tsx")).toContain(
      '<OfferMark size="sm" imageUrl={offer.imageUrl} />',
    );
  });

  it("the Offers table reads the row it already renders", () => {
    expect(read("components/offers/offers-table.tsx")).toContain(
      '<OfferMark size="sm" imageUrl={offer.imageUrl} />',
    );
  });

  it("the tenant switcher passes one on BOTH the current offer and every row of its list", () => {
    const switcher = read("components/tenant-switcher.tsx");
    expect(switcher).toContain("<OfferTile imageUrl={t.displayOffer?.imageUrl} />");
    expect(switcher).toContain("<OfferTile imageUrl={o.imageUrl} />");
    // No bare tile left: one offer wearing two marks on one screen is the bug this closes.
    expect(switcher).not.toContain("<OfferTile />");
  });

  it("the three lead surfaces resolve it from the brand's own offer list — lead-service serves an offer with no image", () => {
    for (const file of [
      "components/audiences/lead-scope-cards.tsx",
      "components/audiences/lead-campaign-sections.tsx",
      "components/audiences/engaged-leads-page.tsx",
    ]) {
      expect(read(file)).toContain("useOfferImages");
    }
  });

  it("the leads table takes a RESOLVER, so the read stays on the page and the table stays a pure render", () => {
    const leads = read("components/audiences/engaged-leads-page.tsx");
    expect(leads).toContain("offerImageOf: (lead: Lead) => string | null");
    expect(leads).toContain("<OfferMark size=\"sm\" imageUrl={offerImageOf(lead)} />");
  });

  it("the lookup rides the key the tenant switcher ALREADY polls, so it costs no request", () => {
    expect(read("lib/use-offer-images.ts")).toContain('["brandOffers", brandId ?? "none"]');
    // Never a per-offer by-id fan-out: a leads table naming forty offers is not forty requests.
    expect(read("lib/use-offer-images.ts")).not.toContain("getBrandOffer");
  });
});

describe("Offer Settings states the offer's identity", () => {
  const page = read(OFFER_SETTINGS);
  const card = read("components/settings/offer-identity-card.tsx");

  it("mounts the card LAST — Sales Funnels leads, and the identity edit is the rare one", () => {
    expect(page).toContain("<OfferIdentityCard brandId={brandId} offerId={offerId} />");
    expect(page.indexOf("<OfferIdentityCard")).toBeGreaterThan(page.indexOf("<BrandSalesFunnelsCard"));
  });

  it("writes the name through the reader that had no caller at all before this", () => {
    expect(card).toContain("renameBrandOffer(brandId, offerId, value)");
  });

  it("does NOT re-implement brand-service's name rules — its refusal is the answer", () => {
    // Two words / twenty characters / unique per brand are the producer's, so a limit
    // that moves upstream moves here for free.
    expect(card).not.toMatch(/\.split\(\/\\s\+\//);
    expect(card).not.toContain("length > 20");
    // It STATES them before the customer types, from the one constant that words them.
    expect(card).toContain("OFFER_NAME_RULES");
  });

  it("words a refusal through the module the create modal SHARES, never a second copy", () => {
    expect(card).toContain('from "@/lib/offer-write"');
    expect(card).toContain("offerWriteErrorMessage(err instanceof ApiError ? err.status : null, kind)");
    // `apiCall` sets the message from the body, so rendering it is how a JSON blob
    // reaches a customer.
    expect(card).not.toContain("{err.message}");
  });

  it("says NOTHING on a 402 — apiCall already opened the billing-guard modal, and two surfaces for one refusal is worse than one", () => {
    expect(card).toContain("if (isInsufficientCredit(err)) return null;");
  });

  it("RE-SEEDS the field when the payload changes, so the on-disk snapshot the cache restores first cannot win over the server", () => {
    expect(card).toContain("seededFrom");
    expect(card).toContain("offer === seededFrom.current");
  });

  it("lets a field the user has TOUCHED outrank the server — a form that rewrites itself mid-edit is worse than a stale one", () => {
    expect(card).toContain("if (touched) return;");
  });

  it("draws the mark at the size a person judges it by, not the 18px every other surface uses", () => {
    expect(card).toContain('<OfferMark size="lg"');
  });

  it("writes the response into the cache rather than re-reading, on the key the top bar and the switcher share", () => {
    expect(card).toContain('queryClient.setQueryData(["brandOffer", brandId, offerId], { offer: next })');
    expect(card).toContain('invalidateQueries({ queryKey: ["brandOffers", brandId] })');
  });
});
