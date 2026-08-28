import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REPLY_SETTLING_DAYS,
  channelSettlesLate,
  learningProgress,
  learningProgressIfDoubled,
  learningThresholdUsd,
  settlingDaysElapsed,
} from "../src/lib/learning-progress";

const src = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

describe("learningProgress", () => {
  it("prices the tank at ten outcomes", () => {
    const p = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 0,
      dailyBudgetUsd: 50,
      settlingDays: 0,
    });
    expect(p?.thresholdUsd).toBe(720);
  });

  it("states the days the remaining spend takes at today's rate", () => {
    const p = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 310,
      dailyBudgetUsd: 50,
      settlingDays: 0,
    });
    // 720 - 310 = 410 left, at 50/day => 9 days.
    expect(p?.spendDaysLeft).toBe(9);
    expect(p?.daysLeft).toBe(9);
  });

  it("adds the settling window on a channel whose replies land late", () => {
    const p = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 310,
      dailyBudgetUsd: 50,
      settlingDays: REPLY_SETTLING_DAYS,
    });
    expect(p?.settlingDaysLeft).toBe(14);
    expect(p?.daysLeft).toBe(23);
  });

  it("counts the whole settling window as ahead while the spend is still going", () => {
    // Elapsed days cannot have started running before the spend is in, so a caller that
    // passes one anyway must not shorten the promise.
    const p = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 100,
      dailyBudgetUsd: 50,
      settlingDays: REPLY_SETTLING_DAYS,
      settlingDaysElapsed: 9,
    });
    expect(p?.settlingDaysLeft).toBe(14);
  });

  it("leaves only the settling days once the spend has passed the threshold", () => {
    const p = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 900,
      dailyBudgetUsd: 50,
      settlingDays: REPLY_SETTLING_DAYS,
      settlingDaysElapsed: 6,
    });
    expect(p?.spendDaysLeft).toBe(0);
    expect(p?.settlingDaysLeft).toBe(8);
    expect(p?.daysLeft).toBe(8);
  });

  it("reads an unknown elapsed settling as the whole window still ahead", () => {
    const p = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 900,
      dailyBudgetUsd: 50,
      settlingDays: REPLY_SETTLING_DAYS,
      settlingDaysElapsed: null,
    });
    expect(p?.settlingDaysLeft).toBe(14);
  });

  it("keeps the bar between 0 and 100", () => {
    const fresh = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 0,
      dailyBudgetUsd: 50,
      settlingDays: REPLY_SETTLING_DAYS,
    });
    expect(fresh?.pct).toBe(0);
    const done = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 5000,
      dailyBudgetUsd: 50,
      settlingDays: 0,
    });
    expect(done?.pct).toBe(100);
  });

  it("states nothing when the outcome has no expected price", () => {
    expect(
      learningProgress({
        outcomeUnitCostUsd: null,
        spentUsd: 310,
        dailyBudgetUsd: 50,
        settlingDays: 0,
      }),
    ).toBeNull();
  });

  it("states nothing when nothing is funding it", () => {
    expect(
      learningProgress({
        outcomeUnitCostUsd: 72,
        spentUsd: 310,
        dailyBudgetUsd: 0,
        settlingDays: 0,
      }),
    ).toBeNull();
    expect(
      learningProgress({
        outcomeUnitCostUsd: 72,
        spentUsd: 310,
        dailyBudgetUsd: null,
        settlingDays: 0,
      }),
    ).toBeNull();
  });

  it("reads an absent spend as nothing spent, never as a negative tank", () => {
    const p = learningProgress({
      outcomeUnitCostUsd: 10,
      spentUsd: null,
      dailyBudgetUsd: 20,
      settlingDays: 0,
    });
    expect(p?.spentUsd).toBe(0);
    expect(p?.spendDaysLeft).toBe(5);
  });
});

describe("learningProgressIfDoubled", () => {
  it("halves the spending half and leaves the replies alone", () => {
    const p = learningProgress({
      outcomeUnitCostUsd: 72,
      spentUsd: 310,
      dailyBudgetUsd: 50,
      settlingDays: REPLY_SETTLING_DAYS,
    })!;
    // 9 spending days become 5; the 14 settling days do not move.
    expect(learningProgressIfDoubled(p)).toBe(19);
  });

  it("offers nothing when doubling buys no day back", () => {
    const oneDay = learningProgress({
      outcomeUnitCostUsd: 10,
      spentUsd: 60,
      dailyBudgetUsd: 50,
      settlingDays: 0,
    })!;
    expect(oneDay.spendDaysLeft).toBe(1);
    expect(learningProgressIfDoubled(oneDay)).toBeNull();

    const full = learningProgress({
      outcomeUnitCostUsd: 10,
      spentUsd: 500,
      dailyBudgetUsd: 50,
      settlingDays: REPLY_SETTLING_DAYS,
    })!;
    expect(learningProgressIfDoubled(full)).toBeNull();
  });
});

