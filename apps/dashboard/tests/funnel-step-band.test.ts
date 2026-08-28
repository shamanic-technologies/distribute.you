import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");
const band = read("components/funnels/funnel-step-band.tsx");
const page = read("components/funnels/funnel-overview-page.tsx");

/** The bits every grain's body carries, so a fixture states only what it is testing. */
const BASE = {
  costBasis: "net",
  headline: { totalPipelineUsd: 7250 },
  costEconomics: {
    committedCostUsd: 2880,
    costOfAcquisitionPct: 40,
    roiMultiple: 2.5,
    costPerAcquisitionUsd: 1014,
  },
  timeSeries: [],
  organizations: [],
  leads: [],
  events: [],
};

const STEPS = {
  funnelKey: "sales_meetings_from_conversation",
  name: "Sales Meeting from Conversation",
  committedSpentCents: 288000,
  contactedRecipients: 9802,
  steps: [
    {
      step: "Positive reply",
      leadField: "repliedPositive",
      recipientsReached: 41,
      costPerReachCents: 7024,
      fromStep: "Contacted",
      fromRecipientsReached: 9802,
      conversionFromPreviousPct: 0.42,
    },
    {
      step: "Meeting booked",
      leadField: "meetingBooked",
      recipientsReached: 12,
      costPerReachCents: 24000,
      fromStep: "Positive reply",
      fromRecipientsReached: 41,
      conversionFromPreviousPct: 29.3,
    },
    {
      step: "Meeting attended",
      leadField: "meetingAttended",
      recipientsReached: 3,
      costPerReachCents: 96000,
      fromStep: "Meeting booked",
      fromRecipientsReached: 12,
      conversionFromPreviousPct: 25,
    },
    {
      step: "Paid client",
      leadField: "purchased",
      recipientsReached: 0,
      costPerReachCents: null,
      fromStep: "Meeting attended",
      fromRecipientsReached: 3,
      conversionFromPreviousPct: 0,
    },
  ],
};

describe("the parser takes every grain's body", () => {
  it("keeps the rungs on a FUNNEL-grain body", () => {
    const parsed = parseFeatureRevenue({ ...BASE, funnelSteps: STEPS }, "funnel");
    expect(parsed.funnelSteps?.steps).toHaveLength(4);
    expect(parsed.funnelSteps?.contactedRecipients).toBe(9802);
    expect(parsed.funnelSteps?.steps[2]).toMatchObject({
      step: "Meeting attended",
      recipientsReached: 3,
      conversionFromPreviousPct: 25,
    });
  });

  it("takes the explicit NULL the brand and offer grains send", () => {
    // Required AND nullable on the wire: the producer means to send this null wherever
    // there is no ONE funnel to walk. `.optional()` would parse every body EXCEPT the
    // one the null was written for, and the page would paint headings with nothing
    // under them.
    const parsed = parseFeatureRevenue({ ...BASE, funnelSteps: null }, "brand");
    expect(parsed.funnelSteps).toBeNull();
  });

  it("takes a body that predates the field at all", () => {
    // A cached pre-#854 snapshot restored from disk.
    const parsed = parseFeatureRevenue({ ...BASE }, "cached");
    expect(parsed.funnelSteps).toBeNull();
  });

  it("still THROWS on a rotten rung rather than going fail-soft", () => {
    const rotten = { ...BASE, funnelSteps: { ...STEPS, steps: [{ step: "Positive reply" }] } };
    expect(() => parseFeatureRevenue(rotten, "rotten")).toThrow();
  });

  it("keeps 0 reached apart from an unmeasured one", () => {
    // 0 is measured and means nobody got here — the answer somebody asking "is this
    // working" most needs to read. Null is "we could not measure it".
    const parsed = parseFeatureRevenue({ ...BASE, funnelSteps: STEPS }, "funnel");
    expect(parsed.funnelSteps?.steps[3].recipientsReached).toBe(0);
    const unmeasured = {
      ...BASE,
      funnelSteps: {
        ...STEPS,
        steps: [{ ...STEPS.steps[0], recipientsReached: null, conversionFromPreviousPct: null }],
      },
    };
    expect(parseFeatureRevenue(unmeasured, "u").funnelSteps?.steps[0].recipientsReached).toBeNull();
  });
});

describe("the band renders what the producer served, and divides nothing", () => {
  it("is mounted by the funnel Overview off the read it already makes", () => {
    // A guard on the component alone passes forever over a page that never renders it.
    const at = page.indexOf("<FunnelStepBand");
    expect(at).toBeGreaterThan(-1);
    const mount = page.slice(at, at + 260);
    expect(mount).toContain("breakdown={revenuePending ? undefined : data?.funnelSteps}");
    expect(mount).toContain("pending={revenuePending}");
    // Same `getOfferFunnelRevenue` call the money above rides — no second request.
    expect(page).not.toContain("getFunnelSteps");
  });

  it("sits under the chart, not in the column beside it", () => {
    // Five rungs in a ~280px card is unreadable.
    expect(page.indexOf("<FunnelStepBand")).toBeGreaterThan(page.indexOf("<RevenueOverviewSection"));
  });

  it("computes no ratio of its own", () => {
    expect(band).toContain("step.conversionFromPreviousPct");
    expect(band).toContain("step.costPerReachCents");
    // Scoped PAST the `Bar` helper on purpose. The one division in this file is the
    // bar's WIDTH, which is a drawing rather than a figure anybody reads — asserting
    // over the whole file would forbid the component from drawing at all.
    const rendered = band.slice(band.indexOf("export function FunnelStepBand("));
    expect(rendered.length).toBeGreaterThan(500);
    expect(rendered).not.toContain(" / ");
    expect(rendered).not.toContain("* 100");
    expect(rendered).not.toContain(".toFixed(0)");
  });

  it("gates the cost and the rate together, and the count never", () => {
    // Both divide by the same count, so stating one beside a tag disclaiming the other
    // lets a reader trust a number we just said we could not stand behind.
    expect(band).toContain("const thin = isLearning(step.recipientsReached ?? undefined);");
    const count = band.slice(band.indexOf("{step.recipientsReached == null"), band.indexOf("{step.recipientsReached == null") + 200);
    expect(count).not.toContain("thin");
    expect(band).toContain("<LearningTag />");
  });

  it("draws the SERVED rate, not the count", () => {
    // Scaling the bars to the biggest rung is the obvious move and it is useless: a real
    // funnel goes 9,802 contacted to 41 replies, so every rung after the first renders
    // as an identical stub and the shape a person came here to read is gone. Measured at
    // 1280 and on a Pixel 7, not inferred.
    expect(band).toContain("<Bar pct={thin ? null : step.conversionFromPreviousPct} />");
    expect(band).not.toContain("widestReach");
  });

  it("draws NO bar for a rung it is refusing to state", () => {
    // A bar for a rate we will not print is that refusal contradicting itself.
    expect(band).toContain("if (pct == null) return");
  });

  it("puts the three figures on ONE line on a phone", () => {
    // Stacked, each cell became its own line and a bare dash floated on a row of its
    // own, which reads as a fact rather than as the absence of one.
    expect(band).toContain("sm:contents");
    expect(band).toContain('<span className="hidden text-gray-400 sm:inline">');
  });

  it("renders nothing at all when there is no one funnel to walk", () => {
    expect(band).toContain("if (!breakdown || breakdown.steps.length === 0) return null;");
  });
});
