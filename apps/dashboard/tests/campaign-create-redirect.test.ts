import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Launch redirects back to the brand overview with the launched marker", () => {
  const rel =
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/launch/page.tsx";
  const content = fs.readFileSync(path.join(__dirname, rel), "utf-8");

  it("navigates to the brand overview carrying the created campaign id", () => {
    // Every router.push after launch must include the campaign id (now as the
    // `?launched=<id>` marker on the brand overview, which mounts the modal).
    const pushCalls = [...content.matchAll(/router\.push\(`[^`]*`\)/g)].map(
      (m) => m[0],
    );
    expect(pushCalls.length).toBeGreaterThan(0);

    for (const call of pushCalls) {
      expect(call).toContain("result.campaign.id");
    }
  });
});
