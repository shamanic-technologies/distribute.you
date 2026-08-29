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
  it("is ONE band on every campaign surface — brand, offer, funnel, list, campaign", () => {
    // Four call sites used to assemble the price, the spend, the ceiling and the
    // settling tail by hand, so one campaign read `13 days` on its own page and
    // `27 days` one click up (prod, 2026-08-29: same $144.39 spent, same $24/day, same
    // $44.97 per sales interest — only the inputs passed differed). A band is a promise
    // about a date, so two of them for one campaign is the page contradicting itself.
    for (const rel of [
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
      "components/funnels/funnel-overview-page.tsx",
      "components/campaigns/campaigns-page.tsx",
      "components/campaigns/campaign-overview-page.tsx",
    ]) {
      const page = src(rel);
      expect(page, `${rel} does not render the band`).toContain("<ScopeLearningBand");
      expect(page, `${rel} assembles the band's inputs itself`).not.toContain(
        "<LearningProgressCallout",
      );
    }

    // The band component itself renders the callout and decides nothing.
    const band = src("components/campaigns/scope-learning-band.tsx");
    expect(band).toContain("useScopeLearningLead");
    expect(band).toContain("<LearningProgressCallout");
  });

  it("narrows to the scope the page IS", () => {
    // An offer answers for its campaigns, a funnel for the campaigns selling it, a
    // campaign for itself. A band speaking for a campaign the page never lists counts
    // days for something the reader cannot see.
    expect(src("components/funnels/funnel-overview-page.tsx")).toContain(
      "funnelKey={rawKey || null}",
    );
    expect(src("components/campaigns/campaigns-page.tsx")).toContain("funnelKey={narrowedKey}");
    expect(src("components/campaigns/campaign-overview-page.tsx")).toContain(
      "campaignId={campaignId}",
    );
  });

  it("speaks for the campaign that finishes SOONEST, not the one with the most outcomes", () => {
    // Two campaigns at the same outcome count can be a week apart if one is funded at
    // twice the other's ceiling or prices a different step, so a count ranks by a proxy
    // for the answer rather than by the answer.
    const hook = src("lib/use-scope-learning-lead.ts");
    expect(hook).toContain("progress.daysLeft < best.progress.daysLeft");
    expect(hook).not.toContain("(row.signal ?? 0) > (best.signal ?? 0)");
  });

  it("is hidden once the scope has been measured, and never counts a paused campaign", () => {
    // The scope's figures clear the moment ONE of its campaigns is measured, so a band
    // beside a priced return promises a figure that is already stated. And a countdown
    // is priced on a daily spend a stopped campaign is not making.
    const hook = src("lib/use-scope-learning-lead.ts");
    expect(hook).toContain("const scopedLearning = scopeIsLearning(scopedRows);");
    expect(hook).toContain("isRunningStatus(row.campaign.status)");
  });

  it("prices the threshold on the step the gate COUNTS, and counts the settling tail", () => {
    // The band multiplies the expected price by ten and the sentence under it counts ten
    // sales interests, so pricing it on a booked MEETING made one box disagree with
    // itself by the reply-to-meeting rate. The tail is what the campaign page dropped:
    // 13 days is the spend half of a 27-day answer.
    const hook = src("lib/use-scope-learning-lead.ts");
    expect(hook).toContain("learningSignalUnitCostUsd(projection, stepKeys)");
    expect(hook).toContain("channelSettlesLate(row.campaign.featureSlug) ? REPLY_SETTLING_DAYS : 0");
    expect(hook).toContain("settlingDaysElapsed(");
  });

  it("computes nothing of its own, the figures come from the lib", () => {
    const band = src("components/campaigns/learning-progress-callout.tsx");
    expect(band).toContain("learningProgressIfDoubled");
    expect(band).not.toContain("LEARNING_MIN_OUTCOMES *");
  });

  it("wears the charter's TERTIARY, rotated to the brand, on every layer it draws", () => {
    // One accent across a campaign's surfaces: the band and the `Learning` tag it
    // belongs to must never read as two different states of one thing. `tone-tile` is
    // the opt-in, and the band draws MORE layers than the tag (a 700-weight heading
    // and both halves of a bar), so each needs its own rotation rule in globals.css or
    // the band renders several hues at once.
    const band = src("components/campaigns/learning-progress-callout.tsx");
    expect(band).toContain("tone-tile");
    for (const cls of [
      "border-orange-200",
      "bg-orange-50",
      "text-orange-700",
      "text-orange-600",
      "bg-orange-200",
      "bg-orange-600",
    ]) {
      expect(band).toContain(cls);
    }
    expect(band).not.toMatch(/(bg|text|border)-purple-/);

    const css = src("app/globals.css");
    // The two the band draws directly on its own root, so a compound selector.
    for (const sel of [".tone-tile.bg-orange-50", ".tone-tile.border-orange-200"]) {
      expect(css).toContain(`:root[data-brand-tint] ${sel}`);
      expect(css).toContain(`html.dark:root[data-brand-tint] ${sel}`);
    }
    // The rest sit on descendants of it.
    for (const sel of [
      ".tone-tile .text-orange-700",
      ".tone-tile .text-orange-600",
      ".tone-tile .bg-orange-200",
      ".tone-tile .bg-orange-600",
    ]) {
      expect(css).toContain(`:root[data-brand-tint] ${sel}`);
    }
    // And the weights that carry text or a light track need a dark remap too, or the
    // band paints near-black text and a track brighter than its own fill.
    for (const rule of [
      "html.dark .text-orange-600",
      "html.dark .text-orange-700",
      "html.dark .border-orange-200",
      "html.dark .bg-orange-200",
    ]) {
      expect(css).toContain(rule);
    }
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

describe("the band states one number and offers one lever", () => {
  const band = src("components/campaigns/learning-progress-callout.tsx");
  const modal = src("components/campaigns/campaign-controls-modal.tsx");

  it("states the days flatly, with no hedge in front of them", () => {
    expect(band).toContain("Learning: {progress.daysLeft} {dayWord} left");
    expect(band).not.toContain("Learning: about");
  });

  it("carries no explanatory line under the bar", () => {
    // Three clauses (the spend target, the daily rate, the settling window) on a band
    // whose whole job is to be read at a glance. The arithmetic lives in the lib.
    expect(band).not.toContain("we need to price it");
    expect(band).not.toContain("Replies keep landing for");
  });

  it("names both figures and states what the raise buys, in days saved", () => {
    // "about 42 days" makes a reader subtract to learn what they gain.
    expect(band).toContain("Invest {fmtWholeUsd(doubledBudgetUsd)}/day instead of");
    expect(band).toContain("save {saved}");
    expect(band).not.toContain("/day instead → about");
  });

  it("opens the budget form on the figure the button just named", () => {
    expect(band).toContain("prefillBudgetUsd={doubledBudgetUsd}");
    expect(modal).toContain("draftFor(row, prefill)");
    // A figure offered for ONE campaign has no row to land on at a wider grain.
    expect(modal).toContain("const prefill = campaignId != null ? prefillBudgetUsd : undefined;");
  });
});
