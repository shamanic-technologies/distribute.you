import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// These modules import through the `@` alias, which vitest does not resolve in
// this repo, so the guards are source-substring over the file. The two pure libs
// behind the share view (`share-mode.ts`, `share-api-allowlist.ts`) carry real
// unit tests instead — see their own files.

const src = (p: string) => fs.readFileSync(path.join(__dirname, "..", "src", p), "utf8");
const exists = (p: string) => fs.existsSync(path.join(__dirname, "..", "src", p));

const SHARE_ROOT = "app/share/[token]/orgs/[orgId]/brands/[brandId]";

describe("the share tree runs the real pages", () => {
  // One Audiences page, not two that drift. The mirrored route segments are what
  // let the same components read their org and brand off `useParams()`.
  it("re-exports the dashboard's own Overview", () => {
    const page = src(`${SHARE_ROOT}/page.tsx`);
    expect(page).toContain(
      'export { default } from "@/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page"',
    );
  });

  it.each([
    ["audiences/page.tsx", "CustomerAudiencesPage"],
    ["audiences/leads/page.tsx", "EngagedLeadsPage"],
    ["strategy/page.tsx", "StrategyPage"],
  ])("renders the dashboard's %s component", (file, component) => {
    expect(src(`${SHARE_ROOT}/${file}`)).toContain(component);
  });

  // Brand Settings, Brand Info and Workflows are where a brand is CHANGED, so the
  // share tree has no route for them at all — a hidden nav entry would still leave
  // the URL reachable.
  it.each(["settings", "brand-info", "workflows", "campaigns"])(
    "has no %s route",
    (segment) => {
      expect(exists(`${SHARE_ROOT}/${segment}`)).toBe(false);
    },
  );
});

describe("the share layout trusts the credential, not the URL", () => {
  const layout = src(`${SHARE_ROOT}/layout.tsx`);

  it("re-resolves the token and refuses a mismatched org or brand", () => {
    expect(layout).toContain("resolveShareToken(token)");
    expect(layout).toContain("brand.id !== brandId || brand.orgId !== orgId");
    expect(layout).toContain("notFound()");
  });

  // Trusting a first resolve would make revocation take effect only on the next
  // session rather than the next request.
  it("renders per request", () => {
    expect(layout).toContain('export const dynamic = "force-dynamic"');
  });

  it("keeps the shared link out of the index", () => {
    expect(layout).toContain("robots: { index: false, follow: false }");
  });
});

describe("the share proxy is read-only", () => {
  const route = src("app/share/[token]/api/v1/[...path]/route.ts");

  // The boundary is that no other verb EXISTS here, not that a handler checks a
  // flag. A route added later cannot accidentally inherit a write path.
  it.each(["POST", "PUT", "PATCH", "DELETE"])("exports no %s handler", (verb) => {
    expect(route).not.toContain(`export async function ${verb}(`);
  });

  it("exports GET", () => {
    expect(route).toContain("export async function GET(");
  });

  it("pins every read to the credential's brand", () => {
    expect(route).toContain("shareApiAccess(");
    expect(route).toContain('"x-brand-id": brand.id');
  });

  it("takes the org from the resolved credential, never from the request", () => {
    expect(route).toContain('"x-external-org-id": brand.orgId');
  });

  // The authed proxy learned this the hard way: buffering holds a large list
  // response twice and OOM-kills the function instance.
  it("streams the upstream body through", () => {
    expect(route).not.toContain("await res.text()");
    expect(route).toContain("new NextResponse(res.body");
  });
});

describe("share chrome drops everything that belongs to the org", () => {
  const shell = src("components/share/share-shell.tsx");

  it.each([
    ["the account menu", "useUser"],
    ["sign out", "signOut"],
    ["the Share control", "ShareMenu"],
    ["the tenant switcher", "TenantSwitcher"],
    ["billing alerts", "CreditAlerts"],
    ["the onboarding flow", "OnboardingFlow"],
    ["the referral card", "ReferralCard"],
    ["the support button", "SupportButton"],
  ])("has no %s", (_label, symbol) => {
    expect(shell).not.toContain(symbol);
  });

  it("navigates to the four shared pages and nothing else", () => {
    expect(shell).toContain('label: "Overview"');
    expect(shell).toContain('label: "Leads"');
    expect(shell).toContain('label: "Strategy"');
    expect(shell).toContain('label: "Audiences"');
    expect(shell).not.toContain('label: "Brand Settings"');
    expect(shell).not.toContain('label: "Billing"');
  });

  it("keys its cache on the credential rather than an org", () => {
    expect(shell).toContain('scope="share"');
    expect(shell).toContain("shareToken={share.token}");
  });
});

describe("the client reads go to the share proxy, with no session attached", () => {
  const api = src("lib/api.ts");

  it("switches base path on a share path", () => {
    expect(api).toContain("shareTokenFromPathname(");
    expect(api).toContain("url = `${shareApiBasePath(shareToken)}${endpoint}`");
  });

  // A visitor who happens to be signed in to their own account must not have it
  // influence what a shared link shows.
  it("sends no Clerk bearer on the share branch", () => {
    const at = api.indexOf("} else if (shareToken) {");
    const branch = api.slice(at, api.indexOf("} else {", at));
    expect(branch).not.toContain("Authorization");
    expect(branch).not.toContain("getTabSessionToken");
  });
});

describe("the org-consistency gate does not fire on a share path", () => {
  const hook = src("lib/use-auth-query.ts");

  // The share path contains `/orgs/<id>` because it mirrors the authed routes.
  // Left ungated, that id would be compared against a null Clerk org, every query
  // would be disabled, and the whole view would sit in a skeleton forever.
  it("treats a share path as having no URL org", () => {
    expect(hook).toContain("isSharePathname(pathname)");
    expect(hook).toContain("const urlOrgId = isShare ? null :");
  });
});

describe("nothing on a shared page offers to change the brand", () => {
  it("audiences hides the AI editor and the lifecycle actions", () => {
    const page = src("components/audiences/customer-audiences-page.tsx");
    expect(page).toContain("const readOnly = useIsShareMode();");
    expect(page).toContain("{!readOnly && <EditWithAIChat");
    expect(page).toContain("readOnly={readOnly}");
  });

  it("strategy renders the offer without an editor and cannot save", () => {
    const page = src("components/strategy/strategy-page.tsx");
    expect(page).toContain("const readOnly = useIsShareMode();");
    expect(page).toContain("<OfferValueReadOnly");
    expect(page).toContain("if (readOnly || campaignScoped ||");
  });

  it("the brand status bar shows the goal and budget but not Pause", () => {
    const page = src("components/brand/brand-status-control.tsx");
    expect(page).toContain("const readOnly = useIsShareMode();");
    expect(page).toContain("{pauseReady && !readOnly ?");
  });

  it("the stat cards drop the conversion-tracker call to action", () => {
    const page = src("components/revenue/outreach-stat-cards.tsx");
    expect(page).toContain("!trackerLive && !readOnly");
  });
});

describe("in-app links stay inside the share tree", () => {
  // A link built as `/orgs/<org>/brands/<brand>/…` is correct in the dashboard and
  // lands a share visitor on a sign-in page.
  it.each([
    "components/audiences/engaged-leads-page.tsx",
    "components/revenue/top-audiences-card.tsx",
  ])("%s prefixes its audience link", (file) => {
    const page = src(file);
    expect(page).toContain("const pathPrefix = useSharePathPrefix();");
    expect(page).toContain("href={`${pathPrefix}/orgs/${orgId}/brands/${brandId}/audiences");
  });
});
