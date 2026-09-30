import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  fleetWorkflowRows,
  missionWorkflowRows,
  type FleetRankingRow,
  type MissionLadderRow,
} from "../src/lib/live-workflow-rows";

function fleet(slug: string, o: Partial<FleetRankingRow> = {}): FleetRankingRow {
  return {
    rank: 1,
    workflowDynastySlug: slug,
    workflowDynastyName: slug.toUpperCase(),
    assignment: "active",
    selectable: true,
    isMature: true,
    costPerOutcomeUsd: 10,
    conversionRatePct: 1,
    outcomes: 3,
    spentUsd: 30,
    roiMultiple: 2,
    goesFirst: false,
    moneyGoesHere: false,
    ...o,
  };
}

describe("fleetWorkflowRows", () => {
  it("keeps the producer's order and flags verbatim, never re-ranking on cost", () => {
    const out = fleetWorkflowRows([
      fleet("nobelium", { rank: 2, costPerOutcomeUsd: 45, moneyGoesHere: true }),
      fleet("raven", { rank: 1, costPerOutcomeUsd: 14, isMature: false, goesFirst: true }),
      fleet("azalea", { rank: 3, costPerOutcomeUsd: 52 }),
    ]);
    expect(out.map((r) => r.slug)).toEqual(["raven", "nobelium", "azalea"]);
    expect(out.find((r) => r.first)?.slug).toBe("raven");
    expect(out.find((r) => r.cash)?.slug).toBe("nobelium");
  });

  it("a workflow with no spend on the leg states no result yet", () => {
    const [r] = fleetWorkflowRows([fleet("a", { spentUsd: 0, outcomes: 0, costPerOutcomeUsd: null })]);
    expect(r.ran).toBe(false);
  });
});

function ladder(slug: string, o: Partial<MissionLadderRow> = {}): MissionLadderRow {
  return {
    audienceId: null,
    workflow: { workflowDynastySlug: slug, workflowDynastyName: slug.toUpperCase() },
    estimatesByGrain: {},
    rank: null,
    legAssignment: { state: "active", selectable: true },
    ...o,
  };
}

const half = (spent: number, contacted: number, outcomes: number) => ({
  spentUsd: spent,
  contacted,
  outcomes,
  costPerOutcomeUsd: outcomes > 0 ? spent / outcomes : null,
  conversionRatePct: contacted > 0 ? (100 * outcomes) / contacted : null,
});

describe("missionWorkflowRows", () => {
  it("reads the mission's CAMPAIGN grain, never a coarser one, on the half its verdict names", () => {
    const [mature, learning, never] = missionWorkflowRows({
      ladderRows: [
        ladder("a", {
          rank: 1,
          maturity: { isMature: true },
          estimatesByGrain: {
            crossOrg: { isMature: true, flash: half(999, 999, 99), mature: half(999, 999, 99) },
            campaign: { isMature: true, flash: half(40, 400, 4), mature: half(20, 200, 2) },
          },
        }),
        ladder("b", { rank: 2, maturity: { isMature: false }, estimatesByGrain: { campaign: { isMature: false, flash: half(6, 10, 0), mature: null } } }),
        ladder("c", { rank: 3, maturity: { isMature: true }, estimatesByGrain: { crossOrg: { isMature: true, flash: half(1, 1, 1), mature: half(1, 1, 1) } } }),
      ],
      roiBySlug: new Map([["a", 3]]),
      lastPickedSlug: null,
    });
    expect(mature).toMatchObject({ slug: "a", mature: true, costPerOutcomeUsd: 10, outcomes: 2, spentUsd: 20, roiMultiple: 3, ran: true });
    // Zero outcomes states no price, never the spend as a floor.
    expect(learning).toMatchObject({ slug: "b", mature: false, costPerOutcomeUsd: null, outcomes: 0, spentUsd: 6 });
    // Never run by this mission: no figures, but the workflow's own verdict is still stated.
    expect(never).toMatchObject({ slug: "c", ran: false, costPerOutcomeUsd: null, mature: true });
  });

  it("goes first = the producer's first selectable rank; money = the workflow the runs last picked", () => {
    const out = missionWorkflowRows({
      ladderRows: [
        ladder("dep", { rank: 1, legAssignment: { state: "deprecated", selectable: false } }),
        ladder("x", { rank: 2 }),
        ladder("y", { rank: 3 }),
      ],
      roiBySlug: new Map(),
      lastPickedSlug: "y",
    });
    expect(out.find((r) => r.first)?.slug).toBe("x");
    expect(out.find((r) => r.cash)?.slug).toBe("y");
  });

  it("drops audience rows; no pick = no money row", () => {
    const out = missionWorkflowRows({
      ladderRows: [ladder("a", { rank: 1 }), ladder("a", { rank: 1, audienceId: "aud-1" })],
      roiBySlug: new Map(),
      lastPickedSlug: null,
    });
    expect(out.map((r) => r.slug)).toEqual(["a"]);
    expect(out.some((r) => r.cash)).toBe(false);
  });

  // Prod 2026-09-30 (brand 933d4abb, Pilot mission): the runs pick Rhodium, which the owner has
  // not assigned on the meeting leg. It must keep its row and its money chip.
  it("keeps an unassigned workflow the mission's runs picked, with its money chip", () => {
    const out = missionWorkflowRows({
      ladderRows: [ladder("rhodium", { rank: 1, legAssignment: { state: "unassigned", selectable: false } })],
      roiBySlug: new Map(),
      lastPickedSlug: "rhodium",
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ slug: "rhodium", cash: true, first: false });
  });
});

describe("research reads nothing scoped to the viewer", () => {
  const dir = join(__dirname, "../src/components/v2");
  const files = readdirSync(dir).filter((f) => f.startsWith("research-") && f.endsWith(".tsx"));
  it("no research component reads a brand-, offer-, campaign- or audience-scoped source", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const banned of ["getWorkflowRankLadder", "useBrandMissionSpecs", "useMissions", "campaignId", "listAudiences", "getBrandOffer"]) {
        expect(src, `${f} must not read ${banned}`).not.toContain(banned);
      }
    }
  });

  it("the live table reads the fleet ranking at the crew's leg", () => {
    const live = readFileSync(join(dir, "research-live-workflows.tsx"), "utf8");
    expect(live).toContain("getLegWorkflowRanking(featureSlug, legKey)");
    expect(live).toContain('["legWorkflowRanking", featureSlug, legKey]');
    expect(live).not.toContain("useParams");
  });
});

describe("the brand Workflows page states the mission's own live figures", () => {
  it("a learning Offer/Brand cell states what the grain spent, beside the Learning chip", () => {
    const cost = page.slice(page.indexOf("function CostCell("));
    expect(cost).toContain("spent,");
    expect(cost).toContain("figure.spentUsd");
  });

  const page = readFileSync(join(__dirname, "../src/components/v2/workflows-page.tsx"), "utf8");
  it("draws the strip, the chips and the live columns off the mission's rows", () => {
    expect(page).toContain("<LiveRankingStrip rows={live}");
    expect(page).toContain("<LiveWorkflowChips row={liveRow} />");
    expect(page).toContain("<LiveWorkflowHeads");
    expect(page).toContain("<LiveWorkflowCells row={liveRow} />");
    expect(page).toContain("r.ladder?.observedPicks?.last?.workflowDynastySlug");
    expect(page).toContain("colSpan={14}");
  });
});
