import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isSpecialOfferGrant,
  parseSpecialOffers,
  specialOffersView,
} from "../src/lib/special-offers";

// SPECIAL-OFFER-BF-1127: the Billing page shows what each special offer brought the
// org, read from billing's `GET /v1/billing/special-offers`, apart from free credit.

// The real prod answer for NOVEMIQ (2026-11-27).
const NOVEMIQ = {
  org_id: "22ffb00a-b7da-4453-9bf2-1784c2d2bf9e",
  special_offers: [
    {
      slug: "black-friday-2026",
      name: "Black Friday 2026",
      starts_at: "2026-11-27T00:00:00.000Z",
      ends_at: "2026-12-01T00:00:00.000Z",
      paid_cents: "45000.0000000000",
      free_credit_cents: "45000.0000000000",
      payments: [
        {
          payment_id: "6b091033-67fa-adb7-b3c5-f1336a3abc77",
          acquirer: "revolut",
          paid_cents: "45000.0000000000",
          paid_at: "2026-11-27T05:08:03.000Z",
          free_credit_cents: "45000.0000000000",
          grant_id: "0ec8685e-1365-4882-979e-738b656f7b82",
          applied_at: "2026-11-27T07:13:45.218Z",
        },
      ],
    },
  ],
};

const page = readFileSync(join(__dirname, "../src/components/v2/billing-page.tsx"), "utf8");
const list = readFileSync(join(__dirname, "../src/components/v2/special-offers-list.tsx"), "utf8");

describe("special offers reader", () => {
  it("keeps billing's totals as served (never summed here)", () => {
    const [offer] = parseSpecialOffers(NOVEMIQ);
    expect(offer.name).toBe("Black Friday 2026");
    expect(offer.paidCents).toBe("45000.0000000000");
    expect(offer.freeCreditCents).toBe("45000.0000000000");
    expect(offer.payments).toEqual([
      {
        paymentId: "6b091033-67fa-adb7-b3c5-f1336a3abc77",
        paidCents: "45000.0000000000",
        paidAt: "2026-11-27T05:08:03.000Z",
        freeCreditCents: "45000.0000000000",
      },
    ]);
  });

  it("reads an org with no offer as an empty list", () => {
    expect(parseSpecialOffers({ org_id: "x", special_offers: [] })).toEqual([]);
  });

  it("fails loud on a shape it does not know", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseSpecialOffers({ offers: [] })).toThrow(/invalid response shape/);
    err.mockRestore();
  });
});

describe("what the Billing page draws", () => {
  const offers = parseSpecialOffers(NOVEMIQ);

  it("an org with an offer: the list", () => {
    expect(specialOffersView({ data: offers, isError: false })).toEqual({ kind: "list", offers });
  });

  it("an org with none: nothing at all, page unchanged", () => {
    expect(specialOffersView({ data: [], isError: false })).toEqual({ kind: "hidden" });
    expect(specialOffersView({ data: undefined, isError: false })).toEqual({ kind: "hidden" });
  });

  it("a failed read: an error line, never $0", () => {
    expect(specialOffersView({ data: undefined, isError: true })).toEqual({ kind: "error" });
  });

  it("a failed refetch over data already read keeps the offers", () => {
    expect(specialOffersView({ data: offers, isError: true })).toEqual({ kind: "list", offers });
  });

  it("the page draws the section only off this view, and the error copy states no figure", () => {
    expect(page).toContain('useAuthQuery(["specialOffers"], () => getSpecialOffers())');
    expect(page).toContain('offersView.kind !== "hidden" && (');
    expect(page).toContain("<SpecialOffersList offers={offersView.offers} />");
    expect(page).toContain("We could not load your special offers right now.");
  });

  it("the cards print billing's totals, never a sum", () => {
    expect(list).toContain("formatBillingCents(offer.paidCents)");
    expect(list).toContain("formatBillingCents(offer.freeCreditCents)");
    expect(list).not.toMatch(/reduce\(/);
  });
});

describe("a special offer's credit is not free credit", () => {
  it("the grant under billing's special_offer code is recognised", () => {
    expect(isSpecialOfferGrant({ reason: "special_offer" })).toBe(true);
    expect(isSpecialOfferGrant({ reason: "welcome" })).toBe(false);
    expect(isSpecialOfferGrant({ reason: "referral_reward" })).toBe(false);
  });

  it("the Free credit section lists the gifts without it", () => {
    expect(page).toContain("c.grants.filter((grant) => !isSpecialOfferGrant(grant))");
    expect(page).toContain("{gifts.map((grant) => (");
    expect(page).not.toContain("{c.grants.map(");
  });
});
