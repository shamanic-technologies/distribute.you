import { describe, it, expect } from "vitest";
import { parseHex, toOklchChromaHue, resolveBrandTint, colorHex } from "../src/lib/brand-tint";

// The three palettes below are the REAL bodies logo.dev's Brand endpoint
// returned on 2026-08-25. They are the fixtures precisely because the feature
// lives or dies on what real brands look like, not on invented colours.
// brand-service normalises logo.dev's `[{r,g,b,hex}]` down to plain hex
// strings, so THIS is the shape the wire carries. Verified in prod against
// /internal/brands/:id and /orgs/brands, not assumed — reading the vendor's
// object shape here is exactly what shipped a reader that tinted nothing.
const SHOCKWAVE = ["#000103", "#ce2e36", "#003366"];
const STRIPE = ["#000001", "#ffffff", "#533afd"];
const PRESSBEAT = ["#161613", "#969693", "#e9e8e5"];

describe("parseHex", () => {
  it("reads both the #-prefixed and bare forms, and the 3-digit shorthand", () => {
    expect(parseHex("#ce2e36")).toEqual({ r: 206, g: 46, b: 54 });
    expect(parseHex("ce2e36")).toEqual({ r: 206, g: 46, b: 54 });
    expect(parseHex("#f00")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null rather than a guess for anything that is not a hex colour", () => {
    expect(parseHex("")).toBeNull();
    expect(parseHex("rebeccapurple")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("#zzzzzz")).toBeNull();
  });
});

describe("toOklchChromaHue", () => {
  it("reads every neutral in the real palettes as below the accent threshold", () => {
    // Measured 2026-08-25: the greys land at C<0.006, and the two near-blacks
    // that a naive `colors[0]` would have picked as the accent sit at 0.021
    // and 0.018 — under the 0.04 ceiling, which is what keeps them out.
    for (const neutral of ["#ffffff", "#969693", "#161613", "#e9e8e5", "#000001", "#000103"]) {
      expect(toOklchChromaHue(neutral)!.chroma).toBeLessThan(0.04);
    }
  });

  it("puts the charter blue back on the charter's own hue", () => {
    // globals.css writes the ramp at hue 258 and its comment calls #2563eb the
    // same blue. Measured, #2563eb is 262.9 — the ramp and the hex it cites are
    // ~5 degrees apart. That gap predates this feature and is not corrected
    // here; the assertion records it rather than hiding it behind a loose bound.
    const blue = toOklchChromaHue("#2563eb")!;
    expect(blue.hue).toBeGreaterThan(255);
    expect(blue.hue).toBeLessThan(266);
  });
});

describe("resolveBrandTint", () => {
  it("picks the accent, NOT the first colour — the dominant one is the logo's background", () => {
    const tint = resolveBrandTint(SHOCKWAVE)!;
    expect(tint.sourceHex).toBe("#ce2e36");
    const stripe = resolveBrandTint(STRIPE)!;
    expect(stripe.sourceHex).toBe("#533afd");
  });

  it("keeps the charter blue for a palette that is entirely neutral", () => {
    // Pressbeat's three colours are a near-black, a grey and a near-white. A
    // brand with colours is not a brand with an accent.
    expect(resolveBrandTint(PRESSBEAT)).toBeNull();
  });

  it("treats absent, empty and malformed palettes as no tint", () => {
    expect(resolveBrandTint(null)).toBeNull();
    expect(resolveBrandTint(undefined)).toBeNull();
    expect(resolveBrandTint([])).toBeNull();
    expect(resolveBrandTint(["not-a-colour"])).toBeNull();
    expect(resolveBrandTint([{ hex: 42 } as never])).toBeNull();
  });

  it("reads the vendor's object form too, so a producer forwarding it verbatim still tints", () => {
    const asObjects = SHOCKWAVE.map((hex) => ({ hex }));
    expect(resolveBrandTint(asObjects)!.sourceHex).toBe("#ce2e36");
    expect(resolveBrandTint(asObjects)!.hue).toBe(resolveBrandTint(SHOCKWAVE)!.hue);
  });

  it("lands each accent on the hue a reader would name it", () => {
    expect(resolveBrandTint(SHOCKWAVE)!.hue).toBeGreaterThan(15);
    expect(resolveBrandTint(SHOCKWAVE)!.hue).toBeLessThan(45); // red
    expect(resolveBrandTint(STRIPE)!.hue).toBeGreaterThan(270);
    expect(resolveBrandTint(STRIPE)!.hue).toBeLessThan(300); // indigo/violet
  });

  it("keeps every resolved tint inside the ramp's chroma bounds", () => {
    // The invariant, asserted over every real palette rather than over one
    // hand-picked hex: a tint is never so muted the accent disappears into the
    // grey UI, and never more saturated than the charter ramp it replaces.
    for (const palette of [SHOCKWAVE, STRIPE, ["#003366"]]) {
      const tint = resolveBrandTint(palette)!;
      expect(tint.chromaScale).toBeGreaterThanOrEqual(0.6);
      expect(tint.chromaScale).toBeLessThanOrEqual(1);
    }
  });
});

describe("colorHex", () => {
  it("reads both wire forms and refuses anything else", () => {
    expect(colorHex("#ce2e36")).toBe("#ce2e36");
    expect(colorHex({ hex: "#ce2e36" })).toBe("#ce2e36");
    expect(colorHex({ hex: 42 } as never)).toBeNull();
    expect(colorHex({} as never)).toBeNull();
    expect(colorHex(null as never)).toBeNull();
  });
});
