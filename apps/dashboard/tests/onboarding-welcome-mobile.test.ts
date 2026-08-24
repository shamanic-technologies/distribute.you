import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

const onboarding = read("src/components/onboarding/onboarding.tsx");
const layout = read("src/app/(authed)/onboarding/layout.tsx");

const sliceFrom = (src: string, marker: string, length: number) => {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return src.slice(at, at + length);
};

/**
 * Measured before this shipped, on the real markup: the "Get started" CTA sat
 * at 926px on a 375x667 screen, on a 390x844 one AND on a 412x915 one — below
 * the fold on every phone, with the three cards alone accounting for 528px.
 */
describe("the onboarding column has a definite height, so the CTA is pinned", () => {
  it("caps the mobile shell at the viewport", () => {
    // A min-height alone leaves the column free to grow past the viewport, so
    // the flex children divide the GROWN height, StepShell's scroller never
    // overflows, the page scrolls instead and the footer rides below the fold.
    expect(layout).toContain("max-h-[100svh]");
    expect(layout).toContain("overflow-hidden");
  });

  it("keeps the min-height the responsive guard pins", () => {
    expect(layout).toContain("min-h-[100svh]");
  });

  it("keeps the cap on the desktop floating card too", () => {
    // The cap used to be released at sm+ (`sm:max-h-none` / `sm:overflow-visible`)
    // on the theory that a hard cap would clip a tall step. What it actually did
    // was let a tall step run past the viewport and scroll the PAGE, which put the
    // Continue button below the fold on a desktop screen exactly the way it did on
    // a phone. The card takes the overflow instead (`sm:max-h-full` + StepShell's
    // internal scroller), so nothing clips and the CTA is always reachable.
    expect(layout).not.toContain("sm:max-h-none");
    expect(layout).not.toContain("sm:overflow-visible");
    expect(layout).toContain("sm:max-h-full");
  });
});

describe("the welcome step steps its sizes down on mobile", () => {
  const welcome = sliceFrom(onboarding, 'if (step === "welcome")', 3200);

  it("shrinks the headline", () => {
    expect(welcome).toContain("text-3xl font-bold leading-tight text-gray-950 sm:text-4xl");
  });

  it("shrinks the intro", () => {
    expect(welcome).toContain("text-sm leading-6 text-gray-500 sm:mt-3 sm:text-base sm:leading-7");
  });

  it("lays the three cards out as rows on mobile and stacks them from sm", () => {
    // The stacked form spends a whole 40px row on a decorative icon tile.
    expect(welcome).toContain("flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:block sm:p-6");
    expect(welcome).toContain("h-9 w-9 shrink-0");
    expect(welcome).toContain("sm:h-10 sm:w-10");
    expect(welcome).toContain("h-4 w-4 sm:h-5 sm:w-5");
  });

  it("tightens the grid and the CTA gap on mobile", () => {
    expect(welcome).toContain("mt-5 grid gap-2.5 sm:mt-7 sm:gap-4 sm:grid-cols-3");
    expect(welcome).toContain("mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600");
    expect(welcome).toContain("sm:mt-8");
  });

  it("keeps the copy the beta-onboarding guard pins", () => {
    expect(welcome).toContain("Sell like crazy, autonomously.");
    expect(welcome).toContain("We send, not you");
    expect(welcome).toContain("You set the ceiling");
    expect(welcome).toContain("Pause anytime");
  });
});

describe("the URL field asks for a URL", () => {
  it("shows a full URL in its placeholder", () => {
    expect(onboarding).toContain('placeholder="e.g. https://acme.com/pricing"');
  });
});
