import { describe, expect, it } from "vitest";
import {
  isWritableStage,
  saleValueCentsFrom,
  stageRequiresValue,
  stepCostCentsFrom,
  LEAD_STAGE_KEYS,
  leadFunnelStages,
  trackedStages,
  WRITABLE_STAGE_KEYS,
} from "../src/lib/lead-funnel-stages";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";

describe("leadFunnelStages", () => {
  it("covers EVERY step of EVERY funnel in the catalogue, in order", () => {
    // The guard that matters: a funnel added to the catalogue, or a step label
    // reworded, must not silently drop a stage off the lead panel. A dropped stage
    // is invisible — the panel just renders one control fewer. Counted per funnel
    // rather than compared label for label, because the panel is allowed to rename a
    // step for its own surface (below) and a rename must not read as a drop.
    for (const def of SALES_FUNNELS) {
      const stages = leadFunnelStages(def.key);
      expect(stages).toHaveLength(def.steps.length);
    }
  });

  it("says Replied where the catalogue prices a Positive reply, and copies every other step verbatim", () => {
    // The ONE override, pinned by name so a second one has to be a deliberate edit
    // here. Every other label is the catalogue's own word, so the panel and the
    // settings card keep saying the same thing about the same leg.
    for (const def of SALES_FUNNELS) {
      const stages = leadFunnelStages(def.key);
      expect(stages.map((s) => s.label)).toEqual(
        def.steps.map((step) => (step === "Positive reply" ? "Replied" : step)),
      );
    }
  });

  it("returns the steps in catalogue order, base to terminal", () => {
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

  it("states NOTHING for an absent funnel rather than guessing its steps", () => {
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

describe("the amount a won deal was worth", () => {
  it("asks for a value on the sale and on nothing else", () => {
    // A won deal is the one place estimating has no excuse: with no amount every money
    // figure downstream prices it at the brand's average customer. Everywhere else the
    // amount stays optional, so stating a large lead early costs one click.
    expect(stageRequiresValue("sale")).toBe(true);
    for (const key of ["signup", "meeting_booked", "meeting_attended", "form_submission"] as const) {
      expect(stageRequiresValue(key)).toBe(false);
    }
  });

  it("reads a typed amount as the cents the producer takes", () => {
    expect(saleValueCentsFrom("4900")).toBe(490000);
    expect(saleValueCentsFrom("4900.50")).toBe(490050);
    expect(saleValueCentsFrom("0.99")).toBe(99);
  });

  it("accepts the currency decoration a person pastes in", () => {
    // Rejecting "$4,900" for its punctuation teaches nobody anything.
    expect(saleValueCentsFrom("$4,900")).toBe(490000);
    expect(saleValueCentsFrom("  4 900 ")).toBe(490000);
  });

  it("refuses everything that is not an amount, and NEVER substitutes a zero", () => {
    // A deal worth nothing and a deal nobody priced are exactly the two things this
    // change exists to keep apart, so nothing here resolves to 0.
    for (const bad of ["", "   ", "abc", "-5", "0", "0.001"]) {
      expect(saleValueCentsFrom(bad)).toBeNull();
    }
  });
});

describe("stepCostCentsFrom", () => {
  it("reads what the author typed as cents", () => {
    expect(stepCostCentsFrom("120")).toBe(12000);
    expect(stepCostCentsFrom("120.50")).toBe(12050);
    expect(stepCostCentsFrom("$1,200")).toBe(120000);
    expect(stepCostCentsFrom("  1 200 ")).toBe(120000);
  });

  it("takes ZERO as a real answer, unlike the value parser", () => {
    // A step that cost nothing and a step nobody priced are exactly the two things
    // lead-service's refusal exists to keep apart. Zero submits and reads back.
    expect(stepCostCentsFrom("0")).toBe(0);
    expect(stepCostCentsFrom("$0")).toBe(0);
    expect(stepCostCentsFrom("0.00")).toBe(0);
    expect(stepCostCentsFrom("0.001")).toBe(0);
  });

  it("refuses a blank field rather than answering it with a zero", () => {
    // Null is a refusal to submit. Nothing here defaults on the author's behalf.
    for (const blank of ["", "   "]) expect(stepCostCentsFrom(blank)).toBeNull();
  });

  it("refuses everything that is not an amount, negatives included", () => {
    for (const bad of ["abc", "-5", "-0.01", "1,2,x"]) expect(stepCostCentsFrom(bad)).toBeNull();
  });
});
