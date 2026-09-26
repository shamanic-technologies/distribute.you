import { describe, expect, it } from "vitest";
import { positiveReplySharePct } from "../src/lib/step-share";
import type { StepWalk, StepWalkRow } from "../src/lib/revenue-view";

const step = (over: Partial<StepWalkRow> = {}): StepWalkRow => ({
  step: "conversation",
  leadField: "repliedPositive",
  recipientsReached: 18,
  costPerReachCents: 16000,
  fromStep: "Contacted",
  fromRecipientsReached: 12925,
  conversionFromPreviousPct: 0.139,
  ...over,
});

const breakdown = (steps: StepWalkRow[]): StepWalk => ({
  name: "Positive reply",
  committedSpentCents: 288000,
  contactedRecipients: 12925,
  steps,
});

describe("the positive-reply share of contacted", () => {
  it("reads the first step's SERVED conversion", () => {
    expect(positiveReplySharePct(breakdown([step()]))).toBe(0.139);
  });

  it("is null when there is no path to walk", () => {
    // A read spanning several campaigns has no single walk to state a share off.
    expect(positiveReplySharePct(null)).toBeNull();
    expect(positiveReplySharePct(undefined)).toBeNull();
    expect(positiveReplySharePct(breakdown([]))).toBeNull();
  });

  it("refuses a step that is not the positive-reply one", () => {
    // A visit-led campaign starts at a website visit, and its share is a different
    // sentence about a different signal.
    expect(positiveReplySharePct(breakdown([step({ leadField: "clicked" })]))).toBeNull();
  });

  it("refuses a step that does not convert FROM the contacted base", () => {
    // A deeper step states a share of the step BEFORE it, so calling it
    // "of contacted" would be false.
    expect(
      positiveReplySharePct(breakdown([step({ fromStep: "Website visit" })])),
    ).toBeNull();
  });

  it("passes the producer's own null through rather than fabricating a zero", () => {
    // Null is "we could not measure this" — either side unmeasured, or a base of 0. A
    // 0% would claim nobody was interested when nobody was asked.
    expect(
      positiveReplySharePct(breakdown([step({ conversionFromPreviousPct: null })])),
    ).toBeNull();
  });

  it("keeps a measured ZERO, which is an answer", () => {
    expect(positiveReplySharePct(breakdown([step({ conversionFromPreviousPct: 0 })]))).toBe(0);
  });
});
