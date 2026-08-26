import { describe, expect, it } from "vitest";
import {
  isWritableStage,
  LEAD_STAGE_KEYS,
  leadFunnelStages,
  trackedStages,
  WRITABLE_STAGE_KEYS,
} from "../src/lib/lead-funnel-stages";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";

describe("leadFunnelStages", () => {
  it("covers EVERY step label of EVERY funnel in the catalogue", () => {
    // The guard that matters: a funnel added to the catalogue, or a step label
    // reworded, must not silently drop a stage off the lead panel. A dropped stage
    // is invisible — the panel just renders one control fewer.
    for (const def of SALES_FUNNELS) {
      const stages = leadFunnelStages(def.key);
      expect(stages.map((s) => s.label)).toEqual(def.steps);
    }
  });

  it("returns the chain in catalogue order, base to terminal", () => {
    expect(leadFunnelStages("reply_meeting").map((s) => s.key)).toEqual([
      "positive_reply",
      "meeting_booked",
      "meeting_attended",
      "sale",
    ]);
    expect(leadFunnelStages("visit_signup").map((s) => s.key)).toEqual([
      "website_visit",
      "signup",
      "sale",
    ]);
    expect(leadFunnelStages("visit_form").map((s) => s.key)).toEqual([
      "website_visit",
      "form_submission",
      "sale",
    ]);
  });

  it("distinguishes the two meeting funnels, which a goal cannot", () => {
    // `sales_meetings` is BOTH of these. Keying on the goal would offer a website
    // visit to a campaign that buys a reply, which is the bug this replaces.
    const reply = leadFunnelStages("reply_meeting").map((s) => s.key);
    const visit = leadFunnelStages("visit_meeting").map((s) => s.key);
    expect(reply[0]).toBe("positive_reply");
    expect(visit[0]).toBe("website_visit");
    expect(reply).not.toEqual(visit);
  });

  it("reads the canonical wire spellings as well as the short keys", () => {
    expect(leadFunnelStages("sales_meetings_from_conversation").map((s) => s.key)).toEqual(
      leadFunnelStages("reply_meeting").map((s) => s.key),
    );
    expect(leadFunnelStages("website_purchases").map((s) => s.key)).toEqual(
      leadFunnelStages("visit_signup").map((s) => s.key),
    );
  });

  it("states NOTHING for an absent funnel rather than guessing a chain", () => {
    // The brand-level case by construction: a brand runs several funnels at once.
    expect(leadFunnelStages(null)).toEqual([]);
    expect(leadFunnelStages(undefined)).toEqual([]);
  });

  it("THROWS on a funnel key the catalogue does not carry, rather than stating nothing", () => {
    // Absent and unknown are different statements. An absent funnel is the ordinary
    // brand-level case; an unknown one is vocabulary drift from a CHECK-constrained
    // column upstream, and the catalogue's own contract is to surface it. Collapsing
    // the two would hide the drift behind an empty panel that looks like brand scope.
    expect(() => leadFunnelStages("not_a_funnel" as never)).toThrow(/Unmapped sales funnel key/);
  });

  it("gives every stage its own terminal wording", () => {
    // One shared "Won't happen" would read as the same statement about four
    // different things; each stage says what is being ruled out.
    const wont = SALES_FUNNELS.flatMap((def) => leadFunnelStages(def.key).map((s) => s.wontLabel));
    expect(new Set(wont).size).toBe(new Set(LEAD_STAGE_KEYS).size);
    for (const label of wont) expect(label.length).toBeGreaterThan(0);
  });

  it("carries no em-dash in any user-facing label", () => {
    for (const def of SALES_FUNNELS) {
      for (const stage of leadFunnelStages(def.key)) {
        expect(stage.label).not.toContain("—");
        expect(stage.wontLabel).not.toContain("—");
      }
    }
  });
});

describe("trackedStages", () => {
  it("marks only what the evidence says is TRUE", () => {
    expect(trackedStages({ repliedPositive: true, meetingBooked: true })).toEqual({
      positive_reply: true,
      meeting_booked: true,
    });
  });

  it("treats FALSE and ABSENT the same, and neither as a statement that it did not happen", () => {
    // "We have not seen this" is not "this did not happen". A false here must never
    // become a rendered claim about the lead.
    expect(trackedStages({ signup: false })).toEqual({});
    expect(trackedStages({})).toEqual({});
    expect(trackedStages(null)).toEqual({});
    expect(trackedStages(undefined)).toEqual({});
  });

  it("never invents an attended meeting, which nothing in the fleet measures", () => {
    expect(trackedStages({ meetingBooked: true }).meeting_attended).toBeUndefined();
  });

  it("maps every evidence field onto a stage the catalogue can render", () => {
    const all = trackedStages({
      repliedPositive: true,
      clicked: true,
      meetingBooked: true,
      meetingAttended: true,
      signup: true,
      formSubmission: true,
      purchased: true,
    });
    expect(Object.keys(all).sort()).toEqual([...LEAD_STAGE_KEYS].sort());
  });
});

describe("writable stages", () => {
  it("accepts a statement only on the steps lead-service actually records", () => {
    expect([...WRITABLE_STAGE_KEYS].sort()).toEqual(
      ["form_submission", "meeting_attended", "meeting_booked", "sale", "signup"].sort(),
    );
  });

  it("excludes the reply and the visit, which are NOT lead-service's to record", () => {
    // A reply is a fact about a message (instantly-service owns that vocabulary) and a
    // visit is a click the delivery layer measures. Offering a control that cannot
    // write is worse than offering none.
    expect(isWritableStage("positive_reply")).toBe(false);
    expect(isWritableStage("website_visit")).toBe(false);
  });

  it("every writable key is a stage some funnel actually renders", () => {
    const rendered = new Set(SALES_FUNNELS.flatMap((d) => leadFunnelStages(d.key).map((s) => s.key)));
    for (const key of WRITABLE_STAGE_KEYS) expect(rendered.has(key)).toBe(true);
  });
});
