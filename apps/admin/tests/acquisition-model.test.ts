import { describe, expect, it } from "vitest";
import {
  MODEL_OBJECTS,
  buildMatrixRows,
  channelFamilyLabel,
  funnelCatalogueFrom,
  stepCostsForPair,
  summariseCells,
  unmeasuredReasonLabel,
  unpricedStepLabel,
} from "../src/lib/acquisition-model";
import type { PublicChannel, PublicChannelFunnelPair } from "@/lib/api";

const REPLY_MEETING = {
  key: "sales_meetings_from_conversation",
  name: "Sales Meeting from Conversation",
  steps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"],
};
const FORM_MAGNET = {
  key: "form_magnet",
  name: "Form Magnet",
  steps: ["Website visit", "Form filled", "Paid client"],
};

function channel(over: Partial<PublicChannel> & { slug: string; name: string }): PublicChannel {
  return {
    description: "",
    icon: "envelope",
    displayOrder: 1,
    family: "outbound_one_to_one",
    terms: { dailyOperatingCostCents: 800, minimumCommitmentDays: 30, maxDaysToFirstProduction: 14 },
    producibleSteps: [{ key: "conversation", label: "Conversation", description: "" }],
    salesFunnels: [REPLY_MEETING],
    ...over,
  } as PublicChannel;
}

function measuredPair(
  channelSlug: string,
  funnel: { key: string; name: string; steps: string[] },
): PublicChannelFunnelPair {
  return {
    channelSlug,
    channelName: channelSlug,
    funnelKey: funnel.key,
    funnelName: funnel.name,
    funnelSteps: funnel.steps,
    result: {
      measured: true,
      economics: {
        steps: [
          { step: funnel.steps[0], milestone: false, costPerStepUsd: 216.48, unpricedReason: null },
          { step: funnel.steps[1], milestone: true, costPerStepUsd: null, unpricedReason: "rate_not_declared" },
        ],
        costPerSaleUsd: 2429.8,
        costPerSaleUnpricedReason: null,
        returnPerDollar: 0.74,
        lifetimeRevenueUsd: 1807.55,
        evidence: {
          totalSpentUsd: 6927.45,
          conversationsProduced: 32,
          websiteVisitsProduced: 857,
          brandCount: 27,
        },
      },
    },
  } as PublicChannelFunnelPair;
}

function unmeasuredPair(
  channelSlug: string,
  funnel: { key: string; name: string; steps: string[] },
  reason: string,
): PublicChannelFunnelPair {
  return {
    channelSlug,
    channelName: channelSlug,
    funnelKey: funnel.key,
    funnelName: funnel.name,
    funnelSteps: funnel.steps,
    result: { measured: false, reason },
  } as PublicChannelFunnelPair;
}

describe("channelFamilyLabel", () => {
  it("labels the families the catalogue publishes today", () => {
    expect(channelFamilyLabel("outbound_one_to_one")).toBe("Outbound, one to one");
    expect(channelFamilyLabel("paid_reach")).toBe("Paid reach");
    expect(channelFamilyLabel("earned")).toBe("Earned");
  });

  it("renders an unknown family verbatim rather than blank", () => {
    expect(channelFamilyLabel("owned_media")).toBe("owned_media");
    expect(channelFamilyLabel(null)).toBe("Not stated");
    expect(channelFamilyLabel(undefined)).toBe("Not stated");
  });
});

describe("unmeasuredReasonLabel / unpricedStepLabel", () => {
  it("states each reason the producer can send", () => {
    for (const reason of ["no_spend_recorded", "no_entry_step_produced", "no_economics_declared"]) {
      const label = unmeasuredReasonLabel(reason);
      expect(label).not.toBe(reason);
      expect(label.length).toBeGreaterThan(10);
    }
    for (const reason of ["rate_not_declared", "rate_is_zero"]) {
      const label = unpricedStepLabel(reason);
      expect(label).not.toBe(reason);
      expect(label.length).toBeGreaterThan(10);
    }
  });

  it("falls back to the raw token for a reason we have not met", () => {
    expect(unmeasuredReasonLabel("brand_new_reason")).toBe("brand_new_reason");
    expect(unpricedStepLabel("brand_new_reason")).toBe("brand_new_reason");
  });
});

