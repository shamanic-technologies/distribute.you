import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  FunnelCampaignSpendChartsSchema,
  actionKeysOf,
  convergenceRows,
  dayInWords,
  firstMaturingDay,
  formatPerActionUsd,
  latestSpendDay,
  supportSpendUsd,
  type SpendChartPoint,
} from "../src/lib/spend-charts";

const point = (date: string, over: Partial<SpendChartPoint> = {}): SpendChartPoint => ({
  date,
  spendUsd: 0,
  costPerOutcomeUsd: null,
  cohortMature: true,
  conversionRatePct: null,
  learning: true,
  byAction: [],
  ...over,
});

describe("convergenceRows (SPEND-CHARTS-1019)", () => {
  const daily = [
    point("2026-10-01", { costPerOutcomeUsd: 40, learning: true }),
    point("2026-10-02", { costPerOutcomeUsd: 20, learning: true }),
    point("2026-10-03", { costPerOutcomeUsd: 12, learning: false }),
    point("2026-10-04", { costPerOutcomeUsd: 10, learning: false }),
  ];

  it("draws Learning days grey and mature days in colour, the two lines touching where the flag flips", () => {
    const rows = convergenceRows(daily, (p) => p.costPerOutcomeUsd, null);
    expect(rows.map((r) => r.learning)).toEqual([40, 20, null, null]);
    expect(rows.map((r) => r.mature)).toEqual([null, 20, 12, 10]);
  });

  it("adds a dotted tail from the last served point to the served expected value, past the last day", () => {
    const rows = convergenceRows(daily, (p) => p.costPerOutcomeUsd, 8);
    expect(rows).toHaveLength(5);
    expect(rows[3].expected).toBe(10);
    expect(rows[4].expected).toBe(8);
    expect(rows[4].t).toBeGreaterThan(rows[3].t);
    expect(rows.slice(0, 3).every((r) => r.expected === null)).toBe(true);
  });

  it("never invents a value: a null served point stays null on both lines", () => {
    const rows = convergenceRows([point("2026-10-01"), point("2026-10-02", { costPerOutcomeUsd: 5 })], (p) => p.costPerOutcomeUsd, null);
    expect(rows[0].learning).toBeNull();
    expect(rows[0].mature).toBeNull();
  });

  it("marks the days whose cohort is still maturing", () => {
    const d = [point("2026-10-01"), point("2026-10-02", { cohortMature: false })];
    expect(convergenceRows(d, (p) => p.conversionRatePct, null).map((r) => r.maturing)).toEqual([false, true]);
    expect(firstMaturingDay(d)).toBe("2026-10-02");
  });
});

describe("a day's spend in words, channel-agnostic", () => {
  const day = point("2026-10-05", {
    spendUsd: 2.5,
    byAction: [
      { key: "prospects_found", label: "New prospects found", step: "lead_found", unit: "prospect", spendUsd: 0.72, actions: 12, costPerActionUsd: 0.06 },
      { key: "follow_ups", label: "Follow-ups", step: "contacted", unit: "follow-up", spendUsd: 1.2, actions: 30, costPerActionUsd: 0.04 },
      { key: "messages_written", label: "Writing the messages", step: null, unit: null, spendUsd: 0.58, actions: null, costPerActionUsd: null },
    ],
  });

  it("names counts and the served cost per action in the producer's units", () => {
    const w = dayInWords(day);
    expect(w.counts).toBe("12 prospects, 30 follow-ups");
    expect(w.prices).toBe("$0.06 per prospect · $0.04 per follow-up");
    expect(w.other).toBe("Writing the messages");
  });

  it("never prints $0.00 for a sub-cent action", () => {
    expect(formatPerActionUsd(0.004)).toBe("$0.004");
    expect(formatPerActionUsd(0.04)).toBe("$0.04");
  });

  it("picks the latest day that spent, and stacks actions in a fixed order", () => {
    expect(latestSpendDay([day, point("2026-10-06")])?.date).toBe("2026-10-05");
    expect(actionKeysOf([day]).map((k) => k.key)).toEqual(["prospects_found", "follow_ups", "messages_written"]);
  });
});

