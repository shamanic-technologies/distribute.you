import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { OFFER_NAME_RULES, offerWriteErrorMessage } from "../src/lib/offer-write";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

const APP = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";

/**
 * A brand can state a NEW thing it sells, and rename one it already sells.
 *
 * Every hop was live before any of this shipped — brand-service serves
 * `POST /orgs/brands/:brandId/offers` and `PATCH .../:offerId`, api-service proxies
 * both, and `createBrandOffer` / `renameBrandOffer` had sat in `lib/api.ts` with
 * zero callers. What was missing was a control, so this is a consumer-only change.
 */
describe("what brand-service refuses, in a customer's words", () => {
  it("names the duplicate on a 409, per kind", () => {
    expect(offerWriteErrorMessage(409, "create")).toContain("already sells something under that name");
    expect(offerWriteErrorMessage(409, "rename")).toContain("already uses that name");
  });

  it("states the name rules on a 400 rather than a generic line", () => {
    // The only field on either body is the name, and it is refused three ways at
    // once — saying which three is what lets a customer fix it in one go.
    for (const kind of ["create", "rename"] as const) {
      expect(offerWriteErrorMessage(400, kind)).toContain(OFFER_NAME_RULES);
    }
  });

  it("answers 403 and 404 in their own words, scoped to what is missing", () => {
    expect(offerWriteErrorMessage(403, "create")).toContain("this brand");
    expect(offerWriteErrorMessage(403, "rename")).toContain("this offer");
    expect(offerWriteErrorMessage(404, "create")).toContain("brand no longer exists");
    expect(offerWriteErrorMessage(404, "rename")).toContain("offer no longer exists");
  });

  it("falls back to one generic line, never to a body dump", () => {
    for (const status of [null, 500, 502] as const) {
      expect(offerWriteErrorMessage(status, "create")).toBe(
        "We could not create this offer. Try again in a moment.",
      );
      expect(offerWriteErrorMessage(status, "rename")).toBe(
        "We could not rename this offer. Try again in a moment.",
      );
    }
  });
});

describe("the create control", () => {
  const page = read("components/offers/offers-page.tsx");
  const modal = read("components/offers/new-offer-modal.tsx");

  it("lives on the Offers PAGE, next to its heading", () => {
    expect(page).toContain("NewOfferModal");
    expect(page).toContain("New offer");
  });

  it("is NOT in the shared table, which also renders on the brand Overview", () => {
    // `OffersTable` is one component in both places. A control inside it would put
    // a create button on the Overview, whose own doc says it carries none.
    const table = read("components/offers/offers-table.tsx");
    expect(table).not.toContain("NewOfferModal");
    expect(table).not.toContain("createBrandOffer");
  });

  it("calls the reader that was already there, and renders no raw error body", () => {
    expect(modal).toContain("createBrandOffer(");
    expect(modal).toContain("offerWriteErrorMessage(");
    expect(modal).not.toContain("error.message");
    expect(modal).not.toContain("err.message");
  });

  it("seeds the offers cache and opens the new offer's Settings", () => {
    // The offer is born EMPTY — no funnel, no confirmed field — so Settings is the
    // only useful next step. Seeding the cache means the row is on screen before
    // the poll comes round.
    expect(modal).toContain("setQueryData(");
    expect(modal).toContain('["brandOffers", brandId]');
    expect(modal).toContain("/settings");
  });

  it("states the name rules before the customer types, not only after a refusal", () => {
    expect(modal).toContain("OFFER_NAME_RULES");
  });
});

describe("renaming an offer", () => {
  const card = read("components/settings/offer-name-card.tsx");

  it("is mounted on Offer Settings", () => {
    expect(read(`${APP}/offers/[offerId]/settings/page.tsx`)).toContain("<OfferNameCard");
  });

  it("calls the reader that was already there, and renders no raw error body", () => {
    expect(card).toContain("renameBrandOffer(");
    expect(card).toContain('offerWriteErrorMessage(status, "rename")');
    expect(card).not.toContain("error.message");
    expect(card).not.toContain("err.message");
  });

  it("writes the renamed offer into the caches both surfaces read", () => {
    // `["brandOffers", brandId]` backs the table; `["brandOffer", brandId, offerId]`
    // backs this page's own read. A rename that updates one leaves the other stating
    // the old name until its next poll.
    expect(card).toContain('["brandOffers", brandId]');
    expect(card).toContain('setQueryData(["brandOffer", brandId, offerId]');
  });
});
