import { describe, it, expect } from "vitest";
import { isColdEmailChannel } from "../src/lib/offer-levers-home";

/**
 * `offer-levers-home.ts` carries no runtime import (its only one is `import type`,
 * erased at build), so these are REAL unit tests rather than source-substring
 * guards. Keep it that way: a runtime `@/…` import there turns them into
 * resolution failures, because vitest does not resolve the alias in this repo.
 */
describe("isColdEmailChannel", () => {
  it("names the cold email channel and nothing else", () => {
    expect(isColdEmailChannel("sales-cold-email-outreach")).toBe(true);
    // The siblings that also write emails from these levers are deliberately NOT
    // in the set yet: their Settings pages do not host the card, so admitting
    // them here would gate the levers onto a page that never renders them.
    expect(isColdEmailChannel("sales-crm-email-outreach")).toBe(false);
    expect(isColdEmailChannel("feedback-request-cold-email-outreach")).toBe(false);
    expect(isColdEmailChannel("pr-expert-quote-opportunities")).toBe(false);
  });

  it("reads an absent slug as not the cold email channel", () => {
    // A campaign created before the feature column names no channel. It states
    // nothing, which is never a licence to assume the one we want.
    expect(isColdEmailChannel(null)).toBe(false);
    expect(isColdEmailChannel(undefined)).toBe(false);
  });
});

