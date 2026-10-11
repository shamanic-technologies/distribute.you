import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIRECT_PAYMENT_LABEL,
  directPaymentRows,
  isOffPlatformPayment,
  mergePayments,
  paidDayAsNoon,
  splitCreditGrants,
  type PaymentRowLike,
} from "../src/lib/off-platform-payments";

// Olive (org 308f528f-...) paid us $200 by bank transfer; staff recorded it as a
// grant marked paid off-platform. Shape = billing-service GET /v1/credits/grants.
const olivePayment = {
  id: "g-olive",
  orgId: "308f528f-03ad-44b1-9cbc-623a6af9ba0e",
  amountCents: "20000.0000",
  reason: "admin_grant",
  note: "Bank transfer",
  grantedBy: "kevin@distribute.you",
  createdAt: "2026-10-11T09:00:00.000Z",
  offPlatformPaidAt: "2026-09-28T00:00:00.000Z",
};
const welcomeGift = {
  id: "g-welcome",
  orgId: olivePayment.orgId,
  amountCents: "200",
  reason: "welcome",
  note: null,
  grantedBy: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  offPlatformPaidAt: null,
};
const legacyGift = { ...welcomeGift, id: "g-legacy", offPlatformPaidAt: undefined };

function card(id: string, createdAt: string, amountCents = 5000): PaymentRowLike {
  return {
    id,
    amountCents,
    currency: "usd",
    status: "succeeded",
    createdAt,
    description: null,
    amountReturnedCents: 0,
    declineMessage: null,
    declineCode: null,
  };
}

describe("off-platform payments are payments, not gifts", () => {
  it("flags only a grant carrying offPlatformPaidAt", () => {
    expect(isOffPlatformPayment(olivePayment)).toBe(true);
    expect(isOffPlatformPayment(welcomeGift)).toBe(false);
    expect(isOffPlatformPayment(legacyGift)).toBe(false);
  });

  it("removes Olive's $200 from the gifts and keeps the real gifts", () => {
    const { gifts, directPayments } = splitCreditGrants([olivePayment, welcomeGift, legacyGift]);
    expect(gifts.map((g) => g.id)).toEqual(["g-welcome", "g-legacy"]);
    expect(directPayments.map((g) => g.id)).toEqual(["g-olive"]);
  });

  it("maps Olive's grant to a $200 paid row dated on the day she paid", () => {
    expect(directPaymentRows([olivePayment, welcomeGift])).toEqual([
      {
        id: "grant:g-olive",
        amountCents: 20000,
        currency: "usd",
        status: "succeeded",
        createdAt: "2026-09-28T12:00:00.000Z",
        description: DIRECT_PAYMENT_LABEL,
        amountReturnedCents: 0,
        declineMessage: null,
        declineCode: null,
      },
    ]);
  });

  it("prints the paid day as noon UTC so no time zone shows the day before", () => {
    expect(paidDayAsNoon("2026-09-28")).toBe("2026-09-28T12:00:00.000Z");
    expect(paidDayAsNoon("2026-09-28T00:00:00.000Z")).toBe("2026-09-28T12:00:00.000Z");
    expect(paidDayAsNoon("2026-09-28T15:30:00.000Z")).toBe("2026-09-28T15:30:00.000Z");
  });

  it("merges direct payments into the card payments, newest first", () => {
    const merged = mergePayments(
      [card("pi_new", "2026-10-05T00:00:00.000Z"), card("pi_old", "2026-09-10T00:00:00.000Z")],
      [olivePayment, welcomeGift],
    );
    expect(merged.map((p) => p.id)).toEqual(["pi_new", "grant:g-olive", "pi_old"]);
  });

  it("never says agency in what the customer reads", () => {
    expect(DIRECT_PAYMENT_LABEL.toLowerCase()).not.toContain("agency");
  });
});

describe("Billing controller wiring", () => {
  const src = readFileSync(
    join(__dirname, "../src/components/billing/use-billing-controller.ts"),
    "utf-8",
  );
  it("lists gifts without direct payments and payments with them", () => {
    expect(src).toContain("splitCreditGrants(allGrants).gifts");
    expect(src).toMatch(/mergePayments\(\s*\(paymentsData\?\.payments \?\? \[\]\)\.filter/);
  });
  it("reads payment failures off the UNMERGED card list", () => {
    expect(src).toContain("latestPaymentFailure(paymentsData?.payments ?? [])");
  });
});
