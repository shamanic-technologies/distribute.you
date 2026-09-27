import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
const menus = read("components/v2/sidebar-menus.tsx");
const modal = read("components/v2/new-org-modal.tsx");
const api = read("lib/api.ts");

describe("v2 New organization opens the modal, never the full-page onboarding", () => {
  it("the v2 menu entry mounts NewOrgModal and no longer routes to /onboarding?new=1", () => {
    expect(menus).toContain("<NewOrgModal");
    expect(menus).toContain("setNewOrgOpen(true)");
    expect(menus).not.toContain('router.push("/onboarding?new=1&from=add")');
  });
});

describe("the modal acts on the org it created, not the one the URL names", () => {
  it("the api client carries an explicit override the proxy compares", () => {
    expect(api).toContain("export function setApiActiveOrgOverride");
    expect(api).toContain("if (activeOrgOverride) return activeOrgOverride;");
  });
  it("the modal sets it once the org exists and clears it on close and on launch", () => {
    expect(modal).toContain("setApiActiveOrgOverride(org.id)");
    expect((modal.match(/setApiActiveOrgOverride\(null\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it("closing early hands the session back to the org the page behind is on", () => {
    const close = modal.slice(modal.indexOf("async function close()"), modal.indexOf("async function run("));
    expect(close).toContain("setActive({ organization: returnOrgId })");
    expect(close).toContain("getToken({ skipCache: true })");
  });
});

describe("the launch", () => {
  const launch = modal.slice(modal.indexOf("function launch()"), modal.indexOf("if (!open) return null;"));
  it("creates the kept audiences, funds the campaign on billing's (offer, leg, channel) row, then creates it", () => {
    const a = launch.indexOf("confirmAudienceSegments(");
    const b = launch.indexOf("saveCampaignBudget(");
    const c = launch.indexOf("createCampaignWithoutBrandEnrichment(");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
  it("marks the org set up only after the campaign exists, then re-mints the token", () => {
    const c = launch.indexOf("createCampaignWithoutBrandEnrichment(");
    const done = launch.indexOf('"/api/onboarding/complete"');
    const mint = launch.indexOf("getToken({ skipCache: true })", done);
    expect(done).toBeGreaterThan(c);
    expect(mint).toBeGreaterThan(done);
  });
  it("ends on the new campaign's mission page", () => {
    expect(launch).toContain("v2MissionHref(orgId!, id, campaign.id)");
  });
});

describe("Keel, not v1", () => {
  it("uses no raw greys, brand-50 fills, bordered cards or em-dashes", () => {
    for (const src of [modal, read("components/v2/new-org-icons.tsx")]) {
      expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|bg-black\//);
      expect(src).not.toContain("—");
    }
  });
  it("portals to the v2 layer", () => {
    expect(modal).toContain('document.getElementById("v2-portal")');
  });
});
