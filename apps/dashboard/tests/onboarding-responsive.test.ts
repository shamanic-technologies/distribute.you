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
    expect(layout).toContain("flex w-full min-w-0 max-w-6xl flex-1 flex-col sm:max-h-full sm:flex-none");
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
    // ONE shell for the whole flow: every wizard step renders through the
    // sell-first screens' StartShell, which carries the mobile column and the
    // viewport-unit desktop cap (a percentage max-height resolves against an
    // indefinite parent here and applies to nothing).
    const shell = onboardingFlow.slice(onboardingFlow.indexOf("function StepShell("), onboardingFlow.indexOf("function BackButton("));
    expect(shell).toContain("<StartShell");
    expect(shell).toContain("stepLabels={START_STEP_LABELS}");
    const startShell = fs.readFileSync(path.resolve(__dirname, "../src/components/start/start-shell.tsx"), "utf8");
    expect(startShell).toContain("flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mx-auto sm:min-h-0 sm:flex-none sm:gap-4 sm:max-w-6xl sm:px-4");
    expect(startShell).toContain("sm:max-h-[calc(100svh-11rem)] sm:flex-none sm:rounded-3xl sm:border sm:border-gray-200");
    // The scroller runs at EVERY width now — at sm+ it used to be released
    // (`sm:overflow-visible`), which is what let a tall step push its CTA below
    // the fold on desktop. The card is capped at the viewport, so this region
    // takes the overflow and the footer stays pinned to the card's bottom edge.
    expect(startShell).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(onboardingFlow).not.toContain("sm:flex-none sm:overflow-visible");
    // No 100dvh anywhere in the shell (svh via the layout column).
    expect(onboardingFlow).not.toContain("min-h-[100dvh]");
    // Every step routes through the shared shell (no inline card wrappers left).
    // The count dropped from 20 when the brand-level steps (destination / objective
    // / rates / ltr) went with the flow that asked them, and rose to 17 with the
    // `built` step — what we assembled, stated back before anyone is asked for an
    // account. ⚠️ This is a count over the WHOLE file, so it goes red on any step
    // added or removed; what it is actually asserting is that no step renders its
    // own card wrapper. Re-count it, do not delete it.
    const shellUses = onboardingFlow.match(/<StepShell/g) ?? [];
    // 16 since the welcome moved to the sell-first screens (StartPicks draws its
    // own shell); 12 since the per-funnel rate screens and the best-model step
    // went with the post-payment trim, and the funnel step and the primary pick went (the Path
    // screen states the set).
    expect(shellUses.length).toBe(12);
    // The first-run account widget rides the step's own header row on mobile
    // instead of a bar of its own above the Brand card, so a step with a header
    // spends one row where it used to spend two. Gated on the escape chrome not
    // already showing one.
    expect(onboardingFlow).toContain("useOnboardingEscapeChrome");
    expect(onboardingFlow).toContain("const showWidget = !escapeChrome;");
    expect(onboardingFlow).toContain("mb-4 flex shrink-0 items-center gap-2");
    expect(onboardingFlow).toContain("<OnboardingAccountWidget />");
    // The removed per-step card constants must not return.
    expect(onboardingFlow).not.toContain("className={card}");
    expect(onboardingFlow).not.toContain("cardWide");
    expect(onboardingFlow).not.toContain("cardNarrow");
  });

  it("keeps onboarding controls from forcing horizontal overflow", () => {
    expect(onboardingFlow).toContain("basis-full bg-transparent");
    expect(onboardingFlow).toContain("sm:min-w-[8rem] sm:basis-auto");
    // The stacked-on-mobile rate rows went with the rates / lifetime-revenue
    // steps, and the per-funnel screens that replaced them went with the
    // post-payment trim — so the flow carries no rate field at all now.
    expect(onboardingFlow).not.toContain("<RateInput");
    // The four-up tier grid went with the single pot it priced. The funding rows
    // stack by default and keep their input on the same line at every width.
    expect(onboardingFlow).toContain("flex shrink-0 items-baseline gap-1 rounded-lg");
  });

  it("keeps the audience step on the narrow shell: one box, no card grid", () => {
    // The audience step is a single target-audience textarea (the audiences are
    // built by hand after payment), so there is no card grid to widen for.
    const step = onboardingFlow.slice(onboardingFlow.indexOf("function OnboardingAudiences("), onboardingFlow.indexOf("function BrandStepHeader("));
    expect(step).toContain('maxWidth="sm:max-w-xl"');
    expect(step).not.toContain("audienceGridCols");
    expect(step).not.toContain("sm:max-w-5xl");
  });

  it("routes the services step through StepShell (no step widens the card to the bar)", () => {
    expect(onboardingFlow).toContain('What services do you want to promote with us?');
    // The welcome moved to the sell-first screens, which draw their own shell;
    // no wizard step asks for the bar-wide card any more.
    const wideShell = onboardingFlow.match(/maxWidth="sm:max-w-5xl"/g) ?? [];
    expect(wideShell.length).toBe(0);
  });
});
