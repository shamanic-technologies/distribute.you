import { describe, expect, it } from "vitest";
import {
  MODEL_OBJECTS,
  buildMatrixRows,
  channelFamilyLabel,
  channelOperatorLabel,
  legLabel,
  legCatalogueFrom,
  summariseCells,
  unpricedReasonLabel,
} from "../src/lib/acquisition-model";
import type { PublicChannel, PublicChannelOutcomeEconomicsEntry } from "@/lib/api";

const STEP_CONVERSATION = { key: "conversation", label: "Positive reply", description: "" };
const STEP_WEBSITE_VISIT = { key: "website_visit", label: "Website visit", description: "" };
const STEP_MEETING_ATTENDED = { key: "meeting_attended", label: "Meeting attended", description: "" };
const STEP_PAID_CLIENT = { key: "paid_client", label: "Paid client", description: "" };
const STEPS = [STEP_CONVERSATION, STEP_WEBSITE_VISIT, STEP_MEETING_ATTENDED, STEP_PAID_CLIENT];

function channel(over: Partial<PublicChannel> & { slug: string; name: string }): PublicChannel {
  return {
    description: "",
    icon: "envelope",
    displayOrder: 1,
    family: "outbound_one_to_one",
    terms: { dailyOperatingCostCents: 800, minimumCommitmentDays: 30, maxDaysToFirstProduction: 14 },
    operatedBy: "platform",
    stepTransitions: [{ legKey: "start_to_conversation", from: null, to: STEP_CONVERSATION }],
    ...over,
  } as PublicChannel;
}

/** One economics entry, shaped like a real `/public/channel-outcome-economics` row. */
function entry(
  channelSlug: string,
  outcomes: PublicChannelOutcomeEconomicsEntry["outcomes"],
  returnPerDollar: number | null = null,
): PublicChannelOutcomeEconomicsEntry {
  return {
    channelSlug,
    channelName: channelSlug,
    outcomes,
    returnPerDollar,
    returnPathLegKeys: returnPerDollar === null ? null : ["start_to_conversation"],
  };
}

const PRICED_REPLY = {
  step: STEP_CONVERSATION,
  landedByChannel: true,
  costPerOutcomeUsd: 263.22,
  unpricedReason: null,
};
const PRICED_PAID = {
  step: STEP_PAID_CLIENT,
  landedByChannel: false,
  costPerOutcomeUsd: 3928.68,
  unpricedReason: null,
};
const UNPRICED_ATTENDED = {
  step: STEP_MEETING_ATTENDED,
  landedByChannel: false,
  costPerOutcomeUsd: null,
  unpricedReason: "rate_not_declared",
};

describe("channelFamilyLabel", () => {
  it("labels the families the catalogue publishes today", () => {
    expect(channelFamilyLabel("outbound_one_to_one")).toBe("Outbound, one to one");
    expect(channelFamilyLabel("paid_reach")).toBe("Paid reach");
    expect(channelFamilyLabel("earned")).toBe("Earned");
    expect(channelFamilyLabel("conversion")).toBe("Conversion");
  });

  it("renders an unknown family verbatim rather than blank", () => {
    expect(channelFamilyLabel("owned_media")).toBe("owned_media");
    expect(channelFamilyLabel(null)).toBe("Not stated");
    expect(channelFamilyLabel(undefined)).toBe("Not stated");
  });
});

describe("legLabel", () => {
  it("reads an entry leg as producing its step, not as converting one", () => {
    expect(legLabel({ from: null, to: STEP_CONVERSATION })).toBe("Produces Positive reply");
  });

  it("names both ends of an internal leg", () => {
    expect(legLabel({ from: STEP_MEETING_ATTENDED, to: STEP_PAID_CLIENT })).toBe(
      "Meeting attended to Paid client",
    );
  });
});

describe("channelOperatorLabel", () => {
  it("says who puts the hours in", () => {
    expect(channelOperatorLabel("platform")).toBe("Us");
    expect(channelOperatorLabel("customer")).toBe("Their own team");
  });

  it("renders an operator we have not met verbatim rather than blank", () => {
    expect(channelOperatorLabel("partner")).toBe("partner");
    expect(channelOperatorLabel(null)).toBe("Not stated");
  });
});

