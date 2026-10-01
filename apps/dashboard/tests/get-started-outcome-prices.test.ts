import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { outcomePriceLine, parseOutcomePrices } from "../src/lib/v2/get-started";

// The production body of GET /v1/public/outcome-prices, 2026-10-01 (trimmed to what we read).
const PROD = {
  grain: "fleet",
  costBasis: "incurred",
  computedAt: "2026-10-01T04:23:21.162Z",
  outcomes: {
    websiteVisit: { maturity: "mature", priceUsd: 2.4908219928656923, unmeasuredReason: null, legs: [] },
    meetingBooked: {
      maturity: "early",
      priceUsd: 117.47362499999998,
      unmeasuredReason: null,
      legs: [],
      arithmetic: { replyCostUsd: 46.447266, meetingRatePct: 40, repliesCostPerMeetingUsd: 116.118165, meetingLegCostUsd: 1.35546 },
    },
  },
};

describe("outcome prices (features-service, read verbatim)", () => {
  it("reads one price per outcome off the producer's body", () => {
    const p = parseOutcomePrices(PROD);
    expect(p.visits).toEqual({ priceUsd: 2.4908219928656923, early: false });
    expect(p.meetings).toEqual({ priceUsd: 117.47362499999998, early: true });
  });

  it("states cents under $10 and whole dollars above", () => {
    const p = parseOutcomePrices(PROD);
    expect(outcomePriceLine(p.visits, "visit")).toBe("About $2.49 per visit");
    expect(outcomePriceLine(p.meetings, "meeting")).toBe("About $117 per meeting");
  });

  it("states no price when the producer could not measure one, never a zero", () => {
    const body = { outcomes: { websiteVisit: { priceUsd: null, maturity: null }, meetingBooked: { priceUsd: 0, maturity: null } } };
    const p = parseOutcomePrices(body);
    expect(outcomePriceLine(p.visits, "visit")).toBeNull();
    expect(outcomePriceLine(p.meetings, "meeting")).toBeNull();
    expect(outcomePriceLine(null, "visit")).toBeNull();
  });

  it("throws on a body it cannot read", () => {
    expect(() => parseOutcomePrices({})).toThrow();
    expect(() => parseOutcomePrices({ outcomes: { websiteVisit: { priceUsd: "2" }, meetingBooked: { priceUsd: 1 } } })).toThrow();
  });

  it("the page reads the signed-out route and passes the prices to the outcome step", () => {
    const page = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    expect(page).toContain('fetch("/api/public/outcome-prices")');
    const call = page.slice(page.indexOf("<OutcomeStage"), page.indexOf("/>", page.indexOf("<OutcomeStage")));
    expect(call).toContain("prices={outcomePrices}");
    expect(page).toContain("outcomePriceLine(prices?.[o.key], o.unit)");
  });

  it("the route proxies the gateway's public path and computes nothing", () => {
    const route = readFileSync(join(__dirname, "../src/app/api/public/outcome-prices/route.ts"), "utf8");
    expect(route).toContain("/v1/public/outcome-prices");
    expect(route).toContain("status: 502");
    expect(route).not.toContain("priceUsd");
  });
});
