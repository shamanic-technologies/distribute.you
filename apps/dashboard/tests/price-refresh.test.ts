import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BasisSummarySchema, RealCostsSchema } from "../src/lib/monitoring/monitoring";
import { daysBehind, plainError, refreshProblems, refreshState, refreshWords, vendorName } from "../src/lib/monitoring/price-refresh";

/**
 * PRICE-REFRESH-RED-1107: costs-service's daily price refresh failed every day from 2026-10-16 to 2026-11-07 (one
 * Twilio error blocked every vendor), Postmark stayed frozen at 1.19¢ an email, and Monitoring showed it AMBER
 * "Not refreshed today" for three weeks. costs-service now skips a broken vendor and serves `vendorFailures`; a
 * vendor failure, a failed refresh or a series more than one day old is RED on Monitoring (owner: red only when
 * broken, never an email).
 */

const TWILIO = { provider: "twilio", input: "usage-records", error: "Twilio account inactive" };
const fresh = { stale: false, asOf: "2026-11-07", lastRefresh: { status: "succeeded", error: null } };

describe("price refresh verdict", () => {
  it("a series refreshed today is fresh, no problem", () => {
    expect(refreshState(fresh, "2026-11-07")).toBe("fresh");
    expect(refreshProblems(fresh, "Real costs", "2026-11-07")).toEqual([]);
    expect(refreshWords(fresh, "2026-11-07").words).toBe("Refreshed today");
  });

  it("not refreshed YET today (one day behind) is due, normal colours, never red", () => {
    const s = { stale: true, asOf: "2026-11-06", lastRefresh: { status: "succeeded", error: null } };
    expect(refreshState(s, "2026-11-07")).toBe("due");
    expect(refreshWords(s, "2026-11-07").words).toBe("Not refreshed today");
    expect(refreshProblems(s, "Real costs", "2026-11-07")).toEqual([]);
  });

  it("a never-run refresh (no lastRefresh) on a fresh series is not red", () => {
    expect(refreshState({ stale: false, asOf: "2026-11-07", lastRefresh: null }, "2026-11-07")).toBe("fresh");
  });

  it("more than one day behind is broken: the prod freeze of 2026-10-16 reads red on 2026-11-07", () => {
    const s = { stale: true, asOf: "2026-10-16", lastRefresh: { status: "succeeded", error: null } };
    expect(daysBehind("2026-10-16", "2026-11-07")).toBe(22);
    expect(refreshState(s, "2026-11-07")).toBe("broken");
    expect(refreshWords(s, "2026-11-07").words).toBe("Not refreshed for 22 days");
    expect(refreshProblems(s, "Real costs", "2026-11-07").map((p) => p.text)).toEqual(["Real costs not refreshed for 22 days, last prices of Oct 16"]);
  });

  it("each served vendor failure is its own red line, vendors listed first", () => {
    const s = { stale: true, asOf: "2026-10-16", vendorFailures: [TWILIO, { provider: "openai", input: "x", error: "HTTP 500" }], lastRefresh: null };
    const lines = refreshProblems(s, "Real costs", "2026-11-07").map((p) => p.text);
    expect(lines[0]).toBe("Twilio prices not refreshed: Twilio account inactive");
    expect(lines[1]).toBe("OpenAI prices not refreshed: HTTP 500");
    expect(lines[2]).toMatch(/^Real costs not refreshed for 22 days/);
  });

  it("a vendor failure on a series refreshed today is still red (the others refreshed, this one did not)", () => {
    const s = { ...fresh, vendorFailures: [TWILIO] };
    expect(refreshState(s, "2026-11-07")).toBe("broken");
    expect(refreshWords(s, "2026-11-07").words).toBe("Refresh broken");
  });

  it("reads the last refresh's own vendorFailures when the top level is absent", () => {
    const s = { stale: false, asOf: "2026-11-07", lastRefresh: { status: "succeeded", error: null, vendorFailures: [TWILIO] } };
    expect(refreshProblems(s, "Real costs", "2026-11-07")).toHaveLength(1);
  });

  it("a failed refresh with no vendor list is red with the served error", () => {
    const s = { stale: true, asOf: "2026-11-06", lastRefresh: { status: "failed", error: "boom" } };
    expect(refreshProblems(s, "Email sending price", "2026-11-07").map((p) => p.text)).toEqual(["Email sending price not refreshed: boom"]);
  });

  it("the prod Twilio error reads as the vendor's own message", () => {
    const served = 'Twilio refused /2010-04-01/Accounts/<account>.json: HTTP 401 {"code":20003,"message":"authentication failed, account AC0 with status 4 is not active","status":401}';
    expect(plainError(served)).toBe("authentication failed, account AC0 with status 4 is not active");
    expect(plainError("HTTP 500")).toBe("HTTP 500");
    expect(plainError("bad {not json")).toBe("bad {not json");
  });

  it("names vendors", () => {
    expect(vendorName("twilio")).toBe("Twilio");
    expect(vendorName("deepseek")).toBe("DeepSeek");
  });
});

