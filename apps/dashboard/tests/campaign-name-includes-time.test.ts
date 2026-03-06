import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("All campaign creation pages include time in the campaign name", () => {
  const campaignCreatePages = [
    "../src/app/(dashboard)/features/[featureId]/new/page.tsx",
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/new/page.tsx",
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/campaigns/new/page.tsx",
  ];

  for (const rel of campaignCreatePages) {
    const short = rel.replace("../src/app/(dashboard)/", "");

    it(`${short} should include toLocaleTimeString in the campaign name`, () => {
      const content = fs.readFileSync(path.join(__dirname, rel), "utf-8");

      // Find the line that sets the campaign name
      const nameLines = content
        .split("\n")
        .filter((l) => l.includes("name:") && l.includes("toLocaleDateString"));

      expect(nameLines.length).toBeGreaterThan(0);

      for (const line of nameLines) {
        expect(line).toContain("toLocaleTimeString");
      }
    });
  }
});
