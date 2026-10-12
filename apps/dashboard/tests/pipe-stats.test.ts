import { describe, expect, it } from "vitest";
import { endToEndRate, teamOnOurLeadsRate, teamReasonWords, formatRatePct, mergeHistories, outcomeVolume, PipeWithStatsSchema, pipeStatsQuery, unavailableWords, type PipeStats } from "../src/lib/pipe-stats";

const stats = (kind: "fleet" | "brand" | "offer", history: PipeStats["history"]): PipeStats =>
  PipeWithStatsSchema.parse({
    id: "ai-meeting-booking|conversation_to_meeting_booked",
    stats: {
      scope: { kind, brandId: null, offerId: null },
      kind: "internal",
      costBasis: "net_charged",
      campaignCount: 3,
      firstActivityDay: "2026-09-01",
      volumes: [
        { key: "handed", label: "Positive reply received", role: "input", datedBy: "x", total: 40, undated: 0 },
        { key: "actedOn", label: "Acted on", role: "action", datedBy: "x", total: 30, undated: 0 },
        { key: "outcomes", label: "Meeting booked", role: "outcome", datedBy: "x", total: 6, undated: 0 },
      ],
      spendUsd: 12,
      costPerOutcomeUsd: 2,
      costPerOutcomeUnavailableReason: null,
      valuePerOutcomeUsd: 50,
      roi: 25,
      roiUnavailableReason: null,
      history,
    },
  }).stats;

describe("pipe stats reader", () => {
  it("parses the served stats block and keeps the producer's labels", () => {
    const s = stats("fleet", []);
    expect(s.volumes.map((v) => v.label)).toEqual(["Positive reply received", "Acted on", "Meeting booked"]);
    expect(outcomeVolume(s)?.total).toBe(6);
  });

  it("sends a scope only when the page holds its ids (an offer needs its brand)", () => {
    expect(pipeStatsQuery("fleet", null, null)).toEqual({ stats: "true" });
    expect(pipeStatsQuery("brand", "b1", null)).toEqual({ stats: "true", brandId: "b1" });
    expect(pipeStatsQuery("offer", "b1", null)).toBeNull();
    expect(pipeStatsQuery("offer", null, "o1")).toBeNull();
    expect(pipeStatsQuery("offer", "b1", "o1")).toEqual({ stats: "true", brandId: "b1", offerId: "o1" });
  });

  it("merges scopes by day and leaves a missing point absent, never 0", () => {
    const p = (date: string, cpo: number | null) => ({ date, spendUsd: 1, volumes: { outcomes: 1 }, costPerOutcomeUsd: cpo, roi: null });
    const rows = mergeHistories(
      { fleet: stats("fleet", [p("2026-09-02", 3), p("2026-09-01", 4)]), brand: stats("brand", [p("2026-09-02", 5), p("2026-09-03", null)]) },
      (x) => x.costPerOutcomeUsd,
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(rows[0]).toMatchObject({ fleet: 4 });
    expect("brand" in rows[0]).toBe(false);
    expect(rows[1]).toMatchObject({ fleet: 3, brand: 5 });
  });

  it("says a missing figure's reason in words", () => {
    expect(unavailableWords("no_outcomes_yet")).toBe("No outcomes yet");
    expect(unavailableWords(null)).toBe("Learning");
  });
});

describe("pipe conversion rates", () => {
  it("parses the served rates and prints percents", () => {
    const s = PipeWithStatsSchema.parse({
      stats: {
        scope: { kind: "fleet" },
        volumes: [],
        spendUsd: 1,
        costPerOutcomeUsd: null,
        roi: null,
        conversionRates: [
          { key: "handed_to_actedOn", fromKey: "handed", toKey: "actedOn", label: "Positive reply received → Acted on", numerator: 10, denominator: 16, ratePct: 62.5, unavailableReason: null },
        ],
        history: [{ date: "2026-10-12", spendUsd: 1, volumes: {}, costPerOutcomeUsd: null, roi: null, conversionRates: { handed_to_actedOn: 62.5 } }],
      },
    }).stats;
    expect(s.conversionRates?.[0].ratePct).toBe(62.5);
    expect(formatRatePct(62.5)).toBe("62.5%");
    expect(formatRatePct(20)).toBe("20%");
    expect(formatRatePct(0.01)).toBe("<0.1%");
    expect(formatRatePct(0)).toBe("0%");
  });
});

describe("same step, other pipes", () => {
  it("reads a customer team pipe whose tools do not record the step as a reason, never 0", () => {
    const s = PipeWithStatsSchema.parse({
      stats: {
        scope: { kind: "brand" },
        volumes: [
          { key: "reachedFrom", label: "Positive reply (their team)", role: "input", total: null },
          { key: "outcomes", label: "Meeting booked (their team)", role: "outcome", total: null },
        ],
        spendUsd: 0,
        costPerOutcomeUsd: null,
        roi: null,
        conversionRates: [{ key: "reachedFrom_to_outcomes", fromKey: "reachedFrom", toKey: "outcomes", label: "x", numerator: null, denominator: null, ratePct: null, unavailableReason: "volume_not_measured" }],
        teamSource: { available: false, unavailableReason: "from_step_not_recorded", fromSources: [], toSources: [] },
        history: [],
      },
    }).stats;
    expect(endToEndRate(s)?.key).toBe("reachedFrom_to_outcomes");
    expect(teamReasonWords(s.teamSource?.unavailableReason)).toBe("Their tools do not record the first step");
    expect(teamReasonWords("brand_new_reason")).toBe("Brand new reason");
  });

  it("picks our pipe's first-volume-to-outcome rate", () => {
    const s = stats("fleet", []);
    const withRates = { ...s, conversionRates: [
      { key: "handed_to_actedOn", fromKey: "handed", toKey: "actedOn", label: "a", numerator: 10, denominator: 16, ratePct: 62.5 },
      { key: "handed_to_outcomes", fromKey: "handed", toKey: "outcomes", label: "b", numerator: 2, denominator: 16, ratePct: 12.5 },
    ] };
    expect(endToEndRate(withRates)?.ratePct).toBe(12.5);
  });
});

describe("client team on the replies we brought", () => {
  it("reads the served rate, and nothing when unavailable", () => {
    const base = stats("brand", []);
    const rate = { key: "leftToTeam_to_outcomes", fromKey: "leftToTeam", toKey: "outcomes", label: "x", numerator: 4, denominator: 24, ratePct: 16.67 };
    expect(teamOnOurLeadsRate({ ...base, ourLeadsToTeam: { available: true, conversionRates: [rate] } })?.ratePct).toBe(16.67);
    expect(teamOnOurLeadsRate({ ...base, ourLeadsToTeam: { available: false, unavailableReason: "to_step_not_recorded_for_our_leads" } })).toBeNull();
    expect(teamOnOurLeadsRate(base)).toBeNull();
  });
});
