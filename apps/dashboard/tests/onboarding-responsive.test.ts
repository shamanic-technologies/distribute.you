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

  it("top-aligns the onboarding shell on mobile so tall flows remain scrollable", () => {
    expect(layout).toContain("min-h-dvh");
    expect(layout).toContain("items-start");
    expect(layout).toContain("sm:items-center");
    expect(layout).toContain("min-w-0");
  });

  it("keeps onboarding controls from forcing horizontal overflow", () => {
    expect(onboardingFlow).toContain("min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-8 md:p-12");
    expect(onboardingFlow).toContain("basis-full bg-transparent");
    expect(onboardingFlow).toContain("sm:min-w-[8rem] sm:basis-auto");
    expect(onboardingFlow).toContain("flex flex-col items-stretch gap-4");
    expect(onboardingFlow).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(onboardingFlow).toContain("grid gap-3 sm:grid-cols-2 lg:grid-cols-4");
  });

  it("gives generated audience cards equal-width rows up to three columns", () => {
    expect(layout).toContain("w-full max-w-5xl min-w-0");
    expect(onboardingFlow).toContain('>= 3 ? "max-w-5xl"');
    expect(onboardingFlow).toContain('=== 2 ? "max-w-3xl" : "max-w-xl"');
    expect(onboardingFlow).toContain("mx-auto w-full ${audienceShellWidth} min-w-0 flex flex-col gap-3");
    // Column count follows the card count, so a single card spans the full shell
    // (grid-cols-1) instead of a 1/3-wide column at desktop width.
    expect(onboardingFlow).toContain('candidateCount >= 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : candidateCount === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"');
    expect(onboardingFlow).toContain("grid gap-3 ${audienceGridCols}");
    expect(onboardingFlow).toContain("flex w-full items-start gap-3 rounded-xl border-2");
  });
});
