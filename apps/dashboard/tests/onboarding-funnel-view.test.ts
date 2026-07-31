import { describe, it, expect } from "vitest";
import {
  funnelStepLabels,
  funnelTitle,
  funnelDestinations,
  toFunnelView,
  toFunnelViews,
  selectableFunnels,
  orderedForDetail,
  resolvePrimaryKey,
  type FunnelCatalogueEntry,
} from "../src/lib/onboarding-funnel-view";

// The catalogue as it stands: a name, a step chain, one rate key per arrow (null
// where nothing in the fleet measures that leg), and two destination flags.
const REPLY_MEETING: FunnelCatalogueEntry = {
  key: "reply_meeting",
  name: "Sales Meeting from Conversation",
  steps: ["Positive reply", "Meeting booked", "Sales meeting", "Paid client"],
  legs: ["replyToMeetingPct", null, "meetingToClosePct"],
  goal: "sales_meetings",
  requiresWebsite: false,
  pageDestination: false,
  bookingLink: true,
  tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
};

const VISIT_MEETING: FunnelCatalogueEntry = {
  key: "visit_meeting",
  name: "Sales Meeting from Website",
  steps: ["Website visit", "Meeting booked", "Sales meeting", "Paid client"],
  legs: ["visitToMeetingPct", null, "meetingToClosePct"],
  goal: "sales_meetings",
  requiresWebsite: true,
  pageDestination: true,
  bookingLink: true,
};

// A catalogue entry from BEFORE the names landed — the adapter has to keep
// rendering it, because a mid-reshape catalogue is exactly what it exists for.
const UNNAMED: FunnelCatalogueEntry = {
  key: "visit_form",
  steps: ["Website visit", "Form filled", "Paid client"],
  goal: "form_submissions",
  requiresWebsite: true,
  pageDestination: true,
};

/** Stand-in for the catalogue's own rate resolver. */
const resolveRates = (entry: FunnelCatalogueEntry) =>
  (entry.legs ?? [])
    .filter((l): l is string => typeof l === "string")
    .filter((l, i, all) => all.indexOf(l) === i)
    .map((key) => ({ key, label: `${key} label`, tip: `${key} tip` }));

describe("funnelStepLabels", () => {
  it("reads the chain, including a four-step one", () => {
    expect(funnelStepLabels(REPLY_MEETING)).toEqual([
      "Positive reply",
      "Meeting booked",
      "Sales meeting",
      "Paid client",
    ]);
  });

  it("returns an empty chain rather than throwing when the entry carries none", () => {
    expect(funnelStepLabels({ key: "x" })).toEqual([]);
  });
});

describe("funnelTitle", () => {
  it("prefers the catalogue's own name", () => {
    expect(funnelTitle(REPLY_MEETING)).toBe("Sales Meeting from Conversation");
  });

  it("falls back to the chain for an entry from before the names existed", () => {
    expect(funnelTitle(UNNAMED)).toBe("Website visit → Form filled → Paid client");
  });

  it("never renders an empty heading", () => {
    expect(funnelTitle({ key: "orphan" })).toBe("orphan");
  });

  it("ignores a whitespace-only name", () => {
    expect(funnelTitle({ ...UNNAMED, name: "   " })).toBe("Website visit → Form filled → Paid client");
  });
});

describe("funnelDestinations", () => {
  it("collects BOTH a page and a booking link when the funnel has both", () => {
    expect(funnelDestinations(VISIT_MEETING).map((d) => d.kind)).toEqual(["page", "booking"]);
  });

  it("collects only the booking link for a reply-led funnel", () => {
    expect(funnelDestinations(REPLY_MEETING).map((d) => d.kind)).toEqual(["booking"]);
  });

  it("collects nothing for a funnel that sends people nowhere we can name", () => {
    expect(funnelDestinations({ key: "x" })).toEqual([]);
  });

  it("marks a booking link optional — a brand that books over email still runs the funnel", () => {
    const booking = funnelDestinations(REPLY_MEETING)[0];
    expect(booking.optional).toBe(true);
  });

  it("does not mark the landing page optional", () => {
    const page = funnelDestinations(VISIT_MEETING)[0];
    expect(page.kind).toBe("page");
    expect(page.optional).toBe(false);
  });
});

describe("toFunnelView", () => {
  it("resolves rates through the catalogue's own resolver", () => {
    const v = toFunnelView(REPLY_MEETING, resolveRates);
    expect(v.rates.map((r) => r.key)).toEqual(["replyToMeetingPct", "meetingToClosePct"]);
    expect(v.rates[0].label).toBe("replyToMeetingPct label");
  });

  it("prices no rate when no resolver is supplied", () => {
    expect(toFunnelView(REPLY_MEETING).rates).toEqual([]);
  });

  it("gives a tone even when the catalogue entry has none", () => {
    expect(toFunnelView(UNNAMED).tone.iconBg).toBeTruthy();
  });

  it("maps the whole catalogue", () => {
    expect(toFunnelViews([REPLY_MEETING, VISIT_MEETING], resolveRates).map((v) => v.key)).toEqual([
      "reply_meeting",
      "visit_meeting",
    ]);
  });
});

describe("selectableFunnels", () => {
  const views = toFunnelViews([REPLY_MEETING, VISIT_MEETING, UNNAMED], resolveRates);

  it("offers every funnel to a brand with a website", () => {
    expect(selectableFunnels(views, true)).toHaveLength(3);
  });

  it("hides visit-led funnels from a brand with no website", () => {
    expect(selectableFunnels(views, false).map((v) => v.key)).toEqual(["reply_meeting"]);
  });
});

describe("orderedForDetail", () => {
  const views = toFunnelViews([REPLY_MEETING, VISIT_MEETING], resolveRates);

  it("puts the primary funnel first", () => {
    expect(orderedForDetail(views, "visit_meeting").map((v) => v.key)).toEqual([
      "visit_meeting",
      "reply_meeting",
    ]);
  });

  it("keeps catalogue order when nothing is primary", () => {
    expect(orderedForDetail(views, null).map((v) => v.key)).toEqual(["reply_meeting", "visit_meeting"]);
  });

  it("keeps catalogue order when the primary is not in the selection", () => {
    expect(orderedForDetail(views, "visit_form").map((v) => v.key)).toEqual([
      "reply_meeting",
      "visit_meeting",
    ]);
  });
});

describe("resolvePrimaryKey", () => {
  it("keeps a primary that is still selected", () => {
    expect(resolvePrimaryKey(["a", "b"], "b")).toBe("b");
  });

  it("hands the role to another selected funnel when the primary is dropped", () => {
    expect(resolvePrimaryKey(["a", "b"], "c")).toBe("a");
  });

  it("returns null when nothing is selected", () => {
    expect(resolvePrimaryKey([], "a")).toBeNull();
  });

  it("adopts the first selection when there is no primary yet", () => {
    expect(resolvePrimaryKey(["a"], null)).toBe("a");
  });
});