describe("a channel that converts an INTERNAL leg", () => {
  it("keeps its row, is not entry-only, and states who runs it", () => {
    const closer = channel({
      slug: "founder-led-closing",
      name: "Founder Led Closing",
      operatedBy: "customer",
      stepTransitions: [
        { legKey: "meeting_attended_to_paid_client", from: STEP_MEETING_ATTENDED, to: STEP_PAID_CLIENT },
      ],
    });
    const rows = buildMatrixRows([closer], STEPS, []);
    expect(rows[0].entryOnly).toBe(false);
    expect(rows[0].legLabels).toEqual(["Meeting attended to Paid client"]);
    expect(rows[0].operatedBy).toBe("customer");
  });
});

describe("unpricedReasonLabel", () => {
  it("states each reason the producer can send", () => {
    for (const reason of [
      "no_spend_recorded",
      "no_entry_step_produced",
      "no_economics_declared",
      "rate_not_declared",
      "rate_is_zero",
    ]) {
      const label = unpricedReasonLabel(reason);
      expect(label).not.toBe(reason);
      expect(label.length).toBeGreaterThan(10);
    }
  });

  it("falls back to the raw token for a reason we have not met", () => {
    expect(unpricedReasonLabel("brand_new_reason")).toBe("brand_new_reason");
    expect(unpricedReasonLabel(null)).toBe("Not priced");
  });
});

describe("legCatalogueFrom", () => {
  it("dedupes a leg across the channels that perform it", () => {
    const legs = legCatalogueFrom([
      channel({
        slug: "a",
        name: "A",
        stepTransitions: [
          { legKey: "start_to_conversation", from: null, to: STEP_CONVERSATION },
          { legKey: "start_to_website_visit", from: null, to: STEP_WEBSITE_VISIT },
        ],
      }),
      channel({ slug: "b", name: "B" }),
    ]);
    expect(legs).toHaveLength(2);
    expect(legs.find((l) => l.key === "start_to_conversation")!.channelCount).toBe(2);
    expect(legs.find((l) => l.key === "start_to_website_visit")!.channelCount).toBe(1);
  });

  it("lists entry legs first, then by channel count", () => {
    const legs = legCatalogueFrom([
      channel({
        slug: "a",
        name: "A",
        stepTransitions: [
          { legKey: "meeting_attended_to_paid_client", from: STEP_MEETING_ATTENDED, to: STEP_PAID_CLIENT },
        ],
      }),
      channel({
        slug: "b",
        name: "B",
        stepTransitions: [
          { legKey: "meeting_attended_to_paid_client", from: STEP_MEETING_ATTENDED, to: STEP_PAID_CLIENT },
        ],
      }),
      channel({ slug: "c", name: "C" }),
    ]);
    expect(legs.map((l) => l.key)).toEqual(["start_to_conversation", "meeting_attended_to_paid_client"]);
    expect(legs[0].entry).toBe(true);
    expect(legs[1].entry).toBe(false);
  });

  it("lists no leg when no channel performs one", () => {
    expect(legCatalogueFrom([channel({ slug: "a", name: "A", stepTransitions: [] })])).toEqual([]);
  });
});