describe("funnelCatalogueFrom", () => {
  it("dedupes a funnel across the channels that can sell it", () => {
    const funnels = funnelCatalogueFrom([
      channel({ slug: "a", name: "A", salesFunnels: [REPLY_MEETING, FORM_MAGNET] }),
      channel({ slug: "b", name: "B", salesFunnels: [REPLY_MEETING] }),
    ]);
    expect(funnels).toHaveLength(2);
    const reply = funnels.find((f) => f.key === REPLY_MEETING.key)!;
    expect(reply.channelCount).toBe(2);
    expect(reply.steps).toEqual(REPLY_MEETING.steps);
    expect(reply.entryStep).toBe("Positive reply");
    expect(funnels.find((f) => f.key === FORM_MAGNET.key)!.channelCount).toBe(1);
  });

  it("orders by channel count desc, then name", () => {
    const funnels = funnelCatalogueFrom([
      channel({ slug: "a", name: "A", salesFunnels: [FORM_MAGNET] }),
      channel({ slug: "b", name: "B", salesFunnels: [REPLY_MEETING] }),
      channel({ slug: "c", name: "C", salesFunnels: [REPLY_MEETING] }),
    ]);
    expect(funnels.map((f) => f.key)).toEqual([REPLY_MEETING.key, FORM_MAGNET.key]);
  });

  it("lists no funnel when nothing can sell one", () => {
    expect(funnelCatalogueFrom([channel({ slug: "a", name: "A", salesFunnels: [] })])).toEqual([]);
  });
});

describe("buildMatrixRows", () => {
  const channels = [
    channel({ slug: "email", name: "Email", displayOrder: 1, salesFunnels: [REPLY_MEETING, FORM_MAGNET] }),
    channel({ slug: "call", name: "Call", displayOrder: 2, salesFunnels: [REPLY_MEETING] }),
  ];
  const funnels = funnelCatalogueFrom(channels);

  it("marks a funnel the channel cannot sell as not sellable", () => {
    const rows = buildMatrixRows(channels, funnels, []);
    const call = rows.find((r) => r.slug === "call")!;
    const formIndex = funnels.findIndex((f) => f.key === FORM_MAGNET.key);
    expect(call.cells[formIndex]).toEqual({ kind: "not_sellable" });
  });

  it("carries the measured economics through", () => {
    const rows = buildMatrixRows(channels, funnels, [measuredPair("email", REPLY_MEETING)]);
    const replyIndex = funnels.findIndex((f) => f.key === REPLY_MEETING.key);
    const cell = rows.find((r) => r.slug === "email")!.cells[replyIndex];
    expect(cell.kind).toBe("measured");
    if (cell.kind !== "measured") throw new Error("unreachable");
    expect(cell.returnPerDollar).toBe(0.74);
    expect(cell.costPerSaleUsd).toBe(2429.8);
    expect(cell.lifetimeRevenueUsd).toBe(1807.55);
    expect(cell.steps).toHaveLength(2);
    expect(cell.steps[1]).toEqual({
      step: "Meeting booked",
      milestone: true,
      costPerStepUsd: null,
      unpricedReason: "rate_not_declared",
    });
  });

  it("carries the producer's own reason when a pair is not measured", () => {
    const rows = buildMatrixRows(channels, funnels, [
      unmeasuredPair("call", REPLY_MEETING, "no_spend_recorded"),
    ]);
    const replyIndex = funnels.findIndex((f) => f.key === REPLY_MEETING.key);
    expect(rows.find((r) => r.slug === "call")!.cells[replyIndex]).toEqual({
      kind: "unmeasured",
      reason: "no_spend_recorded",
    });
  });

  it("says UNKNOWN, never not-sellable, when a sellable pair has no served row", () => {
    const rows = buildMatrixRows(channels, funnels, []);
    const replyIndex = funnels.findIndex((f) => f.key === REPLY_MEETING.key);
    expect(rows.find((r) => r.slug === "email")!.cells[replyIndex]).toEqual({ kind: "unknown" });
  });

  it("keeps a channel that can sell nothing, with every cell not sellable", () => {
    const orphan = channel({ slug: "orphan", name: "Orphan", displayOrder: 3, salesFunnels: [] });
    const rows = buildMatrixRows([...channels, orphan], funnels, []);
    const row = rows.find((r) => r.slug === "orphan")!;
    expect(row).toBeDefined();
    expect(row.sellableFunnelCount).toBe(0);
    expect(row.cells.every((c) => c.kind === "not_sellable")).toBe(true);
  });

  it("orders rows by the catalogue's own display order", () => {
    const rows = buildMatrixRows(
      [channel({ slug: "b", name: "B", displayOrder: 9 }), channel({ slug: "a", name: "A", displayOrder: 2 })],
      funnels,
      [],
    );
    expect(rows.map((r) => r.slug)).toEqual(["a", "b"]);
  });

  it("carries the commercial terms verbatim", () => {
    const rows = buildMatrixRows(
      [channel({ slug: "call", name: "Call", terms: { dailyOperatingCostCents: 24000, minimumCommitmentDays: 30, maxDaysToFirstProduction: 5 } })],
      funnels,
      [],
    );
    expect(rows[0].dailyOperatingCostCents).toBe(24000);
    expect(rows[0].maxDaysToFirstProduction).toBe(5);
    expect(rows[0].producibleStepKeys).toEqual(["conversation"]);
  });
});

