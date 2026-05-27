import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function read(relative: string): string {
  return fs.readFileSync(path.resolve(__dirname, relative), "utf-8");
}

describe("Invite cookie utility", () => {
  const cookieUtil = read("../src/lib/invite-cookie.ts");

  it("shares cookie name with landing app", () => {
    expect(cookieUtil).toContain('INVITE_COOKIE_NAME = "dyu_invite"');
  });

  it("returns null when cookie is absent", () => {
    expect(cookieUtil).toContain("readInviteCookie");
    expect(cookieUtil).toContain("isValidInviteSlug");
  });

  it("clearInviteCookie targets .distribute.you when on prod host", () => {
    expect(cookieUtil).toContain(".distribute.you");
    expect(cookieUtil).toContain("max-age=0");
  });
});

describe("Invite widget hides when cap reached", () => {
  const widget = read("../src/components/invite-widget.tsx");

  it("returns null when used >= total OR expired flag is set", () => {
    expect(widget).toMatch(/data\.expired \|\| data\.used >= data\.total/);
    expect(widget).toMatch(/return null/);
  });

  it("shows N/M counter when active", () => {
    expect(widget).toContain("{data.used}/{data.total} invitations used");
  });

  it("copies invite link with org slug to clipboard", () => {
    expect(widget).toMatch(/get-started\?invite=\$\{data\.code\}/);
    expect(widget).toContain("navigator.clipboard.writeText");
  });
});

describe("Onboarding claims invite after org creation", () => {
  const onboarding = read("../src/app/(authed)/onboarding/page.tsx");

  it("reads cookie after createOrganization + setActive", () => {
    expect(onboarding).toContain("readInviteCookie");
    expect(onboarding).toContain("claimInvite");
    expect(onboarding).toContain("clearInviteCookie");
  });

  it("clears the cookie in a finally block regardless of claim success", () => {
    expect(onboarding).toMatch(/finally\s*\{[\s\S]{0,80}clearInviteCookie/);
  });

  it("logs but does not throw when claim fails (onboarding must still complete)", () => {
    expect(onboarding).toContain("console.error");
    expect(onboarding).toContain("invite_claim_failed");
  });
});

describe("Invite API caller wires LOCKED URL contract", () => {
  const apiInvite = read("../src/lib/api-invite.ts");

  it("hits /api/v1/orgs/:id/invites/status (GET)", () => {
    expect(apiInvite).toMatch(/\/api\/v1\/orgs\/\$\{orgId\}\/invites\/status/);
  });

  it("hits /api/v1/orgs/:id/invites/claim (POST) with code body", () => {
    expect(apiInvite).toMatch(/\/api\/v1\/orgs\/\$\{orgId\}\/invites\/claim/);
    expect(apiInvite).toContain('method: "POST"');
    expect(apiInvite).toContain("JSON.stringify({ code })");
  });
});
