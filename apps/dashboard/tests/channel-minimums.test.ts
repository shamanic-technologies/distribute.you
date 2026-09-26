import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NO_CHANNEL_MINIMUMS,
  channelBudgetBelowMinimum,
  channelBudgetFloorMessage,
  channelBudgetHint,
  channelMinimumCents,
  channelMinimumsFromWire,
  fmtDailyFloorUsd,
  isGrandfatheredChannelFunding,
  minimumChannelBudgetUsd,
  projectedChannelTotalUsd,
} from "../src/lib/channel-minimums";

const read = (p: string) => readFileSync(join(__dirname, p), "utf8");

const COLD_EMAIL = "sales-cold-email-outreach";
const FEEDBACK = "feedback-request-cold-email-outreach";

/** The catalogue as `GET /public/channels` serves it, narrowed to what prices. */
const PUBLISHED = [
  { slug: COLD_EMAIL, terms: { dailyOperatingCostCents: 800 } },
  { slug: FEEDBACK, terms: { dailyOperatingCostCents: 800 } },
  // A channel the CUSTOMER operates spends none of our money, so a stated zero
  // is a real floor and not an absent one.
  { slug: "your-team-closing-calls", terms: { dailyOperatingCostCents: 0 } },
  { slug: "linkedin-ads", terms: { dailyOperatingCostCents: 10000 } },
];

describe("the floor is READ from the channel's published terms", () => {
  it("prices every channel whose terms state a daily operating cost", () => {
    const minimums = channelMinimumsFromWire(PUBLISHED);
    expect(channelMinimumCents(minimums, COLD_EMAIL)).toBe(800);
    expect(channelMinimumCents(minimums, "linkedin-ads")).toBe(10000);
    // Zero is a STATED floor, not an absent one.
    expect(channelMinimumCents(minimums, "your-team-closing-calls")).toBe(0);
  });

  it("states NO floor for a channel it cannot read one for, never a guessed one", () => {
    // Absent terms, an absent figure, a junk figure and a negative one are all
    // "we were not told what this costs". A default here would fund a channel at
    // a number nobody chose for it, which is money already spent; a refusal is a
    // deploy away from fixed and billing refuses it anyway.
    const minimums = channelMinimumsFromWire([
      { slug: "a" },
      { slug: "b", terms: null },
      { slug: "c", terms: { dailyOperatingCostCents: null } },
      { slug: "d", terms: { dailyOperatingCostCents: Number.NaN } },
      { slug: "e", terms: { dailyOperatingCostCents: -100 } },
      { slug: "  ", terms: { dailyOperatingCostCents: 500 } },
    ]);
    for (const slug of ["a", "b", "c", "d", "e", "  ", "never-published"]) {
      expect(channelMinimumCents(minimums, slug), slug).toBeNull();
    }
    expect(channelMinimumCents(minimums, null)).toBeNull();
    expect(channelMinimumCents(minimums, undefined)).toBeNull();
  });

  it("reads an unreadable catalogue as no floors at all", () => {
    expect(channelMinimumsFromWire(undefined).size).toBe(0);
    expect(channelMinimumsFromWire(null).size).toBe(0);
    expect(NO_CHANNEL_MINIMUMS.size).toBe(0);
  });

  it("prices two campaigns on the same channel the same, whatever their funnels", () => {
    // The whole shape of the bug this replaced: a per-funnel table priced the
    // same work two ways because the funnels differed.
    const minimums = channelMinimumsFromWire(PUBLISHED);
    expect(channelMinimumCents(minimums, COLD_EMAIL)).toBe(
      channelMinimumCents(minimums, COLD_EMAIL),
    );
    // ...and a cold-email campaign may be funded at $8 a day, which is what
    // billing accepts and what the retired $24 table refused.
    expect(channelBudgetBelowMinimum(800, 8, 0)).toBe(false);
    expect(channelBudgetBelowMinimum(800, 7, 0)).toBe(true);
  });
});

