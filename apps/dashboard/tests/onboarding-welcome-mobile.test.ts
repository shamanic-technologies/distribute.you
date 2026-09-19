import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

const onboarding = read("src/components/onboarding/onboarding.tsx");
const layout = read("src/app/(authed)/onboarding/layout.tsx");

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

// The welcome step moved to the sell-first screens (`start-picks.tsx`), which
// draw their own shell; its mobile sizing is theirs. The URL step is still the
// wizard's own.
describe("the URL field asks for a URL", () => {
  it("shows a full URL in its placeholder", () => {
    expect(onboarding).toContain('placeholder="e.g. https://acme.com/pricing"');
  });
});
