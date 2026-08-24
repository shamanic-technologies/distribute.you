import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Onboarding mobile responsiveness", () => {
  const layout = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/onboarding/layout.tsx"),
    "utf-8",
  );
  const onboardingFlow = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
    "utf-8",
  );

  it("full-bleeds + stretches the onboarding shell on mobile, centers it on sm+", () => {
    // Mobile app-shell column: 100svh (iOS address bar can't eat the pinned CTA),
    // a slim in-flow top bar (shrink-0), then a flex-1 body. No side gutters,
    // items-stretch so the step (StepShell) fills the body. sm+: centered card.
    expect(layout).toContain("min-h-[100svh]");
    expect(layout).toContain("flex-col");
    expect(layout).toContain("items-stretch");
    expect(layout).toContain("sm:items-center");
    expect(layout).toContain("sm:px-4 sm:py-6");
    // `sm:max-h-full` is what lets the step's card take the overflow at desktop
    // width instead of the page scrolling and burying the CTA.
    expect(layout).toContain("flex w-full min-w-0 max-w-5xl flex-1 flex-col sm:max-h-full sm:flex-none");
    // The old top-aligned, side-padded mobile shell is gone.
    expect(layout).not.toContain("items-start");
    expect(layout).not.toContain("px-3 py-4");
    // No dvh — svh only (the iOS Safari address-bar fix).
    expect(layout).not.toContain("min-h-dvh");
  });

  it("StepShell fills the body on mobile (pinned CTA) and a floating card on sm+", () => {
    // Mobile: flex-1 under the layout's 100svh column, header pinned top, CTA
    // pinned bottom, only the middle content scrolls (overflow-y-auto). sm+: card.
    expect(onboardingFlow).toContain("function StepShell");
    expect(onboardingFlow).toContain("flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mx-auto sm:min-h-0 sm:flex-none sm:gap-3");
    // The desktop cap is a VIEWPORT-unit max-height on the card, not a percentage
    // one: `max-h-full` resolves against an indefinite parent height here and
    // applies to nothing (measured: the card overflowed the column and its header
    // sat at -179px). Keeping it definite is what lets the scroller take over.
    expect(onboardingFlow).toContain("sm:max-h-[calc(100svh-8rem)] sm:flex-none sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-sm");
    // The scroller runs at EVERY width now — at sm+ it used to be released
    // (`sm:overflow-visible`), which is what let a tall step push its CTA below
    // the fold on desktop. The card is capped at the viewport, so this region
    // takes the overflow and the footer stays pinned to the card's bottom edge.
    expect(onboardingFlow).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(onboardingFlow).not.toContain("sm:flex-none sm:overflow-visible");
    // No 100dvh anywhere in the shell (svh via the layout column).
    expect(onboardingFlow).not.toContain("min-h-[100dvh]");
    // Every step routes through the shared shell (no inline card wrappers left).
    // The count dropped from 20 when the brand-level steps (destination / objective
    // / rates / ltr) went with the flow that asked them.
    const shellUses = onboardingFlow.match(/<StepShell/g) ?? [];
    expect(shellUses.length).toBe(16);
    // The first-run account widget rides the step's own header row on mobile
    // instead of a bar of its own above the Brand card, so a step with a header
    // spends one row where it used to spend two. Gated on the escape chrome not
    // already showing one.
    expect(onboardingFlow).toContain("useOnboardingEscapeChrome");
    expect(onboardingFlow).toContain("const showWidget = !escapeChrome;");
    expect(onboardingFlow).toContain("flex shrink-0 items-center gap-2 px-3 pt-3 sm:px-0 sm:pt-0");
    expect(onboardingFlow).toContain("<OnboardingAccountWidget />");
    // The removed per-step card constants must not return.
    expect(onboardingFlow).not.toContain("className={card}");
    expect(onboardingFlow).not.toContain("cardWide");
    expect(onboardingFlow).not.toContain("cardNarrow");
  });

  it("keeps onboarding controls from forcing horizontal overflow", () => {
    expect(onboardingFlow).toContain("basis-full bg-transparent");
    expect(onboardingFlow).toContain("sm:min-w-[8rem] sm:basis-auto");
    // The stacked-on-mobile rate rows went with the rates / lifetime-revenue steps;
    // the funnel screens stack their fields by default (flex-col, full-width inputs).
    expect(onboardingFlow).toContain("w-full min-w-0 bg-transparent");
    // The four-up tier grid went with the single pot it priced. The funding rows
    // stack by default and keep their input on the same line at every width.
    expect(onboardingFlow).toContain("flex shrink-0 items-baseline gap-1 rounded-lg");
  });

  it("gives generated audience cards equal-width rows up to three columns", () => {
    // Audience shell width caps at sm+ only (mobile stays full-bleed via StepShell).
    expect(onboardingFlow).toContain('>= 3 ? "sm:max-w-5xl"');
    expect(onboardingFlow).toContain('=== 2 ? "sm:max-w-3xl" : "sm:max-w-xl"');
    // Column count follows the card count, so a single card spans the full shell
    // (grid-cols-1) instead of a 1/3-wide column at desktop width.
    expect(onboardingFlow).toContain('candidateCount >= 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : candidateCount === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"');
    expect(onboardingFlow).toContain("grid gap-3 ${audienceGridCols}");
    expect(onboardingFlow).toContain("flex w-full items-start gap-3 rounded-xl border-2");
  });

  it("routes the services step through StepShell (only welcome uses the wide shell)", () => {
    expect(onboardingFlow).toContain('What services do you want to promote with us?');
    // welcome is the only sm:max-w-5xl step shell.
    const wideShell = onboardingFlow.match(/maxWidth="sm:max-w-5xl"/g) ?? [];
    expect(wideShell.length).toBe(1);
  });
});
