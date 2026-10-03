import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseFleetRevenueOutlook,
  centsToUsd,
  orderedRows,
  rowHasSomething,
  classReasonSentence,
  unknownReasonSentence,
  mrrReconciles,
  nextCashEvent,
  windowFor,
  type FleetRevenueRow,
} from "../src/lib/revenue-outlook";

function row(p: Partial<FleetRevenueRow>): FleetRevenueRow {
  return {
    orgId: "org",
    paymentMode: "postpaid",
    revenueClass: "none",
    classReason: "postpaid_no_chargeable_card",
    chargeableCard: false,
    autoTopupEnabled: false,
    balanceCents: "0",
    proactiveDailyBudgetCents: "0",
    proactiveDailyBudgetUnknownReason: null,
    drrCents: "0",
    mrrCents: "0",
    arrCents: "0",
    oneOff: null,
    projections: [],
    cashState: "idle",
    cashBlockedReason: null,
    cashEvents: [],
    ...p,
  };
}

function outlook(orgs: FleetRevenueRow[], mrrCents = "0") {
  return parseFleetRevenueOutlook({
    asOf: "2026-09-29T16:00:00.000Z",
    cashHorizonDays: 90,
    accountCount: orgs.length,
    classCounts: { recurring: 0, one_off: 0, none: orgs.length },
    totals: {
      drrCents: "0",
      mrrCents,
      arrCents: "0",
      drrUnknownOrgIds: [],
      oneOffRemainingCents: "0",
      windows: [
        {
          horizonDays: 30,
          projectedRevenueCents: "100",
          recurringCents: "100",
          oneOffCents: "0",
          unknownOrgIds: [],
          cashCents: "50",
          cashEventCount: 1,
          unknownAmountCashEventCount: 0,
        },
      ],
    },
    cashFlow: { byDay: [], byWeek: [] },
    orgs,
    unreadableOrgs: [],
  });
}

describe("revenue outlook (billing fleet read)", () => {
  it("keeps null as unmeasured, never zero", () => {
    expect(centsToUsd(null)).toBeNull();
    expect(centsToUsd("12345.0000000000")).toBeCloseTo(123.45);
    expect(() => centsToUsd("")).toThrow();
    expect(() => centsToUsd("abc")).toThrow();
  });

  it("refuses a body that is not billing's shape", () => {
    expect(() => parseFleetRevenueOutlook({ orgs: [] })).toThrow();
  });

  it("reads an unknown class vocabulary without throwing", () => {
    const o = outlook([row({ revenueClass: "something_new", classReason: "brand_new_reason" })]);
    expect(o.orgs[0].revenueClass).toBe("something_new");
    expect(classReasonSentence("brand_new_reason")).toBe("brand_new_reason");
  });

  it("reads billing's idle and retries-exhausted reasons as sentences", () => {
    expect(classReasonSentence("postpaid_idle")).toBe("Postpaid, card on file, nothing spending");
    expect(classReasonSentence("prepaid_auto_topup_idle")).toBe("Prepaid, auto top-up on, nothing spending");
    expect(classReasonSentence("postpaid_charge_retries_exhausted")).toBe("Postpaid, card refused: retries exhausted");
    expect(classReasonSentence("postpaid_chargeable_card")).toBe("Postpaid, card on file");
  });

  it("lists recurring by MRR, then one-off by what is left, then the rest", () => {
    const o = outlook([
      row({ orgId: "none-cash", cashEvents: [{ at: "2026-09-30T23:00:00Z", expectedAmountCents: "10800" }] }),
      row({ orgId: "small", revenueClass: "recurring", mrrCents: "3000" }),
      row({
        orgId: "oneoff",
        revenueClass: "one_off",
        classReason: "prepaid_no_auto_topup",
        oneOff: { remainingCents: "2500", dailyPaceCents: "500", runOutAt: "2026-10-04T00:00:00Z", runOutUnknownReason: null },
      }),
      row({ orgId: "big", revenueClass: "recurring", mrrCents: "90000" }),
      row({ orgId: "idle" }),
    ]);
    expect(orderedRows(o).map((r) => r.orgId)).toEqual(["big", "small", "oneoff", "none-cash"]);
  });

  it("hides only an org with nothing in play, and keeps one whose figure is unknown", () => {
    expect(rowHasSomething(row({}))).toBe(false);
    expect(rowHasSomething(row({ drrCents: null }))).toBe(true);
    expect(unknownReasonSentence("campaign_recurrence_unknown")).toMatch(/could not be read/);
    expect(unknownReasonSentence(null)).toBe("not measured");
  });

  it("checks that the served MRR is the sum of the served rows", () => {
    const rows = [row({ mrrCents: "3000.0000000000" }), row({ mrrCents: "90000.0000000000" }), row({ mrrCents: null })];
    expect(mrrReconciles(outlook(rows, "93000.0000000000"))).toBe(true);
    expect(mrrReconciles(outlook(rows, "99000.0000000000"))).toBe(false);
  });

  it("names the next cash event and the window by horizon", () => {
    const r = row({
      cashEvents: [
        { at: "2026-10-31T23:00:00Z", expectedAmountCents: null },
        { at: "2026-09-30T23:00:00Z", expectedAmountCents: "10800" },
      ],
    });
    expect(nextCashEvent(r)?.at).toBe("2026-09-30T23:00:00Z");
    const o = outlook([r]);
    expect(windowFor(o, 30)?.cashCents).toBe("50");
    expect(windowFor(o, 90)).toBeNull();
  });
});

describe("revenue page wiring", () => {
  const view = readFileSync(join(__dirname, "../src/components/revenue-view.tsx"), "utf8");
  const band = readFileSync(join(__dirname, "../src/components/revenue/revenue-outlook-band.tsx"), "utf8");

  it("mounts the outlook band on the Revenue tab, above cash collected", () => {
    expect(view).toContain("<RevenueOutlookBand");
    expect(view.indexOf("<RevenueOutlookBand")).toBeLessThan(view.indexOf('title="Cash collected"'));
  });

  it("no longer claims every customer is prepaid", () => {
    expect(view).not.toContain("credit that is bought and not yet spent");
  });

  it("renders billing's served totals, never a sum of its own", () => {
    expect(band).not.toMatch(/\.reduce\(/);
    expect(band).toContain("const t = data?.totals");
    expect(band).toContain("centsToUsd(t.mrrCents)");
  });

  it("carries no em-dash in its copy", () => {
    expect(band).not.toContain("—");
  });
});