describe("stepCostsForPair", () => {
  it("returns the per-step prices of a measured cell, order preserved", () => {
    const funnels = funnelCatalogueFrom([channel({ slug: "email", name: "Email" })]);
    const rows = buildMatrixRows(
      [channel({ slug: "email", name: "Email" })],
      funnels,
      [measuredPair("email", REPLY_MEETING)],
    );
    const steps = stepCostsForPair(rows[0].cells[0]);
    expect(steps.map((s) => s.step)).toEqual(["Positive reply", "Meeting booked"]);
    expect(steps[0].costPerStepUsd).toBe(216.48);
    expect(steps[1].costPerStepUsd).toBeNull();
  });

  it("returns nothing for a cell that is not measured", () => {
    expect(stepCostsForPair({ kind: "not_sellable" })).toEqual([]);
    expect(stepCostsForPair({ kind: "unknown" })).toEqual([]);
    expect(stepCostsForPair({ kind: "unmeasured", reason: "no_spend_recorded" })).toEqual([]);
  });
});

describe("summariseCells", () => {
  const channels = [
    channel({ slug: "email", name: "Email", displayOrder: 1, salesFunnels: [REPLY_MEETING, FORM_MAGNET] }),
    channel({ slug: "call", name: "Call", displayOrder: 2, salesFunnels: [REPLY_MEETING] }),
  ];
  const funnels = funnelCatalogueFrom(channels);

  it("counts only the pairs that can be sold", () => {
    const rows = buildMatrixRows(channels, funnels, [
      measuredPair("email", REPLY_MEETING),
      unmeasuredPair("call", REPLY_MEETING, "no_spend_recorded"),
    ]);
    // 3 sellable cells: email x both funnels, call x reply. Call x form is not.
    expect(summariseCells(rows)).toEqual({
      sellable: 3,
      measured: 1,
      unmeasured: 1,
      unknown: 1,
    });
  });

  it("counts nothing when no pair can be sold", () => {
    const orphan = [channel({ slug: "orphan", name: "Orphan", salesFunnels: [] })];
    const rows = buildMatrixRows(orphan, funnels, []);
    expect(summariseCells(rows)).toEqual({ sellable: 0, measured: 0, unmeasured: 0, unknown: 0 });
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

  it("carries no em-dash: this is copy a person reads", () => {
    const copy = MODEL_OBJECTS.map((o) => `${o.name}${o.what}${o.owner}${o.key}${o.relatesTo}`).join("");
    expect(copy).not.toContain("—");
  });
});
