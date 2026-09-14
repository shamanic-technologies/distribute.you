import { describe, expect, it } from "vitest";
import {
  brandLabel,
  breakdownReconciles,
  exclusionReason,
  fundedRows,
  unfundedCount,
  type SelfServeBreakdown,
  type SelfServeBrandRow,
} from "../src/lib/self-serve-breakdown";

function row(over: Partial<SelfServeBrandRow> = {}): SelfServeBrandRow {
  return {
    orgId: "org-1",
    brandId: "brand-1",
    brandName: "Acme",
    brandDomain: "acme.com",
    configuredDailyBudgetUsd: 10,
    paymentActive: true,
    campaignRunning: true,
    audienceAvailable: true,
    amountInForce: true,
    countedMrrUsd: 300,
    excludedBy: null,
    basis: "recorded",
    ...over,
  };
}

function breakdown(rows: SelfServeBrandRow[], countedMrrUsd?: number): SelfServeBreakdown {
  return {
    referenceDate: "2026-09-14",
    countedMrrUsd: countedMrrUsd ?? rows.reduce((s, r) => s + r.countedMrrUsd, 0),
    configuredMrrUsd: rows.reduce((s, r) => s + (r.configuredDailyBudgetUsd ?? 0) * 30, 0),
    rows,
  };
}

describe("fundedRows", () => {
  it("keeps only the brands with a budget in force", () => {
    const b = breakdown([
      row({ brandId: "funded", configuredDailyBudgetUsd: 5, countedMrrUsd: 150 }),
      row({ brandId: "none", configuredDailyBudgetUsd: null, countedMrrUsd: 0 }),
      row({ brandId: "zero", configuredDailyBudgetUsd: 0, countedMrrUsd: 0 }),
    ]);
    expect(fundedRows(b).map((r) => r.brandId)).toEqual(["funded"]);
  });

  it("leads with the customers who ARE the run-rate, largest first", () => {
    const b = breakdown([
      row({ brandId: "small-counted", configuredDailyBudgetUsd: 5, countedMrrUsd: 150 }),
      row({ brandId: "excluded", configuredDailyBudgetUsd: 10, countedMrrUsd: 0, excludedBy: "payment_stopped" }),
      row({ brandId: "big-counted", configuredDailyBudgetUsd: 49, countedMrrUsd: 1470 }),
    ]);
    expect(fundedRows(b).map((r) => r.brandId)).toEqual(["big-counted", "small-counted", "excluded"]);
  });

  it("orders the excluded rows by what they would have been worth", () => {
    const b = breakdown([
      row({ brandId: "cheap", configuredDailyBudgetUsd: 1, countedMrrUsd: 0, excludedBy: "campaign_not_running" }),
      row({ brandId: "dear", configuredDailyBudgetUsd: 10, countedMrrUsd: 0, excludedBy: "campaign_not_running" }),
    ]);
    expect(fundedRows(b).map((r) => r.brandId)).toEqual(["dear", "cheap"]);
  });

  it("breaks a tie on the name, so the order does not shuffle between polls", () => {
    const b = breakdown([
      row({ brandId: "z", brandName: "Zulu", configuredDailyBudgetUsd: 1, countedMrrUsd: 0, excludedBy: "x" }),
      row({ brandId: "a", brandName: "Alpha", configuredDailyBudgetUsd: 1, countedMrrUsd: 0, excludedBy: "x" }),
    ]);
    expect(fundedRows(b).map((r) => r.brandId)).toEqual(["a", "z"]);
  });

  it("does not mutate the served array", () => {
    const rows = [
      row({ brandId: "second", configuredDailyBudgetUsd: 1, countedMrrUsd: 0, excludedBy: "x" }),
      row({ brandId: "first", configuredDailyBudgetUsd: 49, countedMrrUsd: 1470 }),
    ];
    fundedRows(breakdown(rows));
    expect(rows.map((r) => r.brandId)).toEqual(["second", "first"]);
  });
});

describe("exclusionReason", () => {
  it("has a sentence for every token the producer serves today", () => {
    const tokens = [
      "campaign_not_running",
      "payment_stopped",
      "no_recent_activity",
      "no_recorded_amount",
      "audience_exhausted",
    ];
    for (const t of tokens) {
      const reason = exclusionReason(row({ excludedBy: t }));
      expect(reason, t).toBeTruthy();
      expect(reason, t).not.toBe(t); // a raw token is not a sentence
    }
  });

  it("renders an UNKNOWN token verbatim rather than blank — the producer owns this vocabulary", () => {
    expect(exclusionReason(row({ excludedBy: "some_future_reason" }))).toBe("some_future_reason");
  });

  it("gives a counted row no reason at all", () => {
    expect(exclusionReason(row({ excludedBy: null }))).toBeNull();
  });
});

describe("brandLabel", () => {
  it("prefers the name", () => {
    expect(brandLabel(row({ brandName: "Acme", brandDomain: "acme.com" }))).toBe("Acme");
  });

  it("falls back to the domain, then to the id — never blank", () => {
    expect(brandLabel(row({ brandName: null, brandDomain: "acme.com" }))).toBe("acme.com");
    expect(brandLabel(row({ brandName: "  ", brandDomain: null, brandId: "b-9" }))).toBe("b-9");
  });
});

describe("unfundedCount", () => {
  it("counts the brands carrying no budget, so the table can say what it did not draw", () => {
    const b = breakdown([
      row({ configuredDailyBudgetUsd: 5 }),
      row({ configuredDailyBudgetUsd: null, countedMrrUsd: 0 }),
      row({ configuredDailyBudgetUsd: 0, countedMrrUsd: 0 }),
    ]);
    expect(unfundedCount(b)).toBe(2);
  });
});

describe("breakdownReconciles", () => {
  it("is true when the rows add up to the total served beside them", () => {
    const b = breakdown([
      row({ configuredDailyBudgetUsd: 49, countedMrrUsd: 1470 }),
      row({ configuredDailyBudgetUsd: 5, countedMrrUsd: 150 }),
      row({ configuredDailyBudgetUsd: 10, countedMrrUsd: 0, excludedBy: "payment_stopped" }),
    ]);
    expect(b.countedMrrUsd).toBe(1620);
    expect(breakdownReconciles(b)).toBe(true);
  });

  it("is false when they disagree — the rows are wrong, not the total", () => {
    const rows = [row({ configuredDailyBudgetUsd: 49, countedMrrUsd: 1470 })];
    expect(breakdownReconciles(breakdown(rows, 1620))).toBe(false);
  });

  it("counts the UNFUNDED rows too, so money on a row the table hides is still caught", () => {
    const b = breakdown(
      [
        row({ configuredDailyBudgetUsd: 49, countedMrrUsd: 1470 }),
        row({ configuredDailyBudgetUsd: null, countedMrrUsd: 150 }),
      ],
      1470
    );
    expect(breakdownReconciles(b)).toBe(false);
  });

  it("tolerates floating-point noise rather than reading it as drift", () => {
    const b = breakdown(
      [row({ countedMrrUsd: 0.1 }), row({ countedMrrUsd: 0.2 })],
      0.3
    );
    expect(breakdownReconciles(b)).toBe(true);
  });
});
