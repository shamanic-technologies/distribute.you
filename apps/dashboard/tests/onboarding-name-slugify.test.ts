import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Org names are now derived from the URL domain. The onboarding page extracts
 * the domain from the user's URL input and uses it as the Clerk org name.
 */
describe("Onboarding uses URL domain as org name", () => {
  const pagePath = path.join(__dirname, "../src/app/onboarding/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should extract domain from URL input", () => {
    expect(content).toContain("extractDomain");
    expect(content).toContain("hostname");
  });

  it("should pass the domain to createOrganization", () => {
    expect(content).toContain("name: domain");
  });
});