describe("buildMatrixRows", () => {
  const channels = [
    channel({ slug: "email", name: "Email", displayOrder: 1 }),
    channel({ slug: "call", name: "Call", displayOrder: 2 }),
  ];

  it("marks an outcome the channel's legs never reach as not reached", () => {
    const rows = buildMatrixRows(channels, STEPS, [entry("call", [PRICED_REPLY])]);
    const call = rows.find((r) => r.slug === "call")!;
    expect(call.cells[1]).toEqual({ kind: "not_reached" });
  });

  it("carries the served price and who lands it, verbatim", () => {
    const rows = buildMatrixRows(channels, STEPS, [entry("email", [PRICED_REPLY, PRICED_PAID], 0.64)]);
    const email = rows.find((r) => r.slug === "email")!;
    expect(email.cells[0]).toEqual({ kind: "priced", costPerOutcomeUsd: 263.22, landedByChannel: true });
    expect(email.cells[3]).toEqual({ kind: "priced", costPerOutcomeUsd: 3928.68, landedByChannel: false });
    expect(email.bestReturnPerDollar).toBe(0.64);
    expect(email.reachedOutcomeCount).toBe(2);
  });

  it("carries the producer's own reason when an outcome is not priced", () => {
    const rows = buildMatrixRows(channels, STEPS, [entry("call", [UNPRICED_ATTENDED])]);
    expect(rows.find((r) => r.slug === "call")!.cells[2]).toEqual({
      kind: "unpriced",
      reason: "rate_not_declared",
      landedByChannel: false,
    });
  });

  it("says UNKNOWN, never not reached, when the read has no entry for the channel", () => {
    const rows = buildMatrixRows(channels, STEPS, []);
    const email = rows.find((r) => r.slug === "email")!;
    expect(email.cells.every((c) => c.kind === "unknown")).toBe(true);
    expect(email.reachedOutcomeCount).toBeNull();
    expect(email.bestReturnPerDollar).toBeNull();
  });

  it("orders rows by the catalogue's own display order", () => {
    const rows = buildMatrixRows(
      [channel({ slug: "b", name: "B", displayOrder: 9 }), channel({ slug: "a", name: "A", displayOrder: 2 })],
      STEPS,
      [],
    );
    expect(rows.map((r) => r.slug)).toEqual(["a", "b"]);
  });

  it("carries the commercial terms verbatim", () => {
    const rows = buildMatrixRows(
      [channel({ slug: "call", name: "Call", terms: { dailyOperatingCostCents: 24000, minimumCommitmentDays: 30, maxDaysToFirstProduction: 5 } })],
      STEPS,
      [],
    );
    expect(rows[0].dailyOperatingCostCents).toBe(24000);
    expect(rows[0].maxDaysToFirstProduction).toBe(5);
    expect(rows[0].legLabels).toEqual(["Produces Positive reply"]);
    expect(rows[0].entryOnly).toBe(true);
  });
});

describe("summariseCells", () => {
  const channels = [
    channel({ slug: "email", name: "Email", displayOrder: 1 }),
    channel({ slug: "call", name: "Call", displayOrder: 2 }),
    channel({ slug: "ads", name: "Ads", displayOrder: 3 }),
  ];

  it("counts the reached outcomes, and how many are priced", () => {
    const rows = buildMatrixRows(channels, STEPS, [
      entry("email", [PRICED_REPLY, PRICED_PAID]),
      entry("call", [UNPRICED_ATTENDED]),
    ]);
    // email: 2 priced; call: 1 unpriced; ads: 4 unknown (no entry at all).
    expect(summariseCells(rows)).toEqual({ reached: 3, priced: 2, unpriced: 1, unknown: 4 });
  });

  it("counts nothing when no channel reaches anything", () => {
    const rows = buildMatrixRows(channels, STEPS, channels.map((c) => entry(c.slug, [])));
    expect(summariseCells(rows)).toEqual({ reached: 0, priced: 0, unpriced: 0, unknown: 0 });
  });
});

describe("MODEL_OBJECTS", () => {
  it("states an owner and a key for every object", () => {
    expect(MODEL_OBJECTS.length).toBeGreaterThan(8);
    for (const obj of MODEL_OBJECTS) {
      for (const field of [obj.name, obj.what, obj.owner, obj.key, obj.relatesTo]) {
        expect(field.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("names each object exactly once", () => {
    const names = MODEL_OBJECTS.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names no sales funnel: the model is outcomes and legs", () => {
    const copy = MODEL_OBJECTS.map((o) => `${o.name} ${o.what} ${o.owner} ${o.key} ${o.relatesTo}`).join(" ");
    expect(copy.toLowerCase()).not.toContain("funnel");
  });

  it("carries no em-dash: this is copy a person reads", () => {
    const copy = MODEL_OBJECTS.map((o) => `${o.name}${o.what}${o.owner}${o.key}${o.relatesTo}`).join("");
    expect(copy).not.toContain("—");
  });
});
