import { describe, it, expect } from "vitest";
import { orP, projectFunnel, type FunnelEconomics } from "../src/lib/sales-funnel-projection";

// Economics matching SALES_ECON_DEFAULTS (ltv 4000, reply→meeting 40%, meeting→close 25%,
// visit→meeting 20%, click→close 5%), expressed as decimals.
const ECON: FunnelEconomics = { ltv: 4000, r2m: 0.4, v2m: 0.2, m2c: 0.25, v2c: 0.05 };

describe("orP", () => {
  it("combines independent probabilities: 1 − Π(1 − p)", () => {
    expect(orP(0.05, 0.05)).toBeCloseTo(1 - 0.95 * 0.95, 10);
    expect(orP(0.5)).toBe(0.5);
    expect(orP()).toBe(0); // empty → 0 (nothing closes)
    expect(orP(1, 0.3)).toBe(1); // a certain route saturates
  });
});

describe("projectFunnel — cost-per-close", () => {
  it("combines reply + click routes funded by one budget", () => {
    const pCloseClick = orP(0.05, 0.2 * 0.25); // v2c OR v2m·m2c = orP(0.05, 0.05)
    const pCloseReply = 0.4 * 0.25; // r2m·m2c = 0.1
    const closesPerBudget = (1 / 2) * pCloseClick + (1 / 5) * pCloseReply; // clickUsd 2, replyUsd 5
    const { costPerCloseUsd } = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, ECON, null);
    expect(costPerCloseUsd).toBeCloseTo(1 / closesPerBudget, 8);
  });

  it("a null-cost route contributes 0 (reply-only when clickUsd null)", () => {
    const { costPerCloseUsd } = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: null }, ECON, null);
    expect(costPerCloseUsd).toBeCloseTo(1 / ((1 / 5) * 0.4 * 0.25), 8);
  });

  it("no usable data (closesPerBudget ≤ 0) → null cost + null projection", () => {
    const zeroEcon: FunnelEconomics = { ltv: 4000, r2m: 0, v2m: 0, m2c: 0, v2c: 0 };
    const r = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, zeroEcon, 100);
    expect(r.costPerCloseUsd).toBeNull();
    expect(r.projection).toBeNull();
  });
});

describe("projectFunnel — funnel at a budget", () => {
  it("scales linearly: counts at $100 = 100 × counts at $1", () => {
    const at1 = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, ECON, 1).projection!;
    const at100 = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, ECON, 100).projection!;
    expect(at100.closes).toBeCloseTo(at1.closes * 100, 6);
    expect(at100.revenue).toBeCloseTo(at1.revenue * 100, 6);
    expect(at100.contactedLeads!).toBeCloseTo(at1.contactedLeads! * 100, 6);
  });

  it("cacPct and cacAbs are budget-invariant ratios", () => {
    const at1 = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, ECON, 1).projection!;
    const at500 = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, ECON, 500).projection!;
    expect(at500.cacPct!).toBeCloseTo(at1.cacPct!, 8);
    expect(at500.cacAbs!).toBeCloseTo(at1.cacAbs!, 8);
  });

  it("revenue = closes × ltv; cacPct = budget/revenue × 100", () => {
    const budget = 200;
    const { projection } = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, ECON, budget);
    expect(projection!.revenue).toBeCloseTo(projection!.closes * ECON.ltv, 6);
    expect(projection!.cacPct!).toBeCloseTo((budget / projection!.revenue) * 100, 8);
  });

  it("meetings sum both routes: replies×r2m + visits×v2m", () => {
    const budget = 100;
    const { projection } = projectFunnel({ contactedUsd: 0.5, replyUsd: 5, clickUsd: 2 }, ECON, budget);
    const replies = budget / 5;
    const visits = budget / 2;
    expect(projection!.meetings!).toBeCloseTo(replies * ECON.r2m + visits * ECON.v2m, 6);
  });
});