describe("wire shape", () => {
  it("parses a producer body with string numerics and pipes", () => {
    const chart = {
      leg: { channelSlug: "sales-cold-email", legKey: "start-positive_reply", fromStep: null, toStep: "positive_reply", maturityDays: 7, learningOutcomesRequired: 5 },
      outcomeStep: "positive_reply",
      outcomeUnavailableReason: null,
      conversionUnavailableReason: null,
      daily: [{ ...point("2026-10-01"), spendUsd: "1.5", costPerOutcomeUsd: null, byActionGapUsd: 0 }],
      spendByActionUnavailableReason: null,
      totals: { spendUsd: 1.5, outcomes: 0, costPerOutcomeUsd: null, entered: 10, converted: 0, conversionRatePct: 0, learning: true },
      expected: { costPerOutcomeUsd: 30, conversionRatePct: 1.2, roiMultiple: 2 },
    };
    const parsed = FunnelCampaignSpendChartsSchema.safeParse({
      salesFunnelCampaignId: "a",
      brandId: "b",
      offerId: "c",
      pricing: "net",
      costBasis: "charged",
      campaign: chart,
      pipes: [{ ...chart, campaignId: "p", pipeId: "x", featureSlug: "sales-cold-email", legKey: "start-positive_reply", status: "ongoing" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.campaign.daily[0].spendUsd).toBe(1.5);
  });
});

describe("the block is drawn at the three grains", () => {
  const src = (f: string) => fs.readFileSync(path.join(__dirname, "../src/components/v2", f), "utf-8");
  it("Today draws the brand's one offer's block (no brand-grain chart yet)", () => {
    expect(src("today-page.tsx")).toContain("<OfferSpendChartsSection brandId={brandId} offerId={scope.soleOfferId} billed={{ pending: win.pending, spend: winSpend }} />");
  });
  it("the campaign page draws the campaign's block (the per-pipe blocks are gone: FACTORY-USER-DASHBOARD-1102)", () => {
    const s = src("funnel-campaigns.tsx");
    expect(s).toContain("spendChartState(spendQ, (d) => d.campaign)");
    expect(s).not.toContain("spendChart={(campaignId) =>");
  });
  it("divides nothing in the browser", () => {
    const s = src("spend-charts.tsx");
    expect(s).not.toMatch(/\.spendUsd\s*\/|\/\s*\w+\.outcomes|reduce\(/);
  });
});

describe("support spend (2026-11-11: tooltip rows summed $4.98 under a $5.70 day)", () => {
  // Served by features-service for brand f25037e6 (offer 8c9985d7), 2026-11-11, pricing=net.
  const prod = point("2026-11-11", {
    spendUsd: 5.703623266279999,
    byActionGapUsd: 0.72,
    byAction: [
      { key: "prospects_found", label: "Prospects found", spendUsd: 4.771709999999999, actions: 130, unit: "prospect", costPerActionUsd: 0.0367 },
      { key: "messages_written", label: "Messages written", spendUsd: 0.18924788, actions: null },
      { key: "replies_read", label: "Replies read", spendUsd: 0.022833972, actions: null },
      { key: "notifications", label: "Notifications", spendUsd: 0, actions: null },
      { key: "other", label: "Other", spendUsd: 0, actions: null },
    ],
  });

  it("lists the served gap as Support, so the rows add up to the day's total", () => {
    const support = supportSpendUsd(prod);
    expect(support).toBe(0.72);
    const rows = prod.byAction.map((a) => a.spendUsd).concat(support!);
    expect(Math.round(rows.reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(prod.spendUsd * 100));
  });

  it("stacks Support last in the bar, only when a day has some", () => {
    expect(actionKeysOf([prod]).map((k) => k.key).at(-1)).toBe("support");
    expect(actionKeysOf([point("2026-11-10", { byActionGapUsd: 0 })]).map((k) => k.key)).not.toContain("support");
    expect(supportSpendUsd(point("2026-11-10", { byActionGapUsd: null }))).toBeNull();
  });

  it("prints the Support row in the day tooltip", () => {
    const s = fs.readFileSync(path.join(__dirname, "../src/components/v2/spend-charts.tsx"), "utf-8");
    const tip = s.slice(s.indexOf("function DayTip("), s.indexOf("function unavailableWords("));
    expect(tip).toContain("supportSpendUsd(point)");
    expect(tip).toContain("{SUPPORT_LABEL}");
  });
  it("never draws the cost chart over an empty series (a new campaign with no spend day crashed its page)", () => {
    const s = fs.readFileSync(path.join(__dirname, "../src/components/v2/spend-charts.tsx"), "utf-8");
    expect(s).toContain("!chart || chart.daily.length === 0 || (chart.daily.every((p) => p.costPerOutcomeUsd == null)");
    const conv = s.slice(s.indexOf("function ConvergenceChart("));
    expect(conv).not.toContain("daily[daily.length - 1].date");
    expect(conv).toContain("bandFrom != null && lastDayT != null");
  });
});