describe("settlingDaysElapsed", () => {
  const daily = [
    { date: "2026-08-01", cumulativeSpendUsd: 100 },
    { date: "2026-08-10", cumulativeSpendUsd: 720 },
    { date: "2026-08-20", cumulativeSpendUsd: 1200 },
  ];

  it("dates the settling window from the day spend first passed the threshold", () => {
    expect(settlingDaysElapsed(daily, 720, new Date("2026-08-16T09:00:00Z"))).toBe(6);
  });

  it("says nothing while the threshold is still ahead", () => {
    expect(settlingDaysElapsed(daily, 5000, new Date("2026-08-16T09:00:00Z"))).toBeNull();
  });

  it("says nothing when there is no curve to read", () => {
    expect(settlingDaysElapsed([], 720, new Date("2026-08-16T09:00:00Z"))).toBeNull();
    expect(settlingDaysElapsed(null, 720, new Date("2026-08-16T09:00:00Z"))).toBeNull();
    expect(settlingDaysElapsed(daily, null, new Date("2026-08-16T09:00:00Z"))).toBeNull();
  });
});

describe("learningThresholdUsd", () => {
  it("is ten outcomes at the expected price", () => {
    expect(learningThresholdUsd(72)).toBe(720);
    expect(learningThresholdUsd(null)).toBeNull();
    expect(learningThresholdUsd(0)).toBeNull();
  });
});

describe("channelSettlesLate", () => {
  it("names the email channels and nothing else", () => {
    expect(channelSettlesLate("sales-cold-email-outreach")).toBe(true);
    expect(channelSettlesLate("feedback-request-cold-email-outreach")).toBe(true);
    expect(channelSettlesLate("sales-crm-email-outreach")).toBe(true);
    expect(channelSettlesLate("google-ads")).toBe(false);
    expect(channelSettlesLate(null)).toBe(false);
  });
});

describe("the band is mounted where campaigns are read", () => {
  it("rides the campaign Overview", () => {
    const page = src("components/campaigns/campaign-overview-page.tsx");
    expect(page).toContain("<LearningProgressCallout");
  });

  it("is hidden while the campaign is paused", () => {
    // A countdown of days left is priced on a daily spend that is not happening, so on
    // a stopped campaign it states a date nobody can stand behind. The GATE on which
    // figures are withheld is untouched — restarting restores the band as it was.
    const page = src("components/campaigns/campaign-overview-page.tsx");
    expect(page).toContain(
      "const showLearningProgress = revenueRevealed && !campaignPaused && isLearning(learningSignal);",
    );
    expect(page).toContain(
      "const campaignPaused = campaign != null && !isRunningStatus(campaign.status);",
    );
  });

  it("rides the Campaigns list", () => {
    const page = src("components/campaigns/campaigns-page.tsx");
    expect(page).toContain("<LearningProgressCallout");
  });

  it("is hidden once the listed scope has been measured", () => {
    // The scope's figures clear the moment ONE of its campaigns is measured, so a band
    // counting days beside a priced return promises a figure that is already stated.
    // Prod: 18 sales interests on cold email beside a stopped feedback-request
    // campaign at 0, and the band counted for the second.
    const page = src("components/campaigns/campaigns-page.tsx");
    const at = page.indexOf("const learningLead = useMemo(");
    expect(at).toBeGreaterThan(-1);
    const body = page.slice(at, at + 520);
    expect(body).toContain("if (!scopedLearning) return null;");
  });

  it("never counts days for a paused campaign", () => {
    // A countdown is priced on a daily spend that is not happening.
    const page = src("components/campaigns/campaigns-page.tsx");
    const at = page.indexOf("const learningLead = useMemo(");
    const body = page.slice(at, at + 520);
    expect(body).toContain("isRunningStatus(row.campaign.status)");
  });

  it("speaks for the rows the table shows, not the offer's other funnels", () => {
    // Under a funnel the list is a subset of the offer's campaigns; a lead picked from
    // the rest counts days for a campaign this page never lists.
    const page = src("components/campaigns/campaigns-page.tsx");
    const at = page.indexOf("const learningLead = useMemo(");
    const body = page.slice(at, at + 520);
    expect(body).toContain("scopedRows.filter(");
    expect(body).not.toContain("rows.filter((row) => row.learning)");
  });

  it("computes nothing of its own, the figures come from the lib", () => {
    const band = src("components/campaigns/learning-progress-callout.tsx");
    expect(band).toContain("learningProgressIfDoubled");
    expect(band).not.toContain("LEARNING_MIN_OUTCOMES *");
  });

  it("ships no em-dash in anything a customer reads", () => {
    // Comments are exempt fleet-wide; the copy is not. Asserted against a
    // comment-stripped copy so an explanatory line cannot fail its own guard.
    const band = src("components/campaigns/learning-progress-callout.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(band).not.toContain("\u2014");
  });
});
