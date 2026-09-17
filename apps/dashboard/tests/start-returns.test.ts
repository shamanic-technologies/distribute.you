import { describe, it, expect } from "vitest";
import {
  returnRowsForFunnel,
  funnelHasMeasuredReturn,
  returnReasonLabel,
  type PairReturn,
  type ChannelReturn,
} from "../src/lib/start-returns";

const FUNNEL = "sales_meetings_from_conversation";

const pair = (over: Partial<PairReturn> & { channelSlug: string }): PairReturn => ({
  channelName: over.channelSlug,
  funnelKey: FUNNEL,
  funnelName: "Sales Meeting from Conversation",
  measured: false,
  reason: "not_enough_brands",
  brandCount: 1,
  medianReturnPerDollar: null,
  p25ReturnPerDollar: null,
  p75ReturnPerDollar: null,
  medianCostPerPaidClientUsd: null,
  ...over,
});

// The one pair production measures today, verbatim.
const COLD_EMAIL_PAIR = pair({
  channelSlug: "sales-cold-email-outreach",
  channelName: "Sales Cold Email Outreach",
  measured: true,
  reason: null,
  brandCount: 3,
  medianReturnPerDollar: 3.0623311996257154,
  p25ReturnPerDollar: 2.355638947515077,
  p75ReturnPerDollar: 3.3326067527351952,
  medianCostPerPaidClientUsd: 1516.1193548387098,
});

const COLD_EMAIL_CHANNEL: ChannelReturn = {
  featureSlug: "sales-cold-email-outreach",
  measured: true,
  reason: null,
  brandCount: 10,
  medianReturnPerDollar: 5.218199321867098,
  p25ReturnPerDollar: 2.0022928214597577,
  p75ReturnPerDollar: 15.797478985309729,
};

const GOOGLE_CHANNEL: ChannelReturn = {
  featureSlug: "google-ads",
  measured: false,
  reason: "no_snapshot_yet",
  brandCount: 0,
  medianReturnPerDollar: null,
  p25ReturnPerDollar: null,
  p75ReturnPerDollar: null,
};

describe("returnRowsForFunnel", () => {
  it("states the PAIR figure when the producer measured the pair", () => {
    const [row] = returnRowsForFunnel(
      FUNNEL,
      ["sales-cold-email-outreach"],
      [COLD_EMAIL_PAIR],
      [COLD_EMAIL_CHANNEL],
    );
    expect(row.scope).toBe("pair");
    expect(row.median).toBeCloseTo(3.06, 2);
    expect(row.brandCount).toBe(3);
    expect(row.costPerPaidClientUsd).toBeCloseTo(1516.12, 2);
  });

  it("falls back to the CHANNEL figure, and says so, when only that is measured", () => {
    const unmeasuredPair = pair({ channelSlug: "sales-cold-email-outreach", channelName: "Sales Cold Email Outreach" });
    const [row] = returnRowsForFunnel(
      FUNNEL,
      ["sales-cold-email-outreach"],
      [unmeasuredPair],
      [COLD_EMAIL_CHANNEL],
    );
    expect(row.scope).toBe("channel");
    expect(row.median).toBeCloseTo(5.22, 2);
    // The wider population is what makes the fallback worth having.
    expect(row.brandCount).toBe(10);
  });

  it("never lends a channel-scoped row the pair's cost per paid client", () => {
    const unmeasuredPair = pair({
      channelSlug: "sales-cold-email-outreach",
      medianCostPerPaidClientUsd: 1516.12,
    });
    const [row] = returnRowsForFunnel(
      FUNNEL,
      ["sales-cold-email-outreach"],
      [unmeasuredPair],
      [COLD_EMAIL_CHANNEL],
    );
    expect(row.scope).toBe("channel");
    expect(row.costPerPaidClientUsd).toBeNull();
  });

  it("states the producer's own reason when neither scope is measured, and no figure", () => {
    const [row] = returnRowsForFunnel(FUNNEL, ["google-ads"], [pair({ channelSlug: "google-ads" })], [GOOGLE_CHANNEL]);
    expect(row.scope).toBeNull();
    expect(row.median).toBeNull();
    expect(row.p25).toBeNull();
    // The pair's reason wins: it is the scope the visitor asked about.
    expect(row.reason).toBe("not_enough_brands");
  });

  it("drops a channel the producer does not list for this funnel at all", () => {
    // Listing it would state something about a pair that is not sold.
    expect(returnRowsForFunnel(FUNNEL, ["meta-lead-ads"], [COLD_EMAIL_PAIR], [])).toEqual([]);
  });

  it("leads with the measured rows, strongest first, and never ranks the unmeasured", () => {
    const weaker = pair({
      channelSlug: "weaker",
      measured: true,
      reason: null,
      brandCount: 4,
      medianReturnPerDollar: 1.2,
    });
    const a = pair({ channelSlug: "unmeasured-a" });
    const b = pair({ channelSlug: "unmeasured-b" });
    const rows = returnRowsForFunnel(
      FUNNEL,
      ["unmeasured-a", "weaker", "unmeasured-b", "sales-cold-email-outreach"],
      [a, weaker, b, COLD_EMAIL_PAIR],
      [],
    );
    expect(rows.map((r) => r.channelSlug)).toEqual([
      "sales-cold-email-outreach",
      "weaker",
      "unmeasured-a",
      "unmeasured-b",
    ]);
  });

  it("knows when a funnel has nothing measured at all", () => {
    const none = returnRowsForFunnel(FUNNEL, ["google-ads"], [pair({ channelSlug: "google-ads" })], [GOOGLE_CHANNEL]);
    expect(funnelHasMeasuredReturn(none)).toBe(false);
    expect(
      funnelHasMeasuredReturn(
        returnRowsForFunnel(FUNNEL, ["sales-cold-email-outreach"], [COLD_EMAIL_PAIR], []),
      ),
    ).toBe(true);
  });
});

describe("returnReasonLabel", () => {
  it("words the reasons the producer states today", () => {
    expect(returnReasonLabel("not_enough_brands")).toMatch(/clients/i);
    expect(returnReasonLabel("no_snapshot_yet")).toMatch(/not measured/i);
    expect(returnReasonLabel(null)).toMatch(/not measured/i);
  });

  it("renders an unknown reason VERBATIM rather than guessing at its cause", () => {
    expect(returnReasonLabel("some_future_reason")).toBe("some_future_reason");
  });
});
