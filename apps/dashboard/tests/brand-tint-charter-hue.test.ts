import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");
const [charter, tintBlock] = css.split("/* ── Per-brand accent tint");

describe("per-brand tint overrides stay in lockstep with the charter ramp", () => {
  it("has a tint block at all", () => {
    expect(tintBlock).toBeDefined();
  });

  // The whole failure mode this guards: someone adds a new accent surface up in
  // the charter with a literal `258` and does not restate it in the tint block.
  // Nothing goes red — the page renders, the surface just stays blue on a
  // tinted dashboard, which reads as one element failing to repaint rather than
  // as a missing rule. So the counts have to match.
  it("restates every hardcoded charter-hue surface", () => {
    const charterHues = (charter.match(/oklch\([^)]*\b258\b[^)]*\)/g) ?? []).length;
    const tintHues = (tintBlock.match(/var\(--brand-hue, 258\)/g) ?? []).length;
    expect(charterHues).toBeGreaterThan(0);
    expect(tintHues).toBeGreaterThanOrEqual(charterHues);
  });

  it("covers all ten ramp steps", () => {
    for (let step of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]) {
      expect(tintBlock).toContain(`--color-brand-${step}: oklch(`);
    }
  });

  it("names every dark-mode brand utility the charter remaps", () => {
    // Read the utilities out of the charter rather than listing them here, so a
    // new `html.dark .X-brand-N` rule fails this test instead of silently
    // shipping one blue element on a tinted page.
    const darkBrandRules = new Set(
      (charter.match(/html\.dark (\.[\w\\:.-]*brand[\w\\:.-]*)/g) ?? []).map((m) =>
        m.replace("html.dark ", ""),
      ),
    );
    expect(darkBrandRules.size).toBeGreaterThan(0);
    for (const rule of darkBrandRules) {
      expect(tintBlock).toContain(`html.dark[data-brand-tint] ${rule}`);
    }
  });

  it("keeps the lightness of every step identical to the charter", () => {
    // This is the property that makes a brand tint safe: only the hue moves, so
    // contrast is whatever the charter already settled. A step whose lightness
    // drifted would need its own per-brand legibility check.
    const lightness = (block: string) =>
      (block.match(/--color-brand-\d+: oklch\((\d+)%/g) ?? []).map((m) => m.match(/(\d+)%/)![1]);
    expect(lightness(tintBlock)).toEqual(lightness(charter));
  });

  it("falls back to the charter so a half-set attribute can not emit an invalid colour", () => {
    const oklchCalls = tintBlock.match(/oklch\([^;]*\)/g) ?? [];
    expect(oklchCalls.length).toBeGreaterThan(0);
    for (const call of oklchCalls) {
      expect(call).toContain("var(--brand-hue, 258)");
      expect(call).toContain("var(--brand-chroma-scale, 1)");
    }
  });
});
