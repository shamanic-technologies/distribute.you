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
    expect(onboardingFlow).toContain("mx-auto w-full max-w-4xl min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-8 md:p-12");
    expect(onboardingFlow).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3");
  });
});
