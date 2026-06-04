import { describe, it, expect, vi, afterEach } from "vitest";
import {
  salesFunnel,
  personExpectedRevenueUsd,
  orgExpectedRevenue,
  totalPipelineUsd,
  cumulativeSeries,
  type SalesEconomics,
  type FunnelConfig,
  type OrgConversion,
} from "../src/lib/revenue";

// Clean numbers so EVs are exact:
//   visitDirect    = 10%        → P(visit) = max(0.10, 0.20×0.50=0.10) = 0.10
//   reply          = 40%×50%    → P(reply) = 0.20
//   LTR = 1000 → visit EV = 100, reply EV = 200
const ECON: SalesEconomics = {
  lifetimeRevenueUsd: 1000,
  visitToClosePct: 10,
  visitToMeetingPct: 20,
  meetingToClosePct: 50,
  replyToMeetingPct: 40,
};

const cfg: FunnelConfig = salesFunnel(ECON);

afterEach(() => vi.restoreAllMocks());

describe("salesFunnel — economics → channel probabilities", () => {
  it("visit = max(direct, via-meeting); reply = reply×close; carries LTR", () => {
    expect(cfg.lifetimeRevenueUsd).toBe(1000);
    expect(cfg.channelProbabilities.visit).toBeCloseTo(0.1, 10);
    expect(cfg.channelProbabilities.reply).toBeCloseTo(0.2, 10);
  });

  it("via-meeting path wins when larger than the direct close", () => {
    const c = salesFunnel({
      lifetimeRevenueUsd: 1000,
      visitToClosePct: 5, // direct 0.05
      visitToMeetingPct: 40,
      meetingToClosePct: 50, // via-meeting 0.40×0.50 = 0.20
      replyToMeetingPct: 0,
    });
    expect(c.channelProbabilities.visit).toBeCloseTo(0.2, 10);
  });
});

describe("personExpectedRevenueUsd — max across channels, never sum", () => {
  it("visit-only → LTR × P(visit)", () => {
    expect(
      personExpectedRevenueUsd({ personId: "p1", channels: ["visit"] }, cfg),
    ).toBeCloseTo(100, 6);
  });

  it("reply-only → LTR × P(reply)", () => {
    expect(
      personExpectedRevenueUsd({ personId: "p1", channels: ["reply"] }, cfg),
    ).toBeCloseTo(200, 6);
  });

  it("both channels → MAX (200), not the sum (300)", () => {
    expect(
      personExpectedRevenueUsd(
        { personId: "p1", channels: ["visit", "reply"] },
        cfg,
      ),
    ).toBeCloseTo(200, 6);
  });

  it("no channels → 0", () => {
    expect(
      personExpectedRevenueUsd({ personId: "p1", channels: [] }, cfg),
    ).toBe(0);
  });

  it("unknown channel → console.error + skip (no silent fallback)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ev = personExpectedRevenueUsd(
      { personId: "p1", channels: ["visit", "ghost"] },
      cfg,
    );
    expect(ev).toBeCloseTo(100, 6); // only the known "visit" channel counts
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("[revenue] unknown channel");
  });
});

describe("orgExpectedRevenue — dedup to one client per org", () => {
  it("two people: max EV, topPerson = argmax, tags = union", () => {
    const org = orgExpectedRevenue(
      "org1",
      [
        { personId: "a", channels: ["visit"], eventDate: "2026-01-01" },
        { personId: "b", channels: ["reply"], eventDate: "2026-03-01" },
      ],
      cfg,
    );
    expect(org.expectedRevenueUsd).toBeCloseTo(200, 6); // reply (b) wins
    expect(org.topPersonId).toBe("b");
    expect([...org.channels].sort()).toEqual(["reply", "visit"]);
  });

  it("date = most advanced across the org", () => {
    const org = orgExpectedRevenue(
      "org1",
      [
        { personId: "a", channels: ["visit"], eventDate: "2026-01-01" },
        { personId: "b", channels: ["reply"], eventDate: "2026-03-01" },
      ],
      cfg,
    );
    expect(org.mostAdvancedDate).toBe("2026-03-01");
  });

  it("two people both replying → MAX (200), not the sum (400)", () => {
    const org = orgExpectedRevenue(
      "org1",
      [
        { personId: "a", channels: ["reply"] },
        { personId: "b", channels: ["reply"] },
      ],
      cfg,
    );
    expect(org.expectedRevenueUsd).toBeCloseTo(200, 6);
  });
});

describe("totalPipelineUsd — sum across distinct orgs", () => {
  it("two distinct orgs add up (200 + 300 = 500)", () => {
    const orgs: OrgConversion[] = [
      { orgId: "o1", expectedRevenueUsd: 200, topPersonId: "a", mostAdvancedDate: "2026-01-01", channels: ["reply"] },
      { orgId: "o2", expectedRevenueUsd: 300, topPersonId: "b", mostAdvancedDate: "2026-02-01", channels: ["visit"] },
    ];
    expect(totalPipelineUsd(orgs)).toBe(500);
  });
});

describe("cumulativeSeries — running sum over time, undated surfaced", () => {
  it("sorts by date, accumulates, separates undated pipeline", () => {
    const orgs: OrgConversion[] = [
      { orgId: "o2", expectedRevenueUsd: 300, topPersonId: "b", mostAdvancedDate: "2026-03-01", channels: ["visit"] },
      { orgId: "o1", expectedRevenueUsd: 200, topPersonId: "a", mostAdvancedDate: "2026-01-01", channels: ["reply"] },
      { orgId: "o3", expectedRevenueUsd: 50, topPersonId: "c", mostAdvancedDate: null, channels: ["visit"] },
    ];
    const { points, undatedPipelineUsd } = cumulativeSeries(orgs);
    expect(points).toEqual([
      { date: "2026-01-01", cumulativePipelineUsd: 200 },
      { date: "2026-03-01", cumulativePipelineUsd: 500 },
    ]);
    expect(undatedPipelineUsd).toBe(50);
  });

  it("excludes zero-EV orgs from the series", () => {
    const orgs: OrgConversion[] = [
      { orgId: "o1", expectedRevenueUsd: 0, topPersonId: null, mostAdvancedDate: "2026-01-01", channels: [] },
    ];
    const { points, undatedPipelineUsd } = cumulativeSeries(orgs);
    expect(points).toEqual([]);
    expect(undatedPipelineUsd).toBe(0);
  });
});
