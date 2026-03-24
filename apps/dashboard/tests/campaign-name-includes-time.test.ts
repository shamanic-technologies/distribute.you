import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("All campaign creation pages include time in the campaign name", () => {
  const campaignCreatePages = [
    "../src/app/(dashboard)/features/[featureId]/new/page.tsx",
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/new/page.tsx",
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
  ];

  for (const rel of campaignCreatePages) {
    const short = rel.replace("../src/app/(dashboard)/", "");

    it(`${short} should include toLocaleTimeString in the campaign name`, () => {
      const content = fs.readFileSync(path.join(__dirname, rel), "utf-8");

      // The name generation may be inline or in a helper function — just check
      // that both date and time formatting are present in the file
      expect(content).toContain("toLocaleDateString");
      expect(content).toContain("toLocaleTimeString");
    });
  }
});
