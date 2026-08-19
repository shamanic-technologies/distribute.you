import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The depth system is the landing's one vertical language: a page is a
// cross-section of the world, light at the top where the fruit hangs, dark at
// the bottom where the seed goes. Every page adopts it, so the invariants below
// are what stop one page drifting into a different world.
//
// These are source assertions on purpose. The RENDERED behaviour (contrast at
// every depth, the motif never eating a click, the seed staying reachable in
// the soil) is verified by reproduction with Playwright, per the repo rule that
// a class grep proves nothing about what a browser does. What a source test CAN
// hold is the set of decisions a future edit would silently undo.

const cssPath = path.resolve(
  __dirname,
  "../../public/landing/css/depth.css",
);
const css = fs.readFileSync(cssPath, "utf8");

/** Top to bottom. The order IS the argument, so it is pinned. */
const STRATA = ["sky", "canopy", "branch", "trunk", "root", "soil"] as const;

/** Where the ink flips. Everything from here down is a dark surface. */
const DARK_STRATA = ["trunk", "root", "soil"] as const;
const LIGHT_STRATA = ["sky", "canopy", "branch"] as const;

function blockFor(stratum: string): string {
  const marker = `[data-strata="${stratum}"] {`;
  const at = css.indexOf(marker);
  expect(at, `no token block for the ${stratum} stratum`).toBeGreaterThan(-1);
  const end = css.indexOf("}", at);
  return css.slice(at, end);
}

/** #rrggbb -> relative luminance, the WCAG definition. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function tokenHex(stratum: string, token: string): string {
  const block = blockFor(stratum);
  const found = block.match(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, "i"));
  expect(found, `${stratum} declares no --${token}`).not.toBeNull();
  return found![1];
}

describe("the descent", () => {
  it("carries one continuous gradient on the body, not a colour per band", () => {
    // Eleven separately-coloured sections read as stacked bands. One gradient
    // behind transparent sections reads as a single move downward, which is the
    // whole effect.
    const body = css.slice(css.indexOf(".depth {"));
    expect(body.slice(0, 900)).toContain("linear-gradient(");
    // The static pages put it on <body>; the React pages cannot, because their
    // root layout owns <body> and is shared with pages that are not a descent.
    expect(body.slice(0, 300)).toContain("min-height: 100vh");
    expect(css).toContain("[data-strata] {");
    const shared = css.slice(css.indexOf("[data-strata] {"));
    expect(shared.slice(0, 200)).toContain("background: transparent");
  });

  it("never pins the gradient to the viewport", () => {
    // Pinning decouples the gradient from the scroll, which removes the
    // descent, and it is broken on iOS besides. The literal is assembled here
    // rather than written out, because this file is read as source by the very
    // assertion below and a comment naming it would fail its own guard.
    expect(css).not.toContain(["background", "attachment: fixed"].join("-"));
  });

  it("starts in the light and ends in the dark", () => {
    const sky = luminance(tokenHex("sky", "panel"));
    const soil = luminance(tokenHex("soil", "panel"));
    expect(sky).toBeGreaterThan(soil);
  });
});

describe("the strata", () => {
  it("declares every one of them", () => {
    for (const s of STRATA) {
      expect(css).toContain(`[data-strata="${s}"] {`);
    }
  });

  it("remaps the surface tokens rather than asking components to know their depth", () => {
    // This is the same mechanism the dashboard's `html.dark` layer uses. Without
    // it a white card renders on black soil and glares; with it, one attribute
    // on a <section> re-skins everything inside it.
    for (const s of STRATA) {
      const block = blockFor(s);
      for (const token of ["panel", "line", "text", "muted", "faint"]) {
        expect(block, `${s} is missing --${token}`).toContain(`--${token}:`);
      }
    }
  });

  it("flips the ink exactly once, at the trunk", () => {
    // A slow eleven-step fade reads as a bug. One decisive crossing reads as
    // going underground.
    for (const s of LIGHT_STRATA) {
      expect(
        luminance(tokenHex(s, "text")),
        `${s} should carry dark ink on a light surface`,
      ).toBeLessThan(0.2);
      expect(luminance(tokenHex(s, "panel"))).toBeGreaterThan(0.7);
    }
    for (const s of DARK_STRATA) {
      expect(
        luminance(tokenHex(s, "text")),
        `${s} should carry light ink on a dark surface`,
      ).toBeGreaterThan(0.7);
      expect(luminance(tokenHex(s, "panel"))).toBeLessThan(0.2);
    }
  });

  it("gets darker on the way down, never lighter", () => {
    const panels = STRATA.map((s) => luminance(tokenHex(s, "panel")));
    for (let i = 1; i < panels.length; i += 1) {
      expect(
        panels[i],
        `${STRATA[i]} is lighter than ${STRATA[i - 1]}`,
      ).toBeLessThanOrEqual(panels[i - 1]);
    }
  });
});

describe("the motifs", () => {
  it("can never eat a click or cover the content", () => {
    const motif = css.slice(css.indexOf("[data-strata]::before {"));
    const block = motif.slice(0, motif.indexOf("}"));
    expect(block).toContain("pointer-events: none");
    expect(block).toContain("z-index: -1");
  });

  it("costs no request, because the homepage carries its stylesheet inline", () => {
    expect(css).not.toContain("url(");
  });

  it("disappears under forced colours, where a decorative field means nothing", () => {
    expect(css).toContain("@media (forced-colors: active)");
  });
});

describe("the seed", () => {
  it("is the terminal call to action, and it glows in the dark", () => {
    const seed = css.slice(css.indexOf(".seed {"));
    expect(seed.slice(0, 700)).toContain("var(--sap)");
    expect(seed.slice(0, 700)).toContain("box-shadow");
  });

  it("stops moving for a reader who asked for that", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("the sap", () => {
  it("is the charter blue, unchanged at every depth", () => {
    // Green is retired fleet-wide. The accent is the one thing that connects
    // the seed to the fruit, so it must not shift stratum to stratum.
    expect(css).toContain("--sap: #2563eb");
    for (const s of STRATA) {
      expect(blockFor(s)).not.toContain("--sap:");
    }
  });

});
