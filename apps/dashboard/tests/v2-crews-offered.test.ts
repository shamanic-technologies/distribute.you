import { describe, expect, it } from "vitest";
import { OFFERED_CREWS, crewFor, crewTrigger } from "../src/lib/v2/crews";

describe("offered crews", () => {
  it("offers exactly Herald, Scout and Pilot", () => {
    // The step each leg lands on, as the producer's catalogue states it (fixture).
    const lands: Record<string, string> = {
      start_to_conversation: "conversation",
      start_to_website_visit: "website_visit",
      conversation_to_meeting_booked: "meeting_booked",
    };
    const names = OFFERED_CREWS.map((c) => crewFor(c.featureSlug, lands[c.legKey], "x").name);
    expect(names.sort()).toEqual(["Herald", "Pilot", "Scout"]);
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
