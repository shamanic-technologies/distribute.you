import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The v2 Offers page is drawn in Keel's anatomy (the Missions list) and forks no data
 * layer: the same readers and query keys v1's `OffersTable` / `NewOfferModal` use, so
 * the caches dedupe and stay persisted, and the same Learning / Paused and ordering
 * rules, so a reader switching views meets the same list.
 */
describe("v2 Offers list", () => {
  const list = read("components/v2/offers-list.tsx");
  const modal = read("components/v2/new-offer-modal.tsx");
  const setup = read("components/v2/setup-pages.tsx");

  it("setup-pages mounts the v2 list, not the v1 table or modal", () => {
    const fn = setup.slice(setup.indexOf("export function V2OffersPage("), setup.indexOf("function useOfferName("));
    expect(fn).toContain("<V2OffersList />");
    expect(setup).not.toContain("<OffersTable");
    expect(setup).not.toContain("<NewOfferModal");
  });

  it("reads v1's own query keys and readers", () => {
    expect(list).toContain('["brandOffers", brandId], () => listBrandOffers(brandId)');
    expect(list).toContain('["brandOfferMoney", brandId], () => getBrandOfferMoney(brandId)');
    expect(list).toContain("useOfferLearning(brandId, featureSlug)");
    expect(list).toContain("usePausedByOffer(brandId)");
    expect(list).toContain("scopePausedFor(pausedByOfferId, o.offerId, pausedSettled)");
  });

  it("withholds the two ratios together while learning, never the two totals", () => {
    expect(list).toContain("learning ? <Withheld paused={paused} />");
    const revenueCell = list.slice(list.indexOf("revenue?.totalPipelineUsd == null"));
    expect(revenueCell.slice(0, 200)).not.toContain("Withheld");
    expect(list).toContain('paused ? "Paused" : "Learning"');
  });

  it("reveals on settle and computes no metric", () => {
    expect(list).toContain("offersQ.isError");
    expect(list).toContain("groupsQ.isError");
    expect(list).not.toMatch(/\.reduce\(/);
  });

  it("opens the offer's v2 page", () => {
    expect(list).toContain("v2OfferHref(orgId, brandId, offerId)");
    expect(modal).toContain("router.push(v2OfferHref(orgId, brandId, offer.offerId))");
  });

  it("the modal is a portalled k-popover, Esc closes, same write and refusal copy", () => {
    expect(modal).toContain('document.getElementById("v2-portal")');
    expect(modal).toContain("k-popover");
    expect(modal).toContain('e.key === "Escape"');
    expect(modal).toContain("createBrandOffer(brandId, value)");
    expect(modal).toContain('offerWriteErrorMessage(status, "create")');
    expect(modal).not.toContain("error.message");
  });

  it("uses no v1 class family", () => {
    for (const src of [list, modal]) {
      expect(src).not.toMatch(/text-gray-|bg-white rounded-xl|bg-brand-50|InfoTooltip|rounded-lg border|shadow-2xl|bg-black\//);
    }
  });
});
