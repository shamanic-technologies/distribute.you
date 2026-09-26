import { describe, expect, it } from "vitest";
import {
  legId,
  legRatePatch,
  formatRatePct,
  parseRateInput,
  rateSourceLabel,
} from "../src/lib/brand-conversion-rates";
import type { EffectiveLegRate } from "../src/lib/api";

const stated = { fromStep: "Positive reply", toStep: "Meeting booked", ratePct: 30, stated: true };
const unstated = { fromStep: "Meeting booked", toStep: "Meeting attended", ratePct: null, stated: false };

describe("parseRateInput", () => {
  it("reads a blank field as a clear, a number as a rate, and refuses the rest", () => {
    expect(parseRateInput("  ")).toBeNull();
    expect(parseRateInput("12,5")).toBe(12.5);
    expect(parseRateInput("40")).toBe(40);
    expect(parseRateInput("abc")).toBeUndefined();
    expect(parseRateInput("120")).toBeUndefined();
    expect(parseRateInput("-1")).toBeUndefined();
  });
});

describe("legRatePatch", () => {
  it("sends only the legs whose value moved", () => {
    const { patch, invalid } = legRatePatch([stated, unstated], {
      [legId(stated)]: "30",
      [legId(unstated)]: "80",
    });
    expect(invalid).toEqual([]);
    expect(patch).toEqual([{ fromStep: "Meeting booked", toStep: "Meeting attended", ratePct: 80 }]);
  });

  it("clears a stated leg the form emptied, and never clears an unstated one", () => {
    const { patch } = legRatePatch([stated, unstated], {
      [legId(stated)]: "",
      [legId(unstated)]: "",
    });
    expect(patch).toEqual([{ fromStep: "Positive reply", toStep: "Meeting booked", ratePct: null }]);
  });

  it("omits a leg the form never touched", () => {
    expect(legRatePatch([stated, unstated], {}).patch).toEqual([]);
  });

  it("reports a value that is not a rate instead of dropping it", () => {
    const { patch, invalid } = legRatePatch([stated], { [legId(stated)]: "lots" });
    expect(patch).toEqual([]);
    expect(invalid).toEqual([legId(stated)]);
  });
});

describe("formatRatePct", () => {
  it("states at most one decimal and no trailing zero", () => {
    expect(formatRatePct(30)).toBe("30%");
    expect(formatRatePct(8.3222)).toBe("8.3%");
    expect(formatRatePct(0)).toBe("0%");
  });
});

/** A measured leg as features-service serves it (prod shape, Doc Dinners 2026-09-26). */
function measuredLeg(measured: Partial<EffectiveLegRate["measured"]>): EffectiveLegRate {
  return {
    fromStep: "Meeting booked",
    toStep: "Meeting attended",
    effectiveRatePct: 17.1,
    source: "measured",
    unresolvedReason: null,
    measured: { fromReached: 251, toReached: 43, ratePct: 17.1, sufficient: true, gap: null, ...measured },
    manualRatePct: null,
    median: { ratePct: 67.5, brandCount: 6 },
  };
}

describe("rateSourceLabel", () => {
  it("names the client's CRM when the leg was measured there", () => {
    expect(rateSourceLabel(measuredLeg({ basis: "crm", outcomesCounted: null }))).toBe(
      "Measured on 251 contacts in your CRM",
    );
  });

  it("names our leads, and that only our outcomes count, when measured on our leads", () => {
    expect(
      rateSourceLabel(measuredLeg({ fromReached: 26, basis: "our_leads", outcomesCounted: "caused_by_our_outreach" })),
    ).toBe("Measured on 26 of our leads");
  });

  it("reads exactly as before when the producer states no basis", () => {
    expect(rateSourceLabel(measuredLeg({ fromReached: 14 }))).toBe("Measured on 14 leads");
  });
});
