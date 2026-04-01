import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign creation redirects to the new campaign page", () => {
  const rel =
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx";
  const content = fs.readFileSync(path.join(__dirname, rel), "utf-8");

  it("navigates to the created campaign's detail page, not the feature page", () => {
    // Every router.push after campaign creation must include the campaign id
    const pushCalls = [...content.matchAll(/router\.push\(`[^`]*`\)/g)].map(
      (m) => m[0],
    );
    expect(pushCalls.length).toBeGreaterThan(0);

    for (const call of pushCalls) {
      expect(call).toContain("result.campaign.id");
    }
  });
});
