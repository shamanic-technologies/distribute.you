import { describe, expect, it } from "vitest";
import {
  allFunnels,
  allPairs,
  channelPath,
  channelsForFunnel,
  formatCentsUsd,
  formatCommitment,
  formatReturn,
  formatStartsWithin,
  formatUsd,
  groupChannelsByFamily,
  funnelPath,
  NOT_MEASURED_COPY,
  pairPath,
  sortPairsByReturn,
  UNPRICED_COPY,
  type Channel,
  type PairResult,
  type ProducibleStepKey,
} from "@/lib/channel-catalogue";

// Real shapes, trimmed. The producer's contract is the source of truth for
// these; anything invented here would test the fixture, not the code.
const channel = (
  slug: string,
  family: Channel["family"],
  displayOrder: number,
  funnels: Array<[string, string]>,
): Channel => ({
  slug,
  name: slug,
  description: "",
  icon: "envelope",
  displayOrder,
  family,
  terms: {
    dailyOperatingCostCents: 800,
    minimumCommitmentDays: 30,
    maxDaysToFirstProduction: 14,
  },
  producibleSteps: [
    { key: "conversation", label: "Conversation", description: "" },
  ],
  salesFunnels: funnels.map(([key, name]) => ({ key, name, steps: [] })),
});

const measured = (returnPerDollar: number | null): PairResult => ({
  measured: true,
  economics: {
    steps: [],
    costPerSaleUsd: 100,
    costPerSaleUnpricedReason: null,
    returnPerDollar,
    lifetimeRevenueUsd: 1000,
    evidence: {
      totalSpentUsd: 1,
      conversationsProduced: 1,
      websiteVisitsProduced: 1,
      brandCount: 1,
    },
  },
});

describe("families", () => {
  const channels = [
    channel("seo", "earned", 3, [["a", "A"]]),
    channel("email", "outbound_one_to_one", 1, [["a", "A"]]),
    channel("google", "paid_reach", 2, [["a", "A"]]),
  ];

  it("reads outbound first and earned last", () => {
    // Outbound is what we run today and where every measured figure comes from;
    // earned is the slowest to produce. The order is the argument.
    expect(groupChannelsByFamily(channels).map((g) => g.family)).toEqual([
      "outbound_one_to_one",
      "paid_reach",
      "earned",
    ]);
  });

  it("drops a family with no channels rather than rendering an empty heading", () => {
    const onlyEarned = [channel("seo", "earned", 1, [["a", "A"]])];
    const groups = groupChannelsByFamily(onlyEarned);
    expect(groups).toHaveLength(1);
    expect(groups[0].family).toBe("earned");
  });

  it("keeps the producer's own order inside a family", () => {
    const two = [
      channel("second", "paid_reach", 9, [["a", "A"]]),
      channel("first", "paid_reach", 2, [["a", "A"]]),
    ];
    expect(
      groupChannelsByFamily(two)[0].channels.map((c) => c.slug),
    ).toEqual(["first", "second"]);
  });

  it("gives every family a label and a blurb, so no heading ships bare", () => {
    for (const group of groupChannelsByFamily(channels)) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.blurb.length).toBeGreaterThan(0);
    }
  });
});

describe("pairs", () => {
  const channels = [
    channel("email", "outbound_one_to_one", 1, [
      ["conv", "Conversation chain"],
      ["form", "Form Magnet"],
    ]),
    channel("google", "paid_reach", 2, [["form", "Form Magnet"]]),
  ];

  it("crosses a channel only with the funnels it can actually start", () => {
    // NOT a cartesian product: a funnel a channel cannot start has no product
    // behind it, so it gets no page.
    expect(
      allPairs(channels).map((p) => `${p.channel.slug}/${p.funnel.key}`),
    ).toEqual(["email/conv", "email/form", "google/form"]);
  });

  it("emits nothing for a channel whose derived funnel list is empty", () => {
    // An empty list is the producer stating that no deployed chain starts from
    // what this channel produces. That is a real answer, not a gap to fill.
    expect(allPairs([channel("orphan", "paid_reach", 1, [])])).toEqual([]);
  });

  it("lists each funnel once across the whole catalogue", () => {
    expect(allFunnels(channels).map((f) => f.key)).toEqual(["conv", "form"]);
  });

  it("finds every channel that can sell a given funnel", () => {
    expect(channelsForFunnel(channels, "form").map((c) => c.slug)).toEqual([
      "email",
      "google",
    ]);
    expect(channelsForFunnel(channels, "conv").map((c) => c.slug)).toEqual([
      "email",
    ]);
  });
});