describe("served shape (costs-service NEWSLETTER-COST-1107)", () => {
  const base = { formula: "f", rules: { since: "2026-01-01", proposedMultiplier: 2, passThroughMultiplier: 1, x1Rule: "x", payAsYouGoVendors: [], catalogueVendorCostProviders: {} }, day: "2026-10-16", asOf: "2026-10-16", refreshedAt: "2026-10-16T01:48:29.649Z", stale: true, items: [] };
  const row = { provider: "twilio", ledgerVendors: [], paidUsdCents: 0, refundedUsdCents: 0, netPaidUsdCents: 0, vendorCostRecordedUsdCents: 0, ratio: null, numeratorBasis: "split-unavailable", splitError: "Twilio account inactive", meteredUsdCents: null, vendorCostRecordedAtListUsdCents: 0, internalCostUsdCents: 0, internalCostBasis: "x", split: null };
  it("real-costs keeps vendorFailures, lastRefresh.vendorFailures and splitError", () => {
    const d = RealCostsSchema.parse({ ...base, vendorFailures: [TWILIO], lastRefresh: { status: "succeeded", asOf: "2026-11-07", startedAt: "a", finishedAt: "b", error: null, vendorFailures: [TWILIO] }, payAsYouGo: [row] });
    expect(d.vendorFailures).toEqual([TWILIO]);
    expect(d.lastRefresh?.vendorFailures).toEqual([TWILIO]);
    expect(d.payAsYouGo[0].splitError).toBe("Twilio account inactive");
  });
  it("basis-summary keeps vendorFailures", () => {
    const d = BasisSummarySchema.parse({ day: "2026-10-16", asOf: "2026-10-16", stale: true, vendorFailures: [TWILIO], rule: "r", bases: [], totals: { amount1UsdCents: 0, amount2UsdCents: 0, differenceUsdCents: 0, differencePct: null, realCostUsdCents: 0, margin1UsdCents: 0, margin1Pct: null, margin2UsdCents: 0, margin2Pct: null, billedUsdCents: 0, netBilledUsdCents: 0, billedPlatformKeyUsdCents: 0, netBilledPlatformKeyUsdCents: 0 }, unpricedCostNames2: [], realCostUnknownCostNames: [], internalCost: { byVendor: [], totalUsdCents: 0 } });
    expect(d.vendorFailures).toEqual([TWILIO]);
  });
});

describe("wiring", () => {
  const read = (f: string) => readFileSync(join(__dirname, "../src/components/v2", f), "utf8");
  it("every pricing page shows its problems first and no longer says amber 'Not refreshed today' on its own", () => {
    for (const f of ["monitoring-new-pricing.tsx", "monitoring-pricing-basis.tsx", "monitoring-pricing-comparison.tsx", "monitoring-email-price.tsx", "monitoring-subscriptions.tsx"]) {
      const src = read(f);
      expect(src, f).toContain("<SeriesRefreshProblems s=");
      expect(src, f).not.toContain('"Not refreshed today"');
    }
  });
  it("the hub carries the red tile above the collapsible rows", () => {
    const src = read("monitoring-page.tsx");
    expect(src).toContain('<PriceRefreshTile href={href("price/new-pricing")} />');
    expect(src.indexOf("<PriceRefreshTile")).toBeLessThan(src.indexOf("<HubOpen.Provider"));
  });
});
