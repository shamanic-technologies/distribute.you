import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("sidebar Leads found shows the people its page counts (owner 2026-10-11)", () => {
  const shell = read("src/components/v2/v2-shell.tsx");
  const page = read("src/components/v2/audience-page.tsx");
  const hook = read("src/components/v2/brand-outcomes.ts");

  it("one snapshot read serves both the page and the sidebar", () => {
    expect(hook).toContain('["staffAudienceSnapshot", brandId, staff]');
    expect(page).toContain("useAudienceSnapshot(brandId)");
    expect(page).not.toContain('useAuthQuery(["staffAudienceSnapshot"');
  });

  it("the Leads found entry's count is the People tab figure (people held)", () => {
    expect(shell).toContain("useAudienceSnapshot(brandId, leadsFoundListed).data?.totals.people.held");
    const at = shell.indexOf("{outcomes.map(");
    const block = shell.slice(at, shell.indexOf("</Group>", at));
    expect(block).toContain('outcome.items.kind === "leads-found"');
    expect(block).toContain("? peopleHeld");
    expect(page).toContain("count: totals?.people.held");
  });
});
