import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { OFFER_NAME_RULES, offerWriteErrorMessage } from "../src/lib/offer-write";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * A brand can state a NEW thing it sells, and rename one it already sells.
 *
 * Every hop was live before any of this shipped — brand-service serves
 * `POST /orgs/brands/:brandId/offers` and `PATCH .../:offerId`, api-service proxies
 * both, and `createBrandOffer` / `renameBrandOffer` had sat in `lib/api.ts` with
 * zero callers. What was missing was a control, so this is a consumer-only change.
 */
describe("what brand-service refuses, in a customer's words", () => {
  it("answers the image write on access and on absence, and generically otherwise", () => {
    // The image body carries no name, so the three name-shaped refusals cannot reach
    // it. A 402 never gets here at all — the billing-guard modal already has it.
    expect(offerWriteErrorMessage(403, "generate")).toContain("access to this offer");
    expect(offerWriteErrorMessage(404, "generate")).toContain("offer no longer exists");
    for (const status of [null, 400, 409, 500] as const) {
      expect(offerWriteErrorMessage(status, "generate")).toBe(
        "We could not draw this offer. Try again in a moment.",
      );
    }
  });

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
  const modal = read("components/v2/new-offer-modal.tsx");

  it("calls the reader that was already there, and renders no raw error body", () => {
    expect(modal).toContain("createBrandOffer(");
    expect(modal).toContain("offerWriteErrorMessage(");
    expect(modal).not.toContain("error.message");
    expect(modal).not.toContain("err.message");
  });

  it("seeds the offers cache, so the row is on screen before the poll comes round", () => {
    expect(modal).toContain("setQueryData(");
    expect(modal).toContain('["brandOffers", brandId]');
  });

  it("states the name rules before the customer types, not only after a refusal", () => {
    expect(modal).toContain("OFFER_NAME_RULES");
  });
});

describe("renaming an offer", () => {
  // The rename lives in the offer page's TITLE now: name and mark answer ONE
  // question (which offer is this), edited where they are read.
  const card = read("components/v2/offer-identity-title.tsx");

  it("is mounted on the offer's setup page, and there is exactly ONE rename surface", () => {
    const page = read("components/v2/setup-pages.tsx");
    expect(page).toContain("<OfferIdentityTitle");
    expect(page).not.toContain("OfferNameCard");
    expect(() => read("components/settings/offer-name-card.tsx")).toThrow();
  });

  it("calls the reader that was already there, and renders no raw error body", () => {
    expect(card).toContain("renameBrandOffer(");
    expect(card).toContain('refusal(err, "rename")');
    expect(card).toContain("offerWriteErrorMessage(err instanceof ApiError ? err.status : null, kind)");
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
