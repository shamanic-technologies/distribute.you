import { describe, it, expect } from "vitest";
import {
  funnelStepLabels,
  funnelTitle,
  toFunnelView,
  toFunnelViews,
  selectableFunnels,
  orderedForDetail,
  resolvePrimaryKey,
  type FunnelCatalogueEntry,
} from "../src/lib/onboarding-funnel-view";

// The catalogue as it stands on main: a flat three-entry `steps` tuple, no name.
const FLAT: FunnelCatalogueEntry = {
  key: "reply_meeting",
  steps: ["Positive reply", "Sales meeting", "Paid client"],
  goal: "sales_meetings",
  requiresWebsite: false,
  rates: [{ key: "replyToMeetingPct", label: "Positive reply → meeting", tip: "share who book" }],
  destination: { kind: "booking", label: "Booking link", hint: "scheduling page", placeholder: "https://cal.com/x" },
  tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
};

// The catalogue as the parallel workspace is reshaping it: a name plus legs.
const NAMED: FunnelCatalogueEntry = {
  key: "reply_meeting",
  name: "Sales Meeting from Conversation",
  legs: [
    { from: "Positive reply", to: "Meeting booked" },
    { from: "Meeting booked", to: "Sales meeting" },
    { from: "Sales meeting", to: "Paid client" },
  ],
  goal: "sales_meetings",
  requiresWebsite: false,
};

const VISIT_SIGNUP: FunnelCatalogueEntry = {
  key: "visit_signup",
  name: "Website Purchase",
  steps: ["Website visit", "Signup", "Paid client"],
  goal: "signups",
  requiresWebsite: true,
};

describe("funnelStepLabels", () => {
  it("reads a flat steps tuple as-is", () => {
    expect(funnelStepLabels(FLAT)).toEqual(["Positive reply", "Sales meeting", "Paid client"]);
  });

  it("walks legs from→to without repeating the shared boundary", () => {
    expect(funnelStepLabels(NAMED)).toEqual([
      "Positive reply",
      "Meeting booked",
      "Sales meeting",
      "Paid client",
    ]);
  });

  it("returns an empty chain rather than throwing when the entry carries neither", () => {
    expect(funnelStepLabels({ key: "x" })).toEqual([]);
  });
});

describe("funnelTitle", () => {
  it("prefers the catalogue's own name", () => {
    expect(funnelTitle(NAMED)).toBe("Sales Meeting from Conversation");
  });

  it("falls back to the chain when the catalogue has no name yet", () => {
    expect(funnelTitle(FLAT)).toBe("Positive reply → Sales meeting → Paid client");
  });

  it("never renders an empty heading", () => {
    expect(funnelTitle({ key: "orphan" })).toBe("orphan");
  });

  it("ignores a whitespace-only name", () => {
    expect(funnelTitle({ ...FLAT, name: "   " })).toBe("Positive reply → Sales meeting → Paid client");
  });
});

describe("toFunnelView", () => {
  it("carries rates, destination and tone through", () => {
    const v = toFunnelView(FLAT);
    expect(v.rates).toEqual([
      { key: "replyToMeetingPct", label: "Positive reply → meeting", tip: "share who book" },
    ]);
    expect(v.destination).toEqual({
      label: "Booking link",
      hint: "scheduling page",
      placeholder: "https://cal.com/x",
    });
    expect(v.tone).toEqual({ iconBg: "bg-purple-50", iconText: "text-purple-600" });
  });

  it("gives a tone even when the catalogue entry has none", () => {
    expect(toFunnelView({ key: "x" }).tone.iconBg).toBeTruthy();
  });

  it("reports no destination rather than an empty one", () => {
    expect(toFunnelView({ key: "x" }).destination).toBeNull();
  });

  it("maps the whole catalogue", () => {
    expect(toFunnelViews([FLAT, VISIT_SIGNUP]).map((v) => v.key)).toEqual([
      "reply_meeting",
      "visit_signup",
    ]);
  });
});

describe("selectableFunnels", () => {
  const views = toFunnelViews([FLAT, VISIT_SIGNUP]);

  it("offers every funnel to a brand with a website", () => {
    expect(selectableFunnels(views, true).map((v) => v.key)).toEqual(["reply_meeting", "visit_signup"]);
  });

  it("hides visit-led funnels from a brand with no website", () => {
    expect(selectableFunnels(views, false).map((v) => v.key)).toEqual(["reply_meeting"]);
  });
});

describe("orderedForDetail", () => {
  const views = toFunnelViews([FLAT, VISIT_SIGNUP]);

  it("puts the primary funnel first", () => {
    expect(orderedForDetail(views, "visit_signup").map((v) => v.key)).toEqual([
      "visit_signup",
      "reply_meeting",
    ]);
  });

  it("keeps catalogue order when nothing is primary", () => {
    expect(orderedForDetail(views, null).map((v) => v.key)).toEqual(["reply_meeting", "visit_signup"]);
  });

  it("keeps catalogue order when the primary is not in the selection", () => {
    expect(orderedForDetail(views, "visit_form").map((v) => v.key)).toEqual([
      "reply_meeting",
      "visit_signup",
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
