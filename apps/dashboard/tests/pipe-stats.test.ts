import { describe, expect, it } from "vitest";
import { mergeHistories, outcomeVolume, PipeWithStatsSchema, pipeStatsQuery, unavailableWords, type PipeStats } from "../src/lib/pipe-stats";

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