describe("ranking", () => {
  it("ranks on return, not on cheapness", () => {
    // Cost ranks by cheapness, so a pair that converts to nothing would outrank
    // an expensive one that pays.
    const ranked = sortPairsByReturn([
      { id: "mid", result: measured(2.1) },
      { id: "best", result: measured(7.9) },
      { id: "worst", result: measured(0.76) },
    ]);
    expect(ranked.map((p) => p.id)).toEqual(["best", "mid", "worst"]);
  });

  it("puts what we could not measure last, never at zero", () => {
    // A pair with no return has no position among the ones that do. Sorting it
    // as 0 would rank it below a real loss, which asserts something we did not
    // measure.
    const ranked = sortPairsByReturn([
      { id: "unmeasured", result: { measured: false, reason: "no_spend_recorded" } as PairResult },
      { id: "loss", result: measured(0.4) },
      { id: "win", result: measured(3) },
    ]);
    expect(ranked.map((p) => p.id)).toEqual(["win", "loss", "unmeasured"]);
  });

  it("treats a measured-but-null return as unmeasurable, not as zero", () => {
    const ranked = sortPairsByReturn([
      { id: "null", result: measured(null) },
      { id: "real", result: measured(0.1) },
    ]);
    expect(ranked.map((p) => p.id)).toEqual(["real", "null"]);
  });

  it("does not mutate what it was given", () => {
    const input = [{ id: "a", result: measured(1) }, { id: "b", result: measured(9) }];
    sortPairsByReturn(input);
    expect(input.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("words", () => {
  it("shows cents under ten dollars and drops them above", () => {
    // Cents matter on a $7.59 website visit and are noise on a $2,363 sale.
    expect(formatUsd(7.592049667377323)).toBe("$7.59");
    expect(formatUsd(2363.249012396732)).toBe("$2,363");
    expect(formatUsd(9.999)).toBe("$10.00");
    expect(formatUsd(10)).toBe("$10");
  });

  it("says nothing rather than zero when there is no figure", () => {
    expect(formatUsd(null)).toBeNull();
    expect(formatUsd(Number.NaN)).toBeNull();
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatCentsUsd(null)).toBeNull();
  });

  it("reads the producer's cents", () => {
    expect(formatCentsUsd(800)).toBe("$8.00");
    expect(formatCentsUsd(24000)).toBe("$240");
  });

  it("prints a return to one decimal, byte-equal with the product", () => {
    expect(formatReturn(7.9038316124495855)).toBe("7.9×");
    expect(formatReturn(0.7648603875739656)).toBe("0.8×");
    expect(formatReturn(11.7)).toBe("11.7×");
    expect(formatReturn(null)).toBeNull();
  });

  it("phrases the start as an upper bound, because that is what it is", () => {
    expect(formatStartsWithin(14)).toBe("Starts within 14 days");
    expect(formatStartsWithin(1)).toBe("Starts within a day");
  });

  it("phrases the commitment", () => {
    expect(formatCommitment(30)).toBe("30-day minimum");
    expect(formatCommitment(1)).toBe("1-day minimum");
  });

  it("explains every reason a figure is absent", () => {
    // A blank cell cannot distinguish "we could not measure this" from "it
    // costs nothing", so every absence carries its own sentence.
    for (const copy of Object.values(NOT_MEASURED_COPY)) {
      expect(copy.length).toBeGreaterThan(20);
      expect(copy).not.toContain("—");
    }
    for (const copy of Object.values(UNPRICED_COPY)) {
      expect(copy.length).toBeGreaterThan(20);
      expect(copy).not.toContain("—");
    }
  });
});

describe("routes", () => {
  it("gives every channel, funnel and pair its own address", () => {
    expect(channelPath("google-ads")).toBe("/channels/google-ads");
    expect(funnelPath("form_magnet")).toBe("/funnels/form_magnet");
    expect(pairPath("google-ads", "form_magnet")).toBe(
      "/channels/google-ads/form_magnet",
    );
  });
});

describe("the served vocabulary", () => {
  it("names the two in-ad steps the way the SERVICE does, not the way its doc does", () => {
    // features-service's OpenAPI declares `platform_form_submission` and
    // `platform_booked_meeting`; its payload carries `in_ad_form_submission`
    // and `in_ad_booked_meeting`. A union built from the doc would silently
    // match nothing on exactly the two steps the paid channels exist to
    // produce, and every paid pairing would read as impossible.
    const served: ProducibleStepKey[] = [
      "conversation",
      "website_visit",
      "in_ad_form_submission",
      "in_ad_booked_meeting",
    ];
    expect(served).toHaveLength(4);
  });
});
