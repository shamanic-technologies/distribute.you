import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign creation pages guard against double-submit", () => {
  const campaignCreatePages = [
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/new/page.tsx",
  ];

  for (const rel of campaignCreatePages) {
    const short = rel.replace("../src/app/(dashboard)/", "");
    const content = fs.readFileSync(path.join(__dirname, rel), "utf-8");

    it(`${short} uses a ref guard to prevent double-submit`, () => {
      // The ref must be checked synchronously before any async work
      expect(content).toContain("isCreatingRef.current");
      expect(content).toContain("if (isCreatingRef.current) return");
    });

    it(`${short} includes milliseconds in the campaign name for uniqueness`, () => {
      expect(content).toContain("getMilliseconds");
    });

    it(`${short} retries on 409 with a fresh timestamp`, () => {
      // The handler should catch a 409 and retry with a new name
      expect(content).toContain("firstErr.status === 409");
    });
  }
});
