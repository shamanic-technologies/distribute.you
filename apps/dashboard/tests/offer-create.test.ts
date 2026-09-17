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
  // The rename lives on the IDENTITY card now. `OfferNameCard` shipped rename-only
  // from one workspace while another was building the offer's generated mark; a
  // name and a mark answer ONE question — which offer is this — so two cards on one
  // page was one screen asking it twice. The card that absorbed it keeps every
  // invariant below.
  const card = read("components/settings/offer-identity-card.tsx");

  it("is mounted on Offer Settings, and there is exactly ONE rename surface", () => {
    const page = read(`${APP}/offers/[offerId]/settings/page.tsx`);
    expect(page).toContain("<OfferIdentityCard");
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

/**
 * The tenant switcher offers the create too, and the whole point is that it does
 * so through the ONE modal on the Offers page.
 *
 * The menu carried "New organization" and "New brand" and no third row, behind a
 * comment saying a new offer "is not a chrome action yet" — which stopped being
 * true the day the Offers page grew its create control and nobody came back. That
 * is the capability-behind-a-gate shape: the write existed, the modal existed, and
 * the surface a customer reaches for offered two of three siblings.
 */
describe("the switcher's entry point", () => {
  const switcher = read("components/tenant-switcher.tsx");
  const page = read("components/offers/offers-page.tsx");

  it("carries a New offer row beside its two siblings", () => {
    expect(switcher).toContain("<span>New offer</span>");
    expect(switcher).toContain("<span>New brand</span>");
    expect(switcher).toContain("<span>New organization</span>");
  });

  it("NAVIGATES with the marker instead of owning a modal of its own", () => {
    // `TenantMenu` is unmounted the moment the menu closes, so a modal it owned
    // would die with its own trigger. A second copy of the form is also how the
    // two surfaces come to ask for different things.
    expect(switcher).toContain("/offers?new=1`");
    expect(switcher).not.toContain("NewOfferModal");
    expect(switcher).not.toContain("createBrandOffer");
  });

  it("opens the form on FIRST paint and then consumes the marker", () => {
    // Seeded in the initializer, not an effect: the form is on screen in the first
    // frame rather than appearing a moment after the page.
    expect(page).toContain('searchParams.get("new") === "1"');
    expect(page).toContain("useState(openedFromLink)");
    // Left in the URL, `?new=1` re-opens a form the reader already cancelled on any
    // refresh or Back. Through history, never `router.replace`, which would refetch
    // the segment to change nothing AND reseed `creating` from the removed param.
    expect(page).toContain("window.history.replaceState");
    expect(page).not.toContain("router.replace");
  });
});
