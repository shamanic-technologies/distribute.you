import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ONE brand flow (owner 2026-10-05, Steady Recruit: the dashboard's "Add a brand" modal
 * felt like a different, worse product). "Add a brand", "New brand" and "Finish setup"
 * run the `/get-started` screens, signed in, on `/v2/orgs/:orgId/new-brand`; "New
 * organization" only names the org, then lands on that same walk.
 */
const SRC = join(__dirname, "../src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
const menus = read("components/v2/sidebar-menus.tsx");
const picker = read("components/v2/brand-picker.tsx");
const walk = read("components/v2/get-started/get-started.tsx");
const end = read("components/v2/get-started/org-launch.tsx");
const newOrg = read("components/v2/new-organization-modal.tsx");
const page = read("app/(authed)/v2/orgs/[orgId]/new-brand/page.tsx");
const overlay = read("components/v2/brand-walk.tsx");
const routes = read("lib/v2/routes.ts");
const api = read("lib/api.ts");
const proxy = read("proxy.ts");

describe("one flow: the old setup modal is gone", () => {
  it("new-org-modal.tsx and its draft no longer exist, nothing imports them", () => {
    expect(existsSync(join(SRC, "components/v2/new-org-modal.tsx"))).toBe(false);
    expect(existsSync(join(SRC, "lib/v2/new-org-draft.ts"))).toBe(false);
    for (const src of [menus, picker, walk, end, newOrg]) {
      expect(src).not.toContain("new-org-modal");
      expect(src).not.toContain("NewOrgModal");
    }
  });
  it("the dashboard route renders the SAME walk component, never on the public URL", () => {
    expect(routes).toContain("/new-brand`");
    expect(page).toContain("<BrandWalk orgId={orgId}");
    expect(overlay).toContain('import { GetStarted } from "@/components/v2/get-started/get-started";');
    expect(overlay).toContain("<GetStarted key={`${orgId}:${brandId ?? \"\"}`} org={{ orgId, brandId }} />");
    expect(overlay).toContain('document.getElementById("v2-portal")');
    expect(overlay).not.toMatch(/["']\/get-started/);
  });
});

describe("the entries open the walk", () => {
  it("New brand in the menu opens the walk on this org", () => {
    expect(menus).toContain("router.push(v2NewBrandHref(t.orgId))");
  });
  it("New organization only names the org, credits its bonus, then NAVIGATES to its walk", () => {
    expect(menus).toContain("<NewOrganizationModal");
    expect(menus).toContain("setNewOrg(true)");
    const body = newOrg.slice(newOrg.indexOf("async function submitOrg("));
    const bonus = body.indexOf('"/api/orgs/creation-bonus"');
    const nav = body.indexOf("window.location.assign(v2NewBrandHref(id))");
    expect(bonus).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(bonus);
    // A full navigation, never setActive: setActive would refresh the current page under
    // a not-yet-set-up org and the edge gate would bounce it.
    expect(newOrg).not.toContain("setActive(");
    expect(body).toContain("organizationId: id");
  });
  it("the org page: Add a brand opens the walk, an unfinished brand resumes in it (Finish setup)", () => {
    expect(picker).toContain("Add a brand");
    expect(picker).toContain("router.push(v2NewBrandHref(orgId))");
    expect(picker).toContain("href={v2NewBrandHref(orgId, b.id)}");
    expect(picker).toContain("Finish setup");
  });
});

describe("the walk acts on the org it names, explicitly", () => {
  it("the api client carries an explicit override and mints a token FOR that org", () => {
    expect(api).toContain("export function setApiActiveOrgOverride");
    expect(api).toContain("if (activeOrgOverride) return activeOrgOverride;");
    expect(api).toContain("organizationId: activeOrgOverride");
  });
  it("the walk sets the override for its org before any read, and clears it on unmount", () => {
    const fn = walk.slice(walk.indexOf("export function GetStarted("));
    const set = fn.indexOf("setApiActiveOrgOverride(org.orgId);");
    expect(set).toBeGreaterThan(-1);
    expect(fn).toContain("return () => setApiActiveOrgOverride(null);");
    // Declared before the snapshot read and the catalogue read (effects run in order).
    expect(set).toBeLessThan(fn.indexOf("localStorage.getItem(snapshotKey)"));
    expect(set).toBeLessThan(fn.indexOf("void loadCatalogue();"));
  });
  it("never starts an anonymous session from the dashboard", () => {
    const start = walk.slice(walk.indexOf("async function start(raw: string)"));
    expect(start.indexOf("if (!org) {")).toBeLessThan(start.indexOf("startAnonSession(url)"));
  });
  it("a dashboard walk is not a landing visit (the owner's visit recap reads that event)", () => {
    expect(walk).toContain('if (org) posthog.capture("brand_walk_website_submitted"');
  });
});

describe("the edge lets a not-yet-set-up org reach its walk", () => {
  it("exempts the bare org page and the walk, nothing deeper", () => {
    const gate = proxy.slice(proxy.indexOf("const v2OrgRoot ="), proxy.indexOf("return NextResponse.redirect(new URL(onboardingHref(), req.url));", proxy.indexOf("const v2OrgRoot =")));
    expect(gate).toContain("/^(\\/v2)?\\/orgs\\/[^/]+\\/?$/");
    expect(gate).toContain("/^\\/v2\\/orgs\\/[^/]+\\/new-brand\\/?$/");
    expect(gate).toContain("!v2OrgRoot &&");
    expect(gate).toContain("!v2BrandWalk &&");
  });
});

describe("resume after a reload or a quit, per org", () => {
  it("keeps the snapshot per org and resumes it at once (no wait for a signed-out Clerk)", () => {
    expect(walk).toContain("const snapshotKey = org ? getStartedOrgSnapshotKey(org.orgId) : GET_STARTED_SNAPSHOT_KEY;");
    const eff = walk.slice(walk.indexOf("localStorage.getItem(snapshotKey)"), walk.indexOf("if (!snap) return;"));
    expect(eff).toContain("snapshotResumable(snap, Date.now(), GET_STARTED_ORG_RESUME_MAX_AGE_MS)");
    expect(eff).toContain("resumePreparing(snap);");
    // Finish setup names its brand: another brand's snapshot is not resumed for it.
    expect(eff).toContain("snap.brandId === org.brandId");
    expect(eff).toContain("void startExisting(org.brandId)");
  });
  it("a brand that already holds offers picks among them: never proposed or confirmed a second one", () => {
    const prep = walk.slice(walk.indexOf("async function prepareOffers("), walk.indexOf("async function prepareAudiences("));
    expect(prep.indexOf("await listBrandOffers(id)")).toBeGreaterThan(-1);
    expect(prep.indexOf("await listBrandOffers(id)")).toBeLessThan(prep.indexOf("proposeBrandOffers("));
    const pick = walk.slice(walk.indexOf("function pickOffer("), walk.indexOf("async function draftAnswers("));
    expect(pick).toContain("held ? { chosenOfferId: held.offerId } : await confirmBrandOffers(id, [picked], 0)");
  });
  it("Start a new brand drops this org's saved walk", () => {
    const bar = walk.slice(walk.indexOf("function OrgBar("), walk.indexOf("const settled = settledPhase;"));
    expect(bar).toContain("localStorage.removeItem(snapshotKey)");
    expect(bar).toContain("Start a new brand");
  });
});

describe("the end: Choose your plan, then the walk's own launch", () => {
  const launch = end.slice(end.indexOf("async function launch("), end.indexOf("  return (\n"));
  it("the dashboard walk opens Choose your plan, never the account/phone/card wall", () => {
    expect(walk).toContain("<OrgLaunch");
    expect(walk).toContain("launchCampaigns.length > 0 && !org && (\n        <AccountCardWall");
    expect(end).toContain("<ChoosePlanPanel");
    // An org that already pays launches on what it has; one with no card chooses a plan.
    expect(end).toContain('setStage(a.has_payment_method ? "ready" : "plan");');
  });
  it("launches through launchFromPreview, then marks the org set up with a token minted FOR it", () => {
    const l = launch.indexOf("await launchFromPreview(");
    const done = launch.indexOf('"/api/onboarding/complete"');
    expect(l).toBeGreaterThan(-1);
    expect(done).toBeGreaterThan(l);
    expect(launch).toContain("getToken({ organizationId: orgId, skipCache: true })");
    expect(launch).toContain("Authorization: `Bearer ${orgToken}`");
  });
  it("never makes the org active before it is marked set up, then re-mints the token", () => {
    const setActives = [...end.matchAll(/setActive\(\{ organization/g)].map((m) => m.index!);
    expect(setActives).toHaveLength(1);
    expect(setActives[0]).toBeGreaterThan(end.indexOf('"/api/onboarding/complete"'));
    expect(launch.indexOf("getToken({ skipCache: true })")).toBeGreaterThan(launch.indexOf("setActive({ organization: orgId })"));
  });
  it("ends on the new campaign's page and clears the saved walk", () => {
    expect(launch).toContain("localStorage.removeItem(snapshotKey)");
    expect(launch).toContain("window.location.assign(v2CampaignHref(orgId, brandId, campaignId))");
  });
  it("declares Revolut before the first card form, on the org it acts on", () => {
    expect(end).toContain("beforeCard={declareRevolut}");
    const dec = end.slice(end.indexOf("async function declareRevolut("), end.indexOf("async function launch("));
    expect(dec).toContain('"/api/orgs/revolut"');
    expect(dec).toContain("organizationId: orgId");
  });
  it("Try again replays the launch without re-sending what landed", () => {
    expect(end).toContain("const progress = useRef<LaunchProgress>(");
    expect(end).toContain("Try again");
  });
});

describe("the org creation bonus", () => {
  const route = readFileSync(join(__dirname, "../src/app/(authed)/api/orgs/creation-bonus/route.ts"), "utf8");
  it("credits the org the session is scoped to, never one the client names", () => {
    expect(route).toContain("await auth()");
    expect(route).not.toContain("req.json(");
    expect(route).toContain("grantOrgCreationBonus(identity.orgId)");
  });
  it("only credits an org created within the hour", () => {
    expect(route).toContain("CREATION_WINDOW_MS");
    expect(route).toContain("org.createdAt");
  });
});

describe("an org that is not set up yet", () => {
  const orgPage = read("app/(authed)/v2/orgs/[orgId]/page.tsx");
  const shell = read("components/v2/v2-shell.tsx");
  it("never redirects to a brand page (the edge gate would bounce it)", () => {
    expect(orgPage).toContain("if (last && setUp) redirect(");
    expect(orgPage).toContain("onboardingComplete === true");
  });
  it("a set-up org with one brand skips the picker, never an org still in setup", () => {
    expect(picker).toContain("setUp && brands !== null && brands.length === 1 ? brands[0].id : null");
    expect(picker).toContain("router.replace(v2Base(orgId, onlyId))");
    expect(picker).toContain("setUp ? (");
  });
  it("still draws a frame: tenant switcher + account menu with no brand", () => {
    expect(shell).toContain("<V2OrgSidebar orgId={params.orgId} />");
    const org = shell.slice(shell.indexOf("function V2OrgSidebar("), shell.indexOf("function V2Sidebar("));
    expect(org).toContain("<TenantSwitcherV2 />");
    expect(org).toContain('<AccountMenuV2 orgId={orgId} brandId="" />');
  });
});

describe("Keel, not v1", () => {
  it("uses no raw greys, brand-50 fills, bordered cards or em-dashes", () => {
    for (const src of [newOrg, end, overlay, read("components/v2/new-org-icons.tsx")]) {
      expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|bg-black\//);
      expect(src).not.toContain("—");
    }
  });
  it("the new org modal portals to the v2 layer", () => {
    expect(newOrg).toContain('document.getElementById("v2-portal")');
  });
});
