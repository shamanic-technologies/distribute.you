import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

// A mission's Audiences tab: the campaign-scoped audience table v1 had, in the v2 frame.
// The route carries no offer segment, so the page must hand the table the mission's own
// offer, or it lists every audience of the brand under one mission.
describe("dashboard v2 mission Audiences tab", () => {
  const setup = read("src/components/v2/setup-pages.tsx");

  it("every mission surface offers the tab, ungated", () => {
    const fn = setup.slice(setup.indexOf("export function missionTabs("), setup.indexOf("export function V2MissionSettingsPage("));
    expect(fn).toContain('label: "Audiences"');
    expect(fn).toContain("`${base}/audiences`");
    expect(fn).not.toMatch(/isBeta\)\s*tabs\.push\(\{\s*label: "Audiences"/);
  });

  it("the page scopes the table to the campaign AND its offer", () => {
    const page = setup.slice(setup.indexOf("export function V2MissionAudiencesPage("), setup.indexOf("export function V2MissionWorkflowsPage("));
    expect(page).toContain('missionTabs(orgId, brandId, campaignId, "audiences", staffMode)');
    // v2 draws the table in its own anatomy (`V2AudiencesTable`), over v1's data layer.
    const call = page.slice(page.indexOf("<V2AudiencesTable"));
    expect(call).toContain("campaignId={");
    expect(call).toContain("offerId={offerId}");
  });

  it("the table takes the offer as a prop before falling back to the route", () => {
    const src = read("src/components/audiences/customer-audiences-page.tsx");
    expect(src).toContain("const offerId = offerIdProp ?? (params.offerId as string | undefined);");
  });

  it("the route exists and v1's campaign Audiences lands on it", () => {
    expect(existsSync(resolve(ROOT, "src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/missions/[campaignId]/audiences/page.tsx"))).toBe(true);
    expect(read("src/lib/ui-version.ts")).toContain('if (e === "audiences" && rest.length === 5) return withQuery(`${mission}/audiences`);');
  });
});
