import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { offerArchiveRefusalSentence } from "../src/lib/offer-archive";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * An owner can ARCHIVE an offer they no longer sell (brand-service v0.82.3, via the
 * api-service proxy), see archived offers and restore them. Nothing is deleted.
 */
describe("offerArchiveRefusalSentence", () => {
  it("says a running campaign blocks the archive, and what to do", () => {
    const s = offerArchiveRefusalSentence(409, { reason: "offer_has_ongoing_campaign", campaignIds: ["c1"] }, true);
    expect(s).toBe("A campaign is still running on this offer. Stop it first, then archive the offer.");
  });

  it("counts several running campaigns", () => {
    const s = offerArchiveRefusalSentence(409, { reason: "offer_has_ongoing_campaign", campaignIds: ["a", "b"] }, true);
    expect(s).toContain("2 campaigns are still running");
  });

  it("never shows a raw message, and has no em-dash", () => {
    for (const s of [
      offerArchiveRefusalSentence(500, { error: "boom" }, true),
      offerArchiveRefusalSentence(null, null, false),
      offerArchiveRefusalSentence(404, {}, true),
    ]) {
      expect(s).not.toContain("boom");
      expect(s).not.toContain("—");
    }
  });
});

describe("archive wiring", () => {
  const api = read("lib/api.ts");

  it("calls the gateway's archive and unarchive routes and reads the list with includeArchived", () => {
    expect(api).toContain('`/brands/${brandId}/offers/${offerId}/${archived ? "archive" : "unarchive"}`');
    expect(api).toContain("?includeArchived=true");
    expect(api).toMatch(/status: z\.enum\(\["active", "archived"\]\)\.nullish\(\)/);
  });

  it("offers Archive on the offer settings page", () => {
    expect(read("components/v2/setup-pages.tsx")).toContain("<OfferArchiveCard");
  });

  it("history readers keep an archived offer's name and mark", () => {
    for (const f of ["components/v2/use-missions.ts", "components/v2/setup-pages.tsx"]) {
      expect(read(f)).toContain("includeArchived: true");
    }
  });

  it("the v2 Offers list shows archived offers with Restore", () => {
    const list = read("components/v2/offers-list.tsx");
    expect(list).toContain("<ArchivedOffers");
    expect(list).toContain("setBrandOfferArchived(brandId, offerId, false)");
  });
});