describe("what a funded ceiling may be stated at", () => {
  it("treats zero as an ordinary value, never a violation", () => {
    // Defunding is how a customer stops one channel. Refusing zero would make a
    // pause impossible without deleting what the brand said about how it sells.
    expect(channelBudgetBelowMinimum(800, 0, 0)).toBe(false);
    expect(channelBudgetBelowMinimum(800, 0, 500)).toBe(false);
    expect(channelBudgetBelowMinimum(0, 0, 0)).toBe(false);
  });

  it("refuses NOTHING when the floor could not be read", () => {
    // billing holds the same rule against the same published figure and its 400
    // is what decides, so the floor is not lost — it is simply not restated here.
    // Refusing on a floor we could not read would refuse money billing accepts.
    expect(channelBudgetBelowMinimum(null, 1, 0)).toBe(false);
    expect(channelBudgetBelowMinimum(null, 0.01, 0)).toBe(false);
    expect(isGrandfatheredChannelFunding(null, 500)).toBe(false);
    expect(channelBudgetHint(null, 0)).toBeNull();
    expect(minimumChannelBudgetUsd(null, 0, 0)).toBe(0);
  });

  it("refuses a funded channel under its own floor", () => {
    expect(channelBudgetBelowMinimum(800, 7, 0)).toBe(true);
    expect(channelBudgetBelowMinimum(800, 8, 0)).toBe(false);
    expect(channelBudgetBelowMinimum(10000, 99, 0)).toBe(true);
    expect(channelBudgetBelowMinimum(10000, 100, 0)).toBe(false);
  });

  it("grandfathers a pair billing already funds under the floor", () => {
    // The floor governs what a customer may NEWLY state. Ceilings predating it
    // were carried over verbatim, so live brands sit under their floor today;
    // refusing every write leaves the owner two moves, and the raise — the
    // direction we want — would be one of the refused ones.
    expect(channelBudgetBelowMinimum(10000, 50, 5000)).toBe(false);
    // Raising it is welcome, even short of the floor.
    expect(channelBudgetBelowMinimum(10000, 60, 5000)).toBe(false);
    // Lowering it to another funded sub-floor figure is still refused.
    expect(channelBudgetBelowMinimum(10000, 40, 5000)).toBe(true);
    // Reaching the floor spends the grandfather, with no branch of its own.
    expect(channelBudgetBelowMinimum(10000, 50, 10000)).toBe(true);
    expect(channelBudgetBelowMinimum(10000, 50, 12000)).toBe(true);
  });

  it("reads a grandfather off the stored ceiling and nothing else", () => {
    expect(isGrandfatheredChannelFunding(10000, 5000)).toBe(true);
    expect(isGrandfatheredChannelFunding(10000, 10000)).toBe(false);
    expect(isGrandfatheredChannelFunding(10000, 0)).toBe(false);
    // The same 5000 clears cold email's floor, so nothing is grandfathered there.
    expect(isGrandfatheredChannelFunding(800, 5000)).toBe(false);
  });
});

describe("what a person is told", () => {
  it("names the channel's real figure, not one this app decided", () => {
    expect(channelBudgetHint(800, 0)).toBe("From $8 a day.");
    expect(channelBudgetHint(10000, 0)).toBe("From $100 a day.");
    expect(fmtDailyFloorUsd(850)).toBe("$8.50");
  });

  it("tells a grandfathered pair what it may DO, not a floor it is under", () => {
    // Quoting the floor to someone already funded below it reads as "you are not
    // allowed to be here", on a ceiling they have been paying against for weeks.
    const hint = channelBudgetHint(10000, 5000)!;
    expect(hint).toContain("$50 a day today");
    expect(hint).toContain("keep or raise");
    expect(hint).not.toContain("From $100");

    const refusal = channelBudgetFloorMessage("LinkedIn Ads", 10000, 5000);
    expect(refusal).toContain("LinkedIn Ads");
    expect(refusal).toContain("$50 a day");
    expect(refusal).toContain("raise it");
    expect(refusal).not.toContain("needs at least");
  });

  it("names the channel in a fresh refusal, because the floor is the channel's", () => {
    const refusal = channelBudgetFloorMessage("Cold Email", 800, 0);
    expect(refusal).toBe(
      "Cold Email needs at least $8 a day to run. Leave it empty to stop funding it.",
    );
  });
});

