import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Org names are now display names (not slugs). The onboarding page sends
 * the user's input as-is via createOrg() — no client-side slugification.
 *
 * Previous behavior: client slugified the name before sending to /apps/register.
 * New behavior: name.trim() is sent directly; the backend handles any normalization.
 */
describe("Onboarding sends org name as display name (no slugification)", () => {
  const pagePath = path.join(__dirname, "../src/app/onboarding/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should NOT slugify the name before sending", () => {
    // No slug regex patterns
    expect(content).not.toContain("[^a-z0-9]+");
    expect(content).not.toMatch(/replace\(\/\[.+\]\/g/);
  });

  it("should call createOrg with the trimmed name", () => {
    expect(content).toContain("createOrg(token, name.trim())");
  });
});
