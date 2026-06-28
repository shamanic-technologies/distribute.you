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
    // Mobile: no side gutters, items-stretch so the step (StepShell) fills the
    // viewport edge-to-edge. sm+: the centered, padded floating-card frame returns.
    expect(layout).toContain("min-h-dvh");
    expect(layout).toContain("items-stretch");
    expect(layout).toContain("sm:items-center");
    expect(layout).toContain("sm:px-4 sm:py-6");
    expect(layout).toContain("w-full max-w-5xl min-w-0");
    // The old top-aligned, side-padded mobile shell is gone.
    expect(layout).not.toContain("items-start");
    expect(layout).not.toContain("px-3 py-4");
  });

  it("StepShell makes each step full-screen on mobile and a floating card on sm+", () => {
    // Mobile: min-h-[100dvh] flex column, header pinned top, CTA pinned bottom,
    // only the middle content scrolls (overflow-y-auto). sm+: card chrome returns.
    expect(onboardingFlow).toContain("function StepShell");
    expect(onboardingFlow).toContain("flex min-h-[100dvh] w-full min-w-0 flex-col sm:mx-auto sm:min-h-0 sm:gap-3");
    expect(onboardingFlow).toContain("sm:flex-none sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-sm");
    expect(onboardingFlow).toContain("min-h-0 flex-1 overflow-y-auto sm:flex-none sm:overflow-visible");
    // 12 steps all route through the shared shell (no inline card wrappers left).
    const shellUses = onboardingFlow.match(/<StepShell/g) ?? [];
    expect(shellUses.length).toBe(12);
    // The removed per-step card constants must not return.
    expect(onboardingFlow).not.toContain("className={card}");
    expect(onboardingFlow).not.toContain("cardWide");
    expect(onboardingFlow).not.toContain("cardNarrow");
  });

  it("keeps onboarding controls from forcing horizontal overflow", () => {
    expect(onboardingFlow).toContain("basis-full bg-transparent");
    expect(onboardingFlow).toContain("sm:min-w-[8rem] sm:basis-auto");
    expect(onboardingFlow).toContain("flex flex-col items-stretch gap-4");
    expect(onboardingFlow).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(onboardingFlow).toContain("grid gap-3 sm:grid-cols-2 lg:grid-cols-4");
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
