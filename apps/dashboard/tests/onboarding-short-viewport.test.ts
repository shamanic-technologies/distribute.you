import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SHORT_VIEWPORT, SHORT_VIEWPORT_MAX_HEIGHT_PX } from "../src/lib/short-viewport";

/**
 * ONBOARDING FITS A SHORT WINDOW, AND NEVER CLIPS.
 *
 * Onboarding is a fixed `100svh` app shell. The card's body scrolls inside so
 * the CTA stays on screen, and that is right — what was wrong is that the card
 * capped itself at `calc(100svh - 11rem)`, a hand-counted guess at the chrome
 * around it. Measured (compiled Tailwind off this app's own globals.css,
 * Playwright): the welcome card wants 482px and the chrome eats 224px, so it
 * needs a 706px window; a 1333x587 browser window overflowed by 71px and the
 * pillar cards were sliced in half with no scrollbar to say so.
 *
 * Below `SHORT_VIEWPORT_MAX_HEIGHT_PX` the row STRETCHES, which gives the column
 * a definite height and lets the card cap itself at `sm:max-h-full` — exact, and
 * it follows the top bar (20px signed-out, ~66px signed-in) with no constant.
 * Everything else steps down one notch. Above the threshold nothing changes:
 * measured pixel-identical at 1440x900.
 */

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const LAYOUT = read("app/(authed)/onboarding/layout.tsx");
const SHELL = read("components/start/start-shell.tsx");
const PICKS = read("components/start/start-picks.tsx");
const LIB = read("lib/short-viewport.ts");

/** The card's className, bounded to the next JSX line so a `not.toContain`
 *  cannot run past it into a sibling. */
function cardClasses(): string {
  const at = SHELL.indexOf("relative z-10 flex min-h-0 min-w-0 flex-1 flex-col bg-white p-5");
  expect(at).toBeGreaterThan(-1);
  return SHELL.slice(at, SHELL.indexOf("\n", at));
}

describe("the threshold is spelled once", () => {
  it("every compaction carries the same media query", () => {
    const wanted = `[@media(max-height:${SHORT_VIEWPORT_MAX_HEIGHT_PX}px)]`;
    for (const [key, value] of Object.entries(SHORT_VIEWPORT)) {
      expect(value, key).toContain(wanted);
      // Each variant is a COMPLETE literal — Tailwind scans source for literals,
      // so a variant assembled at runtime compiles to no rule at all.
      for (const cls of value.split(" ")) expect(cls, key).toMatch(/^\[@media\(max-height:\d+px\)\]:/);
    }
  });

  it("no second threshold anywhere", () => {
    const thresholds = new Set(
      [LIB, LAYOUT, SHELL, PICKS]
        .flatMap((s) => [...s.matchAll(/max-height:(\d+)px/g)])
        .map((m) => m[1]),
    );
    expect([...thresholds]).toEqual([String(SHORT_VIEWPORT_MAX_HEIGHT_PX)]);
  });

  it("the module is alias-free, so these are real unit tests", () => {
    expect(LIB).not.toContain('from "@/');
  });
});

describe("the cap is structural below the threshold, not a guessed constant", () => {
  it("the row stretches its child so the column has a definite height", () => {
    // `max-h-full` resolves against a parent whose own height is indefinite —
    // i.e. against nothing — unless the row stretches. This is the whole fix.
    const at = LAYOUT.indexOf("flex min-h-0 flex-1 items-stretch justify-center");
    expect(at).toBeGreaterThan(-1);
    const row = LAYOUT.slice(at, LAYOUT.indexOf("\n", at));
    expect(row).toContain("sm:items-center");
    expect(row).toContain("${SHORT_VIEWPORT.stretchRow}");
  });

  it("the shell fills that column below the threshold", () => {
    const at = SHELL.indexOf("relative flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mx-auto");
    const shell = SHELL.slice(at, SHELL.indexOf("\n", at));
    expect(shell).toContain("sm:flex-none");
    expect(shell).toContain("${SHORT_VIEWPORT.stretchShell}");
  });

  it("the card caps against that column and stays centered", () => {
    const card = cardClasses();
    // The viewport calc still governs tall windows, where nothing changed.
    expect(card).toContain("sm:max-h-[calc(100svh-11rem)]");
    expect(card).toContain("${SHORT_VIEWPORT.stretchCard}");
    expect(SHORT_VIEWPORT.stretchCard).toContain("sm:max-h-full");
    expect(SHORT_VIEWPORT.stretchCard).toContain("sm:my-auto");
  });
});

describe("every surface that eats vertical room compacts", () => {
  const callSites: [string, string, string][] = [
    ["layout gutter", LAYOUT, "SHORT_VIEWPORT.outerPadding"],
    ["shell gap", SHELL, "SHORT_VIEWPORT.shellGap"],
    ["pill bar", SHELL, "SHORT_VIEWPORT.pillPadding"],
    ["card padding", SHELL, "SHORT_VIEWPORT.cardPadding"],
    ["eyebrow", SHELL, "SHORT_VIEWPORT.eyebrowGap"],
    ["headline", SHELL, "SHORT_VIEWPORT.title"],
    ["subtitle", SHELL, "SHORT_VIEWPORT.subtitleGap"],
    ["body", SHELL, "SHORT_VIEWPORT.bodyGap"],
    ["footer", SHELL, "SHORT_VIEWPORT.footerGap"],
    ["trust strip", SHELL, "SHORT_VIEWPORT.trustPadding"],
    ["welcome pillars", PICKS, "SHORT_VIEWPORT.innerCardPadding"],
  ];

  // A module every surface COULD reach is the feature entirely absent if no
  // surface calls it — pin the call sites, not only the catalogue.
  it.each(callSites)("%s", (_name, src, ref) => {
    expect(src).toContain("${" + ref + "}");
  });

  it("the catalogue has no entry nobody renders", () => {
    const used = new Set(callSites.map(([, , ref]) => ref.split(".")[1]));
    for (const key of ["stretchRow", "stretchShell", "stretchCard"]) used.add(key);
    expect(new Set(Object.keys(SHORT_VIEWPORT))).toEqual(used);
  });
});
