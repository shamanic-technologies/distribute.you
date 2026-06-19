import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Onboarding mobile responsiveness", () => {
  const layout = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/onboarding/layout.tsx"),
    "utf-8",
  );
  const defaultFlow = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/default-onboarding.tsx"),
    "utf-8",
  );
  const betaFlow = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/beta-onboarding.tsx"),
    "utf-8",
  );

  it("top-aligns the onboarding shell on mobile so tall flows remain scrollable", () => {
    expect(layout).toContain("min-h-dvh");
    expect(layout).toContain("items-start");
    expect(layout).toContain("sm:items-center");
    expect(layout).toContain("min-w-0");
  });

  it("uses smaller mobile padding in the default onboarding cards", () => {
    expect(defaultFlow).toContain("px-5 py-4 sm:px-7 sm:py-7");
    expect(defaultFlow).toContain("p-5 sm:p-8 md:p-12");
    expect(defaultFlow).toContain("grid grid-cols-1 gap-4 sm:grid-cols-2");
  });

  it("keeps beta onboarding controls from forcing horizontal overflow", () => {
    expect(betaFlow).toContain("min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 md:p-12");
    expect(betaFlow).toContain("basis-full bg-transparent");
    expect(betaFlow).toContain("sm:min-w-[8rem] sm:basis-auto");
    expect(betaFlow).toContain("flex flex-col items-stretch gap-4");
    expect(betaFlow).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(betaFlow).toContain("grid gap-3 sm:grid-cols-2 lg:grid-cols-4");
  });
});
