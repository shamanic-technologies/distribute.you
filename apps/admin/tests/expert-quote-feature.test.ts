import { describe, it, expect } from "vitest";
import { isExpertQuoteFeature } from "../src/lib/expert-quote-feature";

// Regression guard for the slug-rename that motivated the helper: the HITL
// quote feature shipped as `pr-expert-quote-opportunities` then re-versioned to
// `pr-expert-quote-outreach`, silently rotting every consumer that hardcoded
// the old literal (wrong page, no Generate/Prompt, badge≠page). The helper must
// match the WHOLE family and nothing else.
describe("isExpertQuoteFeature — PR-Expert quote family gate", () => {
  it("matches every shipped slug in the family", () => {
    expect(isExpertQuoteFeature("pr-expert-quote-opportunities")).toBe(true);
    expect(isExpertQuoteFeature("pr-expert-quote-outreach")).toBe(true);
  });

  it("matches a future re-version within the family", () => {
    expect(isExpertQuoteFeature("pr-expert-quote-outreach-v2")).toBe(true);
  });

  it("does not match unrelated features", () => {
    expect(isExpertQuoteFeature("pr-cold-email-outreach")).toBe(false);
    expect(isExpertQuoteFeature("sales-cold-email-outreach")).toBe(false);
    expect(isExpertQuoteFeature("ai-visibility-scoring")).toBe(false);
    expect(isExpertQuoteFeature("press-kit-page-generation")).toBe(false);
  });
});
