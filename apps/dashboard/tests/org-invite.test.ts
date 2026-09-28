import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DASHBOARD_ORIGIN,
  inviteLandingHref,
  inviteRedirectUrl,
  isInvitableEmail,
  isInviteRole,
  normalizeInviteEmail,
  parseInviteBrand,
  parseInviteStatus,
  sanitizeInviteBrand,
} from "../src/lib/org-invite";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("org invite rules", () => {
  it("accepts only the two roles Clerk knows", () => {
    expect(isInviteRole("org:admin")).toBe(true);
    expect(isInviteRole("org:member")).toBe(true);
    expect(isInviteRole("admin")).toBe(false);
    expect(isInviteRole(undefined)).toBe(false);
  });

  it("checks the address shape and normalizes it", () => {
    expect(isInvitableEmail(" Jane@Acme.com ")).toBe(true);
    expect(normalizeInviteEmail(" Jane@Acme.com ")).toBe("jane@acme.com");
    expect(isInvitableEmail("jane@acme")).toBe(false);
    expect(isInvitableEmail("")).toBe(false);
  });

  it("points the email link at our own /invite page, never at a foreign origin", () => {
    expect(inviteRedirectUrl("https://dashboard.distribute.you", "org_1")).toBe(
      "https://dashboard.distribute.you/invite?org=org_1",
    );
    expect(inviteRedirectUrl("http://localhost:3001", "org_1")).toBe("http://localhost:3001/invite?org=org_1");
    expect(inviteRedirectUrl("https://evil.example", "org_1")).toBe(`${DASHBOARD_ORIGIN}/invite?org=org_1`);
    expect(inviteRedirectUrl(null, "org_1")).toBe(`${DASHBOARD_ORIGIN}/invite?org=org_1`);
  });

  it("lands the new member on the org they were invited to", () => {
    expect(inviteLandingHref("org_1")).toBe("/orgs/org_1");
    expect(inviteLandingHref(null)).toBe("/orgs");
  });

  it("reads Clerk's status param", () => {
    expect(parseInviteStatus("sign_up")).toBe("sign_up");
    expect(parseInviteStatus("sign_in")).toBe("sign_in");
    expect(parseInviteStatus("complete")).toBe("complete");
    expect(parseInviteStatus("other")).toBeNull();
    expect(parseInviteStatus(null)).toBeNull();
  });
});

describe("the brand carried in the invite link", () => {
  const brand = {
    name: "Olive",
    domain: "olive.exchange",
    logoUrl: "https://cdn.example.com/olive.png",
    tint: { hue: 142.5, chromaScale: 0.8, hueDelta: -115.5, sourceHex: "#3a7" },
  };

  it("round-trips name, domain, logo and colour through the link", () => {
    const url = new URL(inviteRedirectUrl(DASHBOARD_ORIGIN, "org_1", sanitizeInviteBrand(brand)));
    expect(url.searchParams.get("org")).toBe("org_1");
    expect(parseInviteBrand(url.searchParams)).toEqual({
      name: "Olive",
      domain: "olive.exchange",
      logoUrl: "https://cdn.example.com/olive.png",
      tint: { hue: 142.5, chromaScale: 0.8, hueDelta: -115.5 },
    });
  });

  it("drops what it cannot trust instead of showing it", () => {
    const b = sanitizeInviteBrand({ name: "Olive", domain: "not a domain", logoUrl: "javascript:alert(1)", tint: { hue: "x" } });
    expect(b).toEqual({ name: "Olive", domain: null, logoUrl: null, tint: null });
    expect(sanitizeInviteBrand({ name: "  " })).toBeNull();
    expect(sanitizeInviteBrand(null)).toBeNull();
    expect(parseInviteBrand(new URLSearchParams("org=o&th=900&tc=1&td=0&bn=A")).tint).toBeNull();
  });

  it("an invite with no brand carries only the org", () => {
    expect(inviteRedirectUrl(DASHBOARD_ORIGIN, "org_1", null)).toBe(`${DASHBOARD_ORIGIN}/invite?org=org_1`);
    expect(parseInviteBrand(new URLSearchParams("org=org_1"))).toBeNull();
  });
});

describe("invite call sites", () => {
  const route = read("src/app/(authed)/api/orgs/invitations/route.ts");
  const team = read("src/components/v2/team-page.tsx");
  const page = read("src/app/(authed)/invite/page.tsx");
  const proxy = read("src/proxy.ts");

  it("the route invites into auth().orgId, admins only, with our redirect", () => {
    expect(route).toContain("body.orgId !== orgId");
    expect(route).toContain('orgRole !== "org:admin"');
    expect(route).toContain("createOrganizationInvitation");
    expect(route).toContain("redirectUrl: inviteRedirectUrl(req.headers.get(\"origin\"), orgId, sanitizeInviteBrand(body.brand))");
  });

  it("the team page offers invite + revoke to admins only", () => {
    expect(team).toContain("{isAdmin && <InviteCard");
    expect(team).toContain("/api/orgs/invitations");
    expect(team).toContain("getToken({ organizationId: orgId })");
    expect(team).toContain("inv.revoke()");
    expect(team).toContain("tint: resolveBrandTint(displayBrand.colors)");
  });

  it("the invite page uses the ticket for both sign-in and sign-up and activates the invited org", () => {
    expect(page).toContain('signIn.create({ strategy: "ticket", ticket })');
    expect(page).toContain('signUp.create({ strategy: "ticket", ticket, password })');
    expect(page).toContain("organization: orgId ?? undefined");
    expect(page).toContain("pending.accept()");
    expect(page).toContain("parseInviteBrand(params)");
    expect(page).toContain("<BrandLogo domain={brand.domain}");
    expect(page).toContain("root.setAttribute(TINT_ATTR");
  });

  it("/invite is public but not an auth route (a signed-in invitee must reach it)", () => {
    const pub = proxy.slice(proxy.indexOf("const isPublicRoute"), proxy.indexOf("const isAuthRoute"));
    const authR = proxy.slice(proxy.indexOf("const isAuthRoute"), proxy.indexOf("const isSessionTaskRoute"));
    expect(pub).toContain('"/invite(.*)"');
    expect(authR).not.toContain("/invite");
  });
});
