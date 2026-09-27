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
    expect(menus).toContain('setSetupFor("org")');
    expect(menus).not.toContain('router.push("/onboarding?new=1&from=add")');
  });
});

describe("the modal acts on the org it created, not the one the URL names", () => {
  it("the api client carries an explicit override the proxy compares", () => {
    expect(api).toContain("export function setApiActiveOrgOverride");
    expect(api).toContain("if (activeOrgOverride) return activeOrgOverride;");
  });
  it("the modal sets it for the org it acts on and clears it on close, on step one and on launch", () => {
    expect(modal).toContain("setApiActiveOrgOverride(open && orgId ? orgId : null)");
    expect((modal.match(/setApiActiveOrgOverride\(null\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it("step one only creates the org, credits its bonus, then NAVIGATES to its root (two steps, owner-decided)", () => {
    const body = modal.slice(modal.indexOf("function submitOrg("), modal.indexOf("function submitBrand("));
    const bonus = body.indexOf('"/api/orgs/creation-bonus"');
    const nav = body.indexOf("window.location.assign(`/v2/orgs/${id}`)");
    expect(bonus).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(bonus);
    // A full navigation, never setActive: setActive would refresh the current page under
    // a not-yet-set-up org and the edge gate would bounce it to the old onboarding.
    expect(body).not.toContain("setActive(");
    expect(body).toContain("organizationId: id");
  });
  it("the api client mints a token FOR the overridden org", () => {
    expect(api).toContain("organizationId: activeOrgOverride");
  });
  it("never makes the new org active before it is marked set up (the edge gate would send the person to /onboarding)", () => {
    const setActives = [...modal.matchAll(/setActive\(\{ organization/g)].map((m) => m.index!);
    expect(setActives).toHaveLength(1);
    const done = modal.indexOf('"/api/onboarding/complete"');
    expect(done).toBeGreaterThan(-1);
    expect(setActives[0]).toBeGreaterThan(done);
  });
  it("marks the NEW org set up with a token minted for it", () => {
    const launch = modal.slice(modal.indexOf("function launch()"));
    expect(launch).toContain("getToken({ organizationId: orgId!, skipCache: true })");
    expect(launch).toContain("Authorization: `Bearer ${orgToken}`");
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

describe("postpaid saves a card in the page, charging nothing, then arms auto top-up", () => {
  const capture = modal.slice(modal.indexOf("function startCardCapture()"), modal.indexOf("async function afterCardSaved()"));
  const after = modal.slice(modal.indexOf("async function afterCardSaved()"), modal.indexOf("function launch()"));
  it("asks billing for the in-page variant and handles both acquirers", () => {
    expect(api).toContain('body: { ui_mode: "embedded" }');
    expect(capture).toContain("createEmbeddedCardSetup()");
    expect(capture).toContain('setup.mode === "embedded_checkout"');
    expect(capture).toContain('setup.mode === "embedded_widget"');
  });
  it("never arms auto top-up on a card that cannot be charged off-session", () => {
    const blocked = after.indexOf("auto_reload_supported === false");
    const arm = after.indexOf("configureAutoTopup(");
    expect(blocked).toBeGreaterThan(-1);
    expect(arm).toBeGreaterThan(blocked);
  });
  it("launches only after the card is confirmed and auto top-up is on", () => {
    expect(after.indexOf("launch();")).toBeGreaterThan(after.indexOf("configureAutoTopup("));
  });
});

describe("an org with no brand stays in v2, with one way forward", () => {
  const proxy = read("proxy.ts");
  const picker = read("components/v2/brand-picker.tsx");
  it("the edge lets a v2 user reach the bare org page even while the org is not set up", () => {
    expect(proxy).toContain("const v2OrgRoot =");
    const gate = proxy.slice(proxy.indexOf("const v2OrgRoot ="), proxy.indexOf("return NextResponse.redirect(new URL(onboardingHref(), req.url));", proxy.indexOf("const v2OrgRoot =")));
    expect(gate).toContain('=== "v2"');
    expect(gate).toContain("!v2OrgRoot &&");
  });
  it("the org page offers Add a brand, which runs the modal from the brand step on that org", () => {
    expect(picker).toContain("Add a brand");
    expect(picker).toContain("existingOrgId={orgId}");
    expect(modal).toContain('existingOrgId ? "brand" : "org"');
  });
  it("New brand in the menu opens the same modal, never the full-page onboarding", () => {
    expect(menus).not.toContain('router.push("/onboarding?from=add")');
    expect(menus).toContain('setSetupFor("brand")');
    expect(menus).toContain('existingOrgId={setupFor === "brand" ? t.orgId : null}');
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

describe("the brand step waits for the site read", () => {
  it("awaits the fields prefill behind a loader before opening 'What you sell'", () => {
    const body = modal.slice(modal.indexOf("function submitBrand("), modal.indexOf("function submitOfferText("));
    const wait = body.indexOf("await startPrefill(id)");
    expect(wait).toBeGreaterThan(-1);
    expect(body.indexOf("setReadingSite(true)")).toBeLessThan(wait);
    expect(body.indexOf("forward()")).toBeGreaterThan(wait);
    expect(modal).toContain("Reading your website to draft what you sell");
  });
});

describe("an org that is not set up yet", () => {
  const orgPage = readFileSync(join(__dirname, "../src/app/(authed)/v2/orgs/[orgId]/page.tsx"), "utf8");
  const picker = readFileSync(join(__dirname, "../src/components/v2/brand-picker.tsx"), "utf8");
  const shell = readFileSync(join(__dirname, "../src/components/v2/v2-shell.tsx"), "utf8");
  it("never redirects to a brand page (the edge gate would send it to the old onboarding)", () => {
    expect(orgPage).toContain("if (last && setUp) redirect(");
    expect(orgPage).toContain("onboardingComplete === true");
  });
  it("resumes a brand in the v2 modal instead of opening it", () => {
    expect(picker).toContain("existingBrand={resuming}");
    expect(picker).toContain("setUp ? (");
  });
  it("still draws a frame: tenant switcher + account menu with no brand", () => {
    expect(shell).toContain("<V2OrgSidebar orgId={params.orgId} />");
    const org = shell.slice(shell.indexOf("function V2OrgSidebar("), shell.indexOf("function V2Sidebar("));
    expect(org).toContain("<TenantSwitcherV2 />");
    expect(org).toContain('<AccountMenuV2 orgId={orgId} brandId="" />');
  });
});

describe("leg prices are read on the chosen offer", () => {
  it("waits for the offer and names it on the read", () => {
    const eff = modal.slice(modal.indexOf("// Leg prices and the channel floor"), modal.indexOf("// ── Steps ──"));
    expect(eff).toContain("if (!brandId || !orgId || !offerId) return;");
    expect(eff).toContain("offerId, leg: leg.key");
    expect(eff).toContain("[brandId, orgId, offerId]");
  });
});

describe("orgs set up in the modal pay through Revolut", () => {
  const route = readFileSync(join(__dirname, "../src/app/(authed)/api/orgs/revolut/route.ts"), "utf8");
  it("declares Revolut before the first card or top-up call, prepaid and postpaid", () => {
    for (const fn of ["function startCheckout(", "function startCardCapture("]) {
      const body = modal.slice(modal.indexOf(fn), modal.indexOf(fn) + 900);
      expect(body.indexOf("await declareRevolut()")).toBeGreaterThan(-1);
      expect(body.indexOf("await declareRevolut()")).toBeLessThan(body.indexOf("await create"));
    }
  });
  it("opens Revolut's widget when the prepaid top-up answers one", () => {
    const body = modal.slice(modal.indexOf("function startCheckout("), modal.indexOf("function startCardCapture("));
    expect(body).toContain('checkout.mode === "embedded_widget"');
    expect(body).toContain("openCardWidget(");
  });
  it("declares on the org the session is scoped to", () => {
    expect(route).toContain("await auth()");
    expect(route).toContain("declareRevolutAcquirer(identity.orgId");
  });
});

describe("a resumed brand that already has its offers", () => {
  it("picks among them instead of re-asking what it sells, and reads the levers per offer", () => {
    const brand = modal.slice(modal.indexOf("function submitBrand("), modal.indexOf("function submitOfferText("));
    expect(brand).toContain("await listBrandOffers(id)");
    expect(brand.indexOf("await listBrandOffers(id)")).toBeLessThan(brand.indexOf("await startPrefill(id)"));
    expect(modal).toContain('offerId: chosenOfferId })');
  });
});

describe("the six offer questions", () => {
  it("are asked one per screen", () => {
    expect(modal).toContain("LEVER_QUESTIONS[leverIndex]");
    expect(modal).not.toContain("LEVER_QUESTIONS.map((q) => (\n                <Field");
    expect(modal).toContain('case "levers": return leverIndex < LEVER_QUESTIONS.length - 1');
  });
});

describe("the payment mode is recorded before the launch", () => {
  it("sets prepaid for a free-credit start and the chosen mode otherwise, before anything else in launch", () => {
    const body = modal.slice(modal.indexOf("  function launch() {"), modal.indexOf("if (!open) return null;"));
    const set = body.indexOf('await setPaymentMode(startOnFreeCredit.current ? "prepaid" : payMode)');
    expect(set).toBeGreaterThan(-1);
    expect(set).toBeLessThan(body.indexOf("await confirmAudienceSegments("));
    expect(modal).toContain("startOnFreeCredit.current = true;");
  });
});

describe("Try again replays the launch without re-sending what landed", () => {
  it("skips audiences, budget and campaign already written, and reuses a 409 audience set", () => {
    const body = modal.slice(modal.indexOf("  function launch() {"), modal.indexOf("if (!open) return null;"));
    expect(body).toContain("if (!launched.current.audiences)");
    expect(body).toContain("e instanceof ApiError && e.status === 409");
    expect(body).toContain("if (!launched.current.budget)");
    expect(body).toContain("launched.current.campaignId ??");
  });
});
