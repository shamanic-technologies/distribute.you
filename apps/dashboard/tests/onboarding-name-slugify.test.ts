import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: Onboarding name input must slugify user input into a valid
 * app name (lowercase alphanumeric with hyphens) before sending to the API.
 *
 * Bug: User typed "PressBeat.io" → sanitized to "pressbeat.io" (dot kept) → API
 * rejected with "App name must be lowercase alphanumeric with hyphens".
 *
 * Fix: Replace all non-alphanumeric characters (dots, spaces, etc.) with hyphens,
 * then strip leading/trailing hyphens.
 */

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

describe("Onboarding name slugification", () => {
  it("should convert 'PressBeat.io' to 'pressbeat-io'", () => {
    expect(slugify("PressBeat.io")).toBe("pressbeat-io");
  });

  it("should convert 'My Company Name' to 'my-company-name'", () => {
    expect(slugify("My Company Name")).toBe("my-company-name");
  });

  it("should convert 'Acme Inc.' to 'acme-inc'", () => {
    expect(slugify("Acme Inc.")).toBe("acme-inc");
  });

  it("should handle multiple special characters", () => {
    expect(slugify("Hello...World!!!")).toBe("hello-world");
  });

  it("should handle leading/trailing special characters", () => {
    expect(slugify("  --my-brand--  ")).toBe("my-brand");
  });

  it("should keep plain alphanumeric names as-is", () => {
    expect(slugify("acme")).toBe("acme");
  });
});

describe("Onboarding page uses correct slugification regex", () => {
  const pagePath = path.join(__dirname, "../src/app/onboarding/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should replace all non-alphanumeric chars, not just whitespace", () => {
    expect(content).toContain("[^a-z0-9]+");
    expect(content).not.toMatch(/replace\(\/\\s\+\/g/);
  });
});
