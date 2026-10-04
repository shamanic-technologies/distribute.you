import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildOfferLLMPrompt } from "../src/components/onboarding/llm-prompt";

// `llm-prompt.ts` is alias-free on purpose, so these are REAL unit tests rather
// than source-substring guards. Keep it that way: a runtime `@/…` import in that
// module turns every test below into a resolution failure.

const SRC = join(__dirname, "..", "src");
const GLOBALS = readFileSync(join(SRC, "app/globals.css"), "utf8");
const SETTINGS_CARD = readFileSync(
  join(SRC, "components/settings/brand-conversion-tracking-card.tsx"),
  "utf8",
);

describe("prompt copy", () => {
  it("ships no em-dash in anything a reader pastes", () => {
    const outputs = [buildOfferLLMPrompt([{ label: "Dream outcome", tip: "t", value: "v" }], "acme.com")];
    for (const out of outputs) expect(out).not.toContain("—");
  });
});

describe("the Copy for LLM button on the settings card", () => {
  it("reads 'Copy content for LLM'", () => {
    // Renamed from the bare "Copy for LLM": the hypothesis is that people were not
    // sure it copied the QUESTION as well as their draft. The v1 onboarding steps
    // that also carried it are deleted.
    expect(SETTINGS_CARD).toContain('"Copy content for LLM"');
    expect(SETTINGS_CARD).not.toContain('"Copy for LLM"');
  });
});

describe("selection highlight", () => {
  it("states a visible selection on both themes", () => {
    // The browser default is a pale blue that on a white card reads as nothing, so
    // people selecting a question did not believe the selection had taken.
    expect(GLOBALS).toContain("::selection");
    // A pseudo-element is reached by none of the `html.dark` utility remaps, so the
    // dark surface needs its own pair or it paints a light block.
    expect(GLOBALS).toContain(".dark ::selection");
  });

  it("colours it from the brand ramp, never a literal hex", () => {
    // `:root[data-brand-tint]` re-declares the ramp at the brand's hue, so an
    // arbitrary hex would be the one highlight that stays our blue on a tinted
    // dashboard.
    const at = GLOBALS.indexOf("  ::selection {");
    expect(at).toBeGreaterThan(-1);
    const block = GLOBALS.slice(at, GLOBALS.indexOf("}", at));
    expect(block).toContain("var(--color-brand-200)");
    expect(block).not.toMatch(/#[0-9a-fA-F]{6}\s*;[\s\S]*background/);
  });
});

describe("offer page: Copy all for LLM", () => {
  it("carries every lever, its hint and the value on screen, in order", () => {
    const out = buildOfferLLMPrompt(
      [
        { label: "Dream outcome", tip: "The result your customer wants most.", value: "More demos" },
        { label: "Social proof", tip: "Other people who got results.", value: "Acme\nGlobex" },
        { label: "Scarcity", tip: "Limited availability.", value: "  " },
      ],
      "acme.com",
    );
    expect(out).toContain("I run this business: acme.com");
    expect(out).toContain("## Dream outcome\n(The result your customer wants most.)\nMore demos");
    expect(out).toContain("## Social proof\n(Other people who got results.)\nAcme\nGlobex");
    expect(out).toContain("## Scarcity\n(Limited availability.)\n(nothing yet)");
    expect(out.indexOf("## Dream outcome")).toBeLessThan(out.indexOf("## Scarcity"));
    expect(out).not.toMatch(/[\u2013\u2014]/);
  });

  it("is a button on the offer card, fed by the builder", () => {
    const card = readFileSync(join(SRC, "components/settings/brand-offer-card.tsx"), "utf8");
    expect(card).toContain('"Copy all for LLM"');
    expect(card).toContain("buildOfferLLMPrompt(");
    expect(card).toContain("onClick={copyAllForLLM}");
  });
});
