import { describe, expect, it } from "vitest";
import { CampaignTargetsSchema, nextExpectedWords, reasonWords, targetsOfOffer } from "../src/lib/campaign-targets";

const row = (offerId: string, id: string) => ({
  salesFunnelCampaignId: id,
  name: "Outbound",
  offerId,
  target: { key: "paid_client", label: "Paid client", lifecycleRung: "paid_client" },
  outcomesToDate: 7,
  outcomesUnavailableReason: null,
  spentUsd: 2884,
  costPerOutcomeUsd: 412,
  costPerOutcomeUnavailableReason: null,
  measuredReturn: { roiMultiple: 3, valueUsd: 8652, spentUsd: 2884, unavailableReason: null },
  past: [{ date: "2026-11-05", outcomes: 1, cumulativeOutcomes: 7 }],
  pastUnavailableReason: null,
  projection: {
    planComputedAt: "2026-11-06T14:05:00Z",
    planFunnelId: "f1",
    costPerTargetUsd: 400,
    costPerTargetBasis: "expected",
    spendPerDayUsd: 200,
    spendPerDaySource: "daily_budget",
    outcomesPerDay: 0.5,
    daily: [{ date: "2026-11-07", expectedOutcomes: 0.5, cumulativeExpectedOutcomes: 7.5 }],
    nextExpectedAt: "2026-11-08T14:05:00Z",
    nextExpectedInHours: 48,
    unavailableReason: null,
  },
});

describe("campaign targets (LEAD-GENERIC-1106)", () => {
  it("parses the served body and keeps the selected offer's rows in served order", () => {
    const body = CampaignTargetsSchema.parse({ brandId: "b", pricing: "net", costBasis: "charged", computedAt: "x", targets: [row("o1", "a"), row("o2", "b"), row("o1", "c")] });
    expect(targetsOfOffer(body.targets, "o1").map((r) => r.salesFunnelCampaignId)).toEqual(["a", "c"]);
    expect(targetsOfOffer(body.targets, null)).toHaveLength(3);
  });
  it("says when the next one is expected, from the served hours", () => {
    expect(nextExpectedWords(48)).toBe("Next one expected in about 2 days.");
    expect(nextExpectedWords(5)).toBe("Next one expected in about 5 hours.");
    expect(nextExpectedWords(0.4)).toBe("Next one expected within the hour.");
    expect(nextExpectedWords(null)).toBeNull();
  });
  it("reads a served reason as words", () => {
    expect(reasonWords("target_has_no_value")).toBe("No value set for this outcome");
    expect(reasonWords("some_new_reason")).toBe("Some new reason");
    expect(reasonWords("pipe_unpriced:threads-post|start_to_post_published")).toBe("Not priced yet");
  });
});
