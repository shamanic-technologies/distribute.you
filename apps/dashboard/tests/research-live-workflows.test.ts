import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { liveWorkflowRows, type LiveLadderRow } from "../src/lib/research/live-workflows";

function row(slug: string, o: Partial<LiveLadderRow> & { cost?: number | null; mature?: boolean | null } = {}): LiveLadderRow {
  return {
    audienceId: null,
    workflow: { workflowDynastySlug: slug, workflowDynastyName: slug.toUpperCase() },
    resolved: { costPerOutcomeUsd: o.cost ?? 1, roiMultiple: 2, conversionRatePct: 1, grain: "crossOrg" },
    estimatesByGrain: { crossOrg: { legOutcome: { outcomeCount: 3, spentUsd: 9 } } },
    maturity: { isMature: o.mature ?? null, resolved: { isMature: o.mature ?? null } },
    measured: true,
    rank: null,
    legAssignment: { state: "active", selectable: true },
    ...o,
  };
}

describe("liveWorkflowRows", () => {
  it("orders by the producer's rank, never by cost, unranked last", () => {
    const out = liveWorkflowRows([
      row("c", { rank: 3, cost: 1 }),
      row("x", { rank: null }),
      row("a", { rank: 1, cost: 5 }),
      row("b", { rank: 2, cost: 2 }),
    ]);
    expect(out.map((r) => r.slug)).toEqual(["a", "b", "c", "x"]);
  });

  it("keeps only the campaign-level rows and hides workflows never put on the leg", () => {
    const out = liveWorkflowRows([
      row("a", { rank: 1 }),
      row("a", { rank: 1, audienceId: "aud-1" }),
      row("u", { rank: 2, legAssignment: { state: "unassigned", selectable: false } }),
    ]);
    expect(out.map((r) => r.slug)).toEqual(["a"]);
  });

  it("marks the first pickable row and the first MATURE pickable row", () => {
    const out = liveWorkflowRows([
      row("dep", { rank: 1, mature: true, legAssignment: { state: "deprecated", selectable: false } }),
      row("learn", { rank: 2, mature: false }),
      row("mat", { rank: 3, mature: true }),
      row("mat2", { rank: 4, mature: true }),
    ]);
    expect(out.find((r) => r.first)?.slug).toBe("learn");
    expect(out.find((r) => r.cash)?.slug).toBe("mat");
    expect(out.filter((r) => r.cash)).toHaveLength(1);
  });

  it("reads outcomes and spend off the grain the row resolved at", () => {
    const [r] = liveWorkflowRows([
      row("a", {
        rank: 1,
        resolved: { costPerOutcomeUsd: 4, roiMultiple: 1.5, conversionRatePct: 2, grain: "brand" },
        estimatesByGrain: { crossOrg: { legOutcome: { outcomeCount: 99, spentUsd: 99 } }, brand: { legOutcome: { outcomeCount: 2, spentUsd: 8 } } },
      }),
    ]);
    expect(r.outcomes).toBe(2);
    expect(r.spentUsd).toBe(8);
    expect(r.roiMultiple).toBe(1.5);
  });

  it("states no cash row when nothing is mature", () => {
    const out = liveWorkflowRows([row("a", { rank: 1, mature: false })]);
    expect(out.some((r) => r.cash)).toBe(false);
  });
});

describe("research workflows page call site", () => {
  const catalog = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
  const live = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
  it("renders the live table for workflows and reads the producer ladder at the crew leg", () => {
    expect(catalog).toContain("<ResearchLiveWorkflows");
    expect(catalog).toContain('kind === "workflows" && liveLeg != null');
    expect(live).toContain("getWorkflowRankLadder({ featureSlug, brandId, leg: legKey, campaignId, actual })");
    expect(live).toContain(">ROI<");
    expect(live).not.toContain(">Emails<");
  });
});
