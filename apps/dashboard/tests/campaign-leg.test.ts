import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { campaignLegFor, campaignLegLabel } from "../src/lib/campaign-leg";
import { SALES_FUNNELS, salesFunnelByKey } from "../src/lib/sales-funnels";
import type { ChannelLeg } from "../src/lib/acquisition-channels";

const reply = salesFunnelByKey("reply_meeting");
const visitMeeting = salesFunnelByKey("visit_meeting");
const visitSignup = salesFunnelByKey("visit_signup");
const visitForm = salesFunnelByKey("visit_form");

/** The legs the deployed catalogue states for these channels, verbatim. */
const COLD_EMAIL: ChannelLeg[] = [
  { from: null, to: "conversation" },
  { from: null, to: "website_visit" },
];
const FOUNDER_LED_CLOSING: ChannelLeg[] = [{ from: "meeting_attended", to: "paid_client" }];
const IN_HOUSE_SIGNUP_CONVERSION: ChannelLeg[] = [
  { from: "signup", to: "paid_client" },
  { from: "form_filled", to: "paid_client" },
];
const IN_HOUSE_MEETING_BOOKING: ChannelLeg[] = [
  { from: "conversation", to: "meeting_booked" },
  { from: "website_visit", to: "meeting_booked" },
];

describe("campaignLegFor — which leg of THIS funnel a channel performs", () => {
  it("reads an entry leg in the funnel's own words", () => {
    const leg = campaignLegFor(reply, COLD_EMAIL);
    expect(leg).toEqual({ fromIndex: null, toIndex: 0, label: "Sales interest" });
  });

  it("picks the OTHER entry leg of the same channel on a visit-led funnel", () => {
    expect(campaignLegFor(visitMeeting, COLD_EMAIL)?.label).toBe("Website visit");
    expect(campaignLegFor(visitSignup, COLD_EMAIL)?.label).toBe("Website visit");
    expect(campaignLegFor(visitForm, COLD_EMAIL)?.label).toBe("Website visit");
  });

  it("names an internal leg by the two steps it sits between", () => {
    const leg = campaignLegFor(reply, FOUNDER_LED_CLOSING);
    expect(leg).toEqual({ fromIndex: 2, toIndex: 3, label: "Meeting attended → Paid client" });
  });

  it("disambiguates a multi-leg internal channel by the funnel's own funnel", () => {
    expect(campaignLegFor(visitSignup, IN_HOUSE_SIGNUP_CONVERSION)?.label).toBe(
      "Signup → Paid client",
    );
    expect(campaignLegFor(visitForm, IN_HOUSE_SIGNUP_CONVERSION)?.label).toBe(
      "Form filled → Paid client",
    );
    expect(campaignLegFor(reply, IN_HOUSE_MEETING_BOOKING)?.label).toBe(
      "Sales interest → Meeting booked",
    );
    expect(campaignLegFor(visitMeeting, IN_HOUSE_MEETING_BOOKING)?.label).toBe(
      "Website visit → Meeting booked",
    );
  });

  it("refuses an entry leg that lands anywhere but the funnel's first step", () => {
    // Producing a booked meeting FROM NOTHING is a real thing a channel can state;
    // it simply does not put a lead onto a funnel that starts at a reply.
    expect(campaignLegFor(reply, [{ from: null, to: "meeting_booked" }])).toBeNull();
  });

  it("refuses a leg that skips a step of the funnel", () => {
    // A shortcut across the funnel is not one of its arrows, and no funnel prices it.
    expect(campaignLegFor(reply, [{ from: "conversation", to: "meeting_attended" }])).toBeNull();
  });

  it("refuses a leg pointing the wrong way down the funnel", () => {
    expect(campaignLegFor(reply, [{ from: "paid_client", to: "meeting_attended" }])).toBeNull();
  });

  it("ignores a leg whose steps are not in this funnel at all", () => {
    expect(campaignLegFor(reply, [{ from: "signup", to: "paid_client" }])).toBeNull();
    expect(campaignLegFor(reply, [{ from: null, to: "website_visit" }])).toBeNull();
  });

  it("takes the EARLIEST leg when a channel performs several of one funnel", () => {
    const both: ChannelLeg[] = [
      { from: "meeting_attended", to: "paid_client" },
      { from: null, to: "conversation" },
    ];
    expect(campaignLegFor(reply, both)?.label).toBe("Sales interest");
  });

  it("answers null for an absent funnel or an empty leg list", () => {
    expect(campaignLegFor(null, COLD_EMAIL)).toBeNull();
    expect(campaignLegFor(undefined, COLD_EMAIL)).toBeNull();
    expect(campaignLegFor(reply, [])).toBeNull();
    expect(campaignLegFor(reply, null)).toBeNull();
  });
});

describe("campaignLegLabel — what to call the campaign", () => {
  it("states the leg when there is one", () => {
    expect(campaignLegLabel(reply, FOUNDER_LED_CLOSING)).toBe("Meeting attended → Paid client");
  });

  it("falls back to the funnel's name rather than a dash", () => {
    // A channel whose feature row predates the legs field is still a campaign selling
    // this funnel — the sentence the surface read before legs existed.
    expect(campaignLegLabel(reply, [])).toBe("Sales Meeting from Conversation");
    expect(campaignLegLabel(reply, null)).toBe("Sales Meeting from Conversation");
    expect(campaignLegLabel(visitForm, [{ from: null, to: "conversation" }])).toBe("Form Magnet");
  });

  it("answers null only when there is no funnel to name", () => {
    expect(campaignLegLabel(null, FOUNDER_LED_CLOSING)).toBeNull();
  });
});

describe("the catalogue's step tokens stay parallel to its words", () => {
  it("has one token per step on every funnel", () => {
    for (const funnel of SALES_FUNNELS) {
      expect(funnel.stepKeys).toHaveLength(funnel.steps.length);
      for (const token of funnel.stepKeys) expect(token).toMatch(/^[a-z_]+$/);
    }
  });

  it("never renders a token — the words come from `steps`", () => {
    const src = readFileSync(join(__dirname, "../src/lib/campaign-leg.ts"), "utf8");
    expect(src).toContain("funnel.steps[fromIndex]");
    expect(src).toContain("funnel.steps[toIndex]");
    expect(src).not.toContain("leg.to.replace");
  });
});
