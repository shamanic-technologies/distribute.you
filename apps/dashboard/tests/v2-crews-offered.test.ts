import { describe, expect, it } from "vitest";
import { OFFERED_CREWS, crewFor, crewTrigger } from "../src/lib/v2/crews";
import { crewNameFor, legCatalogueFromWire, legFor } from "../src/lib/legs";

// Excerpt of GET /public/channels as features-service serves it in production
// (v0.179.9, 2026-09-29): the crew name rides each leg as `crewName`.
const PROD_CATALOGUE = {
  channels: [
    {
      slug: "sales-cold-email-outreach",
      stepTransitions: [
        { legKey: "start_to_conversation", from: null, to: { key: "conversation", label: "Positive reply" }, crewName: "Herald" },
        { legKey: "start_to_website_visit", from: null, to: { key: "website_visit", label: "Website visit" }, crewName: "Scout" },
      ],
    },
    {
      slug: "ai-meeting-booking",
      stepTransitions: [
        {
          legKey: "conversation_to_meeting_booked",
          from: { key: "conversation", label: "Positive reply" },
          to: { key: "meeting_booked", label: "Meeting booked" },
          crewName: "Pilot",
        },
      ],
    },
    {
      slug: "cold-call-outreach",
      stepTransitions: [{ legKey: "start_to_conversation", from: null, to: { key: "conversation", label: "Positive reply" }, crewName: null }],
    },
  ],
};

describe("offered crews", () => {
  it("offers exactly Herald, Scout and Pilot, named by the producer", () => {
    const cat = legCatalogueFromWire(PROD_CATALOGUE);
    const names = OFFERED_CREWS.map((c) =>
      crewFor(c.featureSlug, legFor(cat, c.legKey)?.toKey ?? null, "x", crewNameFor(cat, c.featureSlug, c.legKey)).name,
    );
    expect(names.sort()).toEqual(["Herald", "Pilot", "Scout"]);
  });

  it("a leg the producer names nothing reads null, and a single-leg channel names a row stating no leg", () => {
    const cat = legCatalogueFromWire(PROD_CATALOGUE);
    expect(crewNameFor(cat, "cold-call-outreach", "start_to_conversation")).toBeNull();
    expect(crewNameFor(cat, "ai-meeting-booking", null)).toBe("Pilot");
    expect(crewNameFor(cat, "sales-cold-email-outreach", null)).toBeNull();
  });
});

describe("crewTrigger", () => {
  it("an entry leg works daily", () => {
    expect(crewTrigger({ fromKey: null, fromLabel: null, toKey: "conversation", toLabel: "Positive reply" })).toEqual({
      kind: "daily",
      label: "Daily",
      outcome: "Positive replies",
    });
  });
  it("a leg from a step waits for that step", () => {
    expect(
      crewTrigger({ fromKey: "conversation", fromLabel: "Positive reply", toKey: "meeting_booked", toLabel: "Meeting booked" }),
    ).toEqual({ kind: "event", label: "Positive reply", outcome: "Meetings booked" });
  });
  it("an unknown step keeps its own words, and no leg is no trigger", () => {
    expect(crewTrigger({ fromKey: null, fromLabel: null, toKey: "x", toLabel: "Thing" })?.outcome).toBe("Thing");
    expect(crewTrigger(null)).toBeNull();
  });
});