describe("the group a floor binds", () => {
  it("adds the typed figure to what the pair's OTHER offers hold", () => {
    expect(projectedChannelTotalUsd(3000, 1000, 40)).toBe(60);
  });

  it("holds the siblings constant when this ceiling is defunded", () => {
    expect(projectedChannelTotalUsd(3000, 1000, 0)).toBe(20);
  });

  it("never reads a negative typed figure as a credit against the siblings", () => {
    expect(projectedChannelTotalUsd(3000, 1000, -5)).toBe(20);
  });
});

/**
 * A figure under the bar is put BACK to the smallest one that clears rather than
 * refused on screen: refusing and leaving the typed value there makes the
 * customer guess what is allowed, and naming the floor alone makes them do the
 * subtraction the siblings imply.
 */
describe("the smallest funded figure a ceiling may hold", () => {
  it("is the channel's floor when this ceiling is the only thing funding the pair", () => {
    expect(minimumChannelBudgetUsd(800, 0, 0)).toBe(8);
    expect(minimumChannelBudgetUsd(800, 800, 800)).toBe(8);
    expect(minimumChannelBudgetUsd(10000, 0, 0)).toBe(100);
  });

  it("subtracts what the pair's OTHER offers already fund", () => {
    // The pair holds $120, $40 of it this ceiling's — so $80 comes from siblings
    // and this one only has to put up $20 to keep a $100 pair total.
    expect(minimumChannelBudgetUsd(10000, 12000, 4000)).toBe(20);
    // Under the floor the pair is grandfathered, so the bar is what it is funded
    // at TODAY: $30 held, $20 of it from siblings, so this one puts up $10.
    expect(minimumChannelBudgetUsd(10000, 3000, 1000)).toBe(10);
  });

  it("is ZERO once the siblings clear the bar without this ceiling", () => {
    expect(minimumChannelBudgetUsd(800, 5000, 1000)).toBe(0);
  });

  it("is the grandfathered figure on a pair billing funds UNDER its floor", () => {
    // Kept or raised, never lowered — so the bar is what it is funded at today,
    // NOT the floor it is not allowed to walk down to.
    expect(minimumChannelBudgetUsd(10000, 5000, 5000)).toBe(50);
  });

  it("never returns a figure its own rule would refuse", () => {
    for (const [minimum, group, own] of [
      [800, 0, 0],
      [800, 800, 800],
      [10000, 12000, 4000],
      [10000, 3000, 1000],
      [10000, 5000, 5000],
      // A floor that is not a whole number of dollars: rounding the remainder
      // DOWN would land a dollar under the bar it was computed from.
      [830, 0, 0],
      [1250, 400, 400],
      [0, 0, 0],
    ] as const) {
      const min = minimumChannelBudgetUsd(minimum, group, own);
      if (min === 0) continue;
      const projected = projectedChannelTotalUsd(group, own, min);
      expect(
        channelBudgetBelowMinimum(minimum, projected, group),
        `clamped ${min} is itself refused at floor ${minimum}`,
      ).toBe(false);
    }
  });
});

describe("the module stays where its rule can be tested", () => {
  it("keeps no alias import, so these are real unit tests", () => {
    expect(read("../src/lib/channel-minimums.ts")).not.toContain('from "@/');
  });

  it("holds no table of figures — the catalogue is the source", () => {
    // The copy this replaced went stale silently. A figure written here would go
    // stale exactly the same way.
    const src = read("../src/lib/channel-minimums.ts");
    expect(src).not.toMatch(/=\s*\{\s*reply_meeting:/);
    expect(src).not.toContain("FUNNEL_MIN_DAILY_BUDGET_USD");
  });
});
