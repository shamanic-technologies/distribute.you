import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A tinted surface with no `html.dark` rule renders its LIGHT-mode near-white on the
 * dark surface — and the failure is invisible in the light default, so nothing is red
 * and nobody looks. `globals.css` records four separate rounds of noticing it one pair
 * at a time ("third time this gap appears", "same gap the purple pair had"), and the
 * leads table's eleven-hue status palette was the fifth and widest.
 *
 * This is the check that was missing. It walks `src` for every colour utility a
 * component actually ships and fails on one the dark layer does not answer for, so the
 * gap is caught at the commit that opens it rather than by somebody toggling the theme
 * months later.
 *
 * Scoped to the three shapes that genuinely break:
 *
 *   - a LIGHT FILL (`bg-*-50/100/200`) paints a bright block on the dark surface
 *   - a DARK TEXT weight (`text-*-600` and up) is near-black on it
 *   - a LIGHT BORDER (`border-*-200/300`) disappears against it
 *
 * A mid tone (`bg-*-500`) is deliberately NOT required: a saturated fill reads
 * correctly either way, which is why `bg-purple-600` and `bg-orange-600` have no rule.
 * `gray` is the neutral ramp and has its own remap layer above the accents.
 */

const root = join(__dirname, "..", "src");
const globals = readFileSync(join(root, "app", "globals.css"), "utf8");

const HUES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|zinc|neutral|stone";
const CLASS = new RegExp(String.raw`\b(bg|text|border|divide)-(${HUES})-(\d{2,3})\b`, "g");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Every colour utility the app ships, with one file that uses it (for the message). */
function usedClasses(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of sourceFiles(root)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(CLASS)) {
      if (!used.has(m[0])) used.set(m[0], file.slice(root.length + 1));
    }
  }
  return used;
}

/** Whether the utility BREAKS on the dark surface if left unremapped. */
function needsRemap(cls: string): boolean {
  const [prop, , shade] = cls.split("-");
  const weight = Number(shade);
  if (prop === "bg") return weight <= 200;
  if (prop === "text") return weight >= 600;
  return weight <= 300; // border / divide
}

describe("every accent tint a component ships is answered in dark", () => {
  it("has a dark rule for every light fill, dark text weight and light border", () => {
    const missing: string[] = [];
    for (const [cls, where] of usedClasses()) {
      if (!needsRemap(cls)) continue;
      if (globals.includes(`html.dark .${cls} `)) continue;
      missing.push(`${cls}  (e.g. ${where})`);
    }
    expect(
      missing,
      `These render their light-mode value on the dark surface. Add one line each to the\n` +
        `accent block in src/app/globals.css, following the convention stated there:\n` +
        `  bg-<hue>-50/100/200 -> the hue's -500 at 15/20/25% alpha\n` +
        `  border-<hue>-200/300 -> the hue's -500 at 30%\n` +
        `  text-<hue>-600..950 -> the hue's -300\n\n` +
        missing.sort().join("\n"),
    ).toEqual([]);
  });

  it("leaves saturated mid tones alone, which read correctly either way", () => {
    // Stated so a future sweep does not "complete" the set and wash out every filled
    // button and mark in dark.
    for (const cls of ["bg-purple-600", "bg-orange-600", "bg-brand-600"]) {
      expect(globals).not.toContain(`html.dark .${cls} `);
    }
  });

  it("derives its values from Tailwind's own ramp rather than picking them", () => {
    // A hand-picked hex drifts from the utility it is standing in for. The generated
    // block states the rule it followed; these two pin that it is still being followed.
    expect(globals).toContain("the hue's own -500 at 15% / 20% / 25% alpha");
    // Spot-check one derived pair against the compiled theme's real tokens.
    expect(globals).toContain("html.dark .bg-emerald-100 { background-color: oklch(69.6% 0.17 162.48 / 0.2); }");
    expect(globals).toContain("html.dark .text-emerald-700 { color: oklch(84.5% 0.143 164.978); }");
  });
});
