import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  offeredLegs,
  offeredSteps,
  toggleLeg,
  toggleStep,
  type PathLeg,
} from "../src/lib/offer-sales-path";

const leg = (from: string | null, to: string): PathLeg => ({
  legKey: `${from ?? "start"}_to_${to}`,
  fromKey: from,
  toKey: to,
});

// The features-service catalogue as of 2026-09-29, plus the booking-call path.
const ALL: PathLeg[] = [
  leg(null, "conversation"),
  leg(null, "website_visit"),
  leg(null, "meeting_booked"),
  leg("conversation", "meeting_booked"),
  leg("conversation", "booking_call"),
  leg("booking_call", "meeting_booked"),
  leg("meeting_booked", "meeting_attended"),
  leg("meeting_attended", "paid_client"),
  leg("website_visit", "meeting_booked"),
  leg("website_visit", "signup"),
  leg("signup", "paid_client"),
  leg("website_visit", "purchase"),
  leg("purchase", "paid_client"),
];
const CHANNELS = new Map<string, string[]>([
  ["start_to_conversation", ["sales-cold-email-outreach"]],
  ["start_to_website_visit", ["sales-cold-email-outreach"]],
  ["conversation_to_meeting_booked", ["ai-meeting-booking"]],
]);
const LEGS = offeredLegs(ALL, CHANNELS);
const keys = (s: ReadonlySet<string>) => [...s].sort();

describe("offered legs and steps", () => {
  it("drops an entry leg no channel of ours performs, keeps every leg between steps", () => {
    const k = LEGS.map((l) => l.legKey);
    expect(k).not.toContain("start_to_meeting_booked");
    expect(k).toContain("start_to_conversation");
    expect(k).toContain("meeting_booked_to_meeting_attended");
  });

  it("never offers the paying client as a card", () => {
    const steps = offeredSteps(LEGS, ["conversation", "website_visit", "paid_client", "signup"]);
    expect(steps).toEqual(["conversation", "website_visit", "signup"]);
  });
});

describe("ticking a leg", () => {
  it("ticks the steps it connects, never the paying client", () => {
    const s = toggleLeg(EMPTY_SELECTION, leg("signup", "paid_client"), true, LEGS);
    expect(keys(s.steps)).toEqual(["signup"]);
  });

  it("unticking drops only the steps no remaining leg touches", () => {
    let s = toggleLeg(EMPTY_SELECTION, leg("website_visit", "signup"), true, LEGS);
    s = toggleLeg(s, leg("signup", "paid_client"), true, LEGS);
    s = toggleLeg(s, leg("website_visit", "signup"), false, LEGS);
    expect(keys(s.steps)).toEqual(["signup"]);
    expect(keys(s.legs)).toEqual(["signup_to_paid_client"]);
  });
});

describe("ticking a step", () => {
  it("ticks every leg joining it to a ticked step, the start or the paying client", () => {
    let s = toggleStep(EMPTY_SELECTION, "website_visit", true, LEGS);
    expect(keys(s.legs)).toEqual(["start_to_website_visit"]);
    s = toggleStep(s, "signup", true, LEGS);
    expect(keys(s.legs)).toEqual(["signup_to_paid_client", "start_to_website_visit", "website_visit_to_signup"]);
  });

  it("does not tick a leg whose other step is not ticked", () => {
    const s = toggleStep(EMPTY_SELECTION, "booking_call", true, LEGS);
    expect(keys(s.legs)).toEqual([]);
  });

  it("unticking drops the step and every leg touching it", () => {
    let s = toggleStep(EMPTY_SELECTION, "conversation", true, LEGS);
    s = toggleStep(s, "booking_call", true, LEGS);
    s = toggleStep(s, "conversation", false, LEGS);
    expect(keys(s.steps)).toEqual(["booking_call"]);
    expect(keys(s.legs)).toEqual([]);
  });
});
