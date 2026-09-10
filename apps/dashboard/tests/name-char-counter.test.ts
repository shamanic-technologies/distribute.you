import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRAND_NAME_MAX_CHARS,
  CLOSE_AT_REMAINING,
  OFFER_NAME_MAX_CHARS,
  REVEAL_AT_REMAINING,
  nameCounter,
  normalizeBrandName,
  normalizeOfferName,
} from "../src/lib/name-limits";
import { OFFER_NAME_RULES, offerWriteErrorMessage } from "../src/lib/offer-write";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

/**
 * A NAME A CUSTOMER TYPES IS THEIRS, AND THE FIELD SAYS WHAT IS LEFT.
 *
 * An offer name was capped at 2 words and 20 characters — a rule written for a
 * name brand-service GENERATES, applied to names customers type. A real
 * customer was refused `Psylium-Swiss-Bio-Drogerien`. The supplied rule is now
 * a character ceiling and nothing else, and every field that collects one shows
 * what remains before anyone can be refused.
 *
 * `src/lib/name-limits.ts` is alias-free, so most of this is real unit tests.
 * Keep it that way — a runtime `@/…` import there turns them into resolution
 * failures.
 */

describe("the limits", () => {
  it("gives an offer name 60 characters and a brand name 255", () => {
    expect(OFFER_NAME_MAX_CHARS).toBe(60);
    expect(BRAND_NAME_MAX_CHARS).toBe(255);
  });

  it("states no word rule anywhere a customer reads", () => {
    // The 2-word limit survives upstream for a name brand-service generates for
    // itself. Telling a customer about it describes a rule they cannot hit.
    expect(OFFER_NAME_RULES).not.toMatch(/word/i);
    expect(OFFER_NAME_RULES).toContain("60");
    expect(offerWriteErrorMessage(400, "rename")).not.toMatch(/\bwords?\b/i);
    expect(offerWriteErrorMessage(400, "rename")).toContain("60");
  });
});

describe("normalizing — the counter must measure what the PRODUCER stores", () => {
  it("collapses internal whitespace for an offer name, the way brand-service does", () => {
    // Ten characters to brand-service, eleven to a naive count. Measuring the raw
    // value would make the counter disagree with the refusal at exactly the
    // moment someone is up against the limit and looking at it.
    expect(normalizeOfferName("Self  Serve")).toBe("Self Serve");
    expect(nameCounter("Self  Serve", 60, normalizeOfferName).count).toBe(10);
  });

  it("only trims a brand name — brand-service collapses nothing there", () => {
    expect(normalizeBrandName("  Acme  Widgets  ")).toBe("Acme  Widgets");
  });

  it("does not move the count when a trailing space is typed", () => {
    const before = nameCounter("Acme", 60, normalizeOfferName).count;
    expect(nameCounter("Acme ", 60, normalizeOfferName).count).toBe(before);
  });
});

describe("nameCounter", () => {
  it("counts DOWN, and goes negative past the ceiling — that is the whole point", () => {
    expect(nameCounter("a".repeat(55), 60, normalizeOfferName).remaining).toBe(5);
    expect(nameCounter("a".repeat(61), 60, normalizeOfferName).remaining).toBe(-1);
  });

  it("flags over only PAST the ceiling, never at it", () => {
    expect(nameCounter("a".repeat(60), 60, normalizeOfferName).over).toBe(false);
    expect(nameCounter("a".repeat(61), 60, normalizeOfferName).over).toBe(true);
  });

  it("stays hidden while the end is out of sight", () => {
    expect(nameCounter("Acme", 60, normalizeOfferName).reveal).toBe(false);
    expect(nameCounter("a".repeat(60 - REVEAL_AT_REMAINING), 60, normalizeOfferName).reveal).toBe(
      true,
    );
  });

  it("reveals nothing for an empty field whatever the ceiling", () => {
    // A `60` under a blank input reads as an instruction to write sixty characters.
    expect(nameCounter("", 60, normalizeOfferName).reveal).toBe(false);
    expect(nameCounter("   ", 60, normalizeOfferName).reveal).toBe(false);
  });

  it("warns before it refuses, and turns over only when negative", () => {
    expect(nameCounter("a".repeat(45), 60, normalizeOfferName).tone).toBe("quiet");
    expect(nameCounter("a".repeat(60 - CLOSE_AT_REMAINING), 60, normalizeOfferName).tone).toBe(
      "close",
    );
    expect(nameCounter("a".repeat(61), 60, normalizeOfferName).tone).toBe("over");
  });

  // The name that surfaced all of this.
  it("accepts the compound name a real customer was refused", () => {
    const state = nameCounter("Psylium-Swiss-Bio-Drogerien", OFFER_NAME_MAX_CHARS, normalizeOfferName);
    expect(state.count).toBe(27);
    expect(state.over).toBe(false);
    expect(state.reveal).toBe(false);
  });
});

describe("CharCounter", () => {
  const component = read("components/char-counter.tsx");

  it("renders nothing until the counter says to reveal", () => {
    expect(component).toContain("if (!state.reveal) return null");
  });

  it("announces itself, or its only feedback is visual", () => {
    expect(component).toContain('aria-live="polite"');
  });

  it("uses tones that carry an html.dark remap", () => {
    const globals = read("app/globals.css");
    for (const cls of ["text-amber-600", "text-red-600"]) {
      expect(component).toContain(cls);
      expect(globals).toContain(`html.dark .${cls}`);
    }
  });
});

/**
 * The CALL SITES, not only the component. A counter perfectly able to render is
 * the feature entirely absent if no field mounts it.
 */
describe("every field that collects a name mounts the counter", () => {
  const surfaces = [
    { file: "components/settings/offer-identity-card.tsx", max: "OFFER_NAME_MAX_CHARS" },
    { file: "components/offers/new-offer-modal.tsx", max: "OFFER_NAME_MAX_CHARS" },
    { file: "components/settings/brand-identity-card.tsx", max: "BRAND_NAME_MAX_CHARS" },
  ];

  for (const { file, max } of surfaces) {
    describe(file, () => {
      const src = read(file);

      it("renders the counter against its own ceiling", () => {
        expect(src).toContain("<CharCounter");
        expect(src).toContain(`max={${max}}`);
      });

      it("gates its write on the SAME state the counter reads", () => {
        // Two derivations is how a row comes to offer a write the number beside
        // it already shows as impossible.
        expect(src).toContain("nameCounter(");
        expect(src).toContain("counter.over");
      });

      it("sets no maxLength — the overrun must be visible as a negative number", () => {
        // The ATTRIBUTE form, not the bare word: each of these files explains in a
        // comment WHY it sets no maxLength, and a guard that trips on its own
        // rationale is the source-substring trap this repo keeps recording.
        expect(src).not.toContain("maxLength={");
        expect(src).not.toContain('maxLength="');
      });
    });
  }
});
