import { describe, expect, it } from "vitest";
import { positiveReplySharePct } from "../src/lib/funnel-share";
import type { FunnelStepBreakdown, FunnelStepRow } from "../src/lib/revenue-view";

const rung = (over: Partial<FunnelStepRow> = {}): FunnelStepRow => ({
  step: "conversation",
  leadField: "repliedPositive",
  recipientsReached: 18,
  costPerReachCents: 16000,
  fromStep: "Contacted",
  fromRecipientsReached: 12925,
  conversionFromPreviousPct: 0.139,
  ...over,
});

const breakdown = (steps: FunnelStepRow[]): FunnelStepBreakdown => ({
  funnelKey: "sales_meetings_from_conversation",
  name: "Sales Meeting from Positive Reply",
  committedSpentCents: 288000,
  contactedRecipients: 12925,
  steps,
});

describe("the positive-reply share of contacted", () => {
  it("reads the first rung's SERVED conversion", () => {
    expect(positiveReplySharePct(breakdown([rung()]))).toBe(0.139);
  });

  it("is null when there is no funnel to walk", () => {
    // A read spanning several funnels walks more than one of them, so there is no
    // single set of rungs to state a share off.
    expect(positiveReplySharePct(null)).toBeNull();
    expect(positiveReplySharePct(undefined)).toBeNull();
    expect(positiveReplySharePct(breakdown([]))).toBeNull();
  });

  it("refuses a rung that is not the positive-reply one", () => {
    // A visit-led funnel starts at a website visit, and its share is a different
    // sentence about a different signal.
    expect(positiveReplySharePct(breakdown([rung({ leadField: "clicked" })]))).toBeNull();
  });

  it("refuses a rung that does not convert FROM the contacted base", () => {
    // A rung deeper in the funnel states a share of the rung BEFORE it, so calling it
    // "of contacted" would be false.
    expect(
      positiveReplySharePct(breakdown([rung({ fromStep: "Website visit" })])),
    ).toBeNull();
  });

  it("passes the producer's own null through rather than fabricating a zero", () => {
    // Null is "we could not measure this" — either side unmeasured, or a base of 0. A
    // 0% would claim nobody was interested when nobody was asked.
    expect(
      positiveReplySharePct(breakdown([rung({ conversionFromPreviousPct: null })])),
    ).toBeNull();
  });

  it("keeps a measured ZERO, which is an answer", () => {
    expect(positiveReplySharePct(breakdown([rung({ conversionFromPreviousPct: 0 })]))).toBe(0);
  });
});
