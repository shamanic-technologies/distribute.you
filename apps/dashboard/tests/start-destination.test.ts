import { describe, expect, it } from "vitest";
import { startDestination } from "../src/lib/start-destination";

describe("startDestination", () => {
  it("sends a visitor to onboarding v2", () => {
    expect(startDestination(null)).toBe("/get-started");
    expect(startDestination("lp_variant=control; a=b")).toBe("/get-started");
  });

  it("keeps the $99/month arm on /onboarding until v2 sells the plan", () => {
    expect(startDestination("a=b; lp_variant=subscription")).toBe("/onboarding");
  });
});
