import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  JOIN_COOKIE,
  clearJoinCookieAssignment,
  joinCookieAssignment,
  joinLinkUrl,
  joinToken,
  parseJoinToken,
  readJoinCookie,
} from "../src/lib/org-invite";
import { inviteCodeMatches, readInviteLink } from "../src/lib/org-invite-link-store";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const CODE = "abcdefghijklmnopqrstuvwx";

describe("invite link token", () => {
  it("round-trips org + code and rejects anything else", () => {
    expect(parseJoinToken(joinToken("org_abc123", CODE))).toEqual({ orgId: "org_abc123", code: CODE });
    expect(parseJoinToken("org_abc123")).toBeNull();
    expect(parseJoinToken("user_x." + CODE)).toBeNull();
    expect(parseJoinToken("org_abc123.short")).toBeNull();
    expect(parseJoinToken(null)).toBeNull();
  });

  it("builds a link on our origin, with the brand in the query", () => {
    const url = new URL(
      joinLinkUrl("https://dashboard.distribute.you", "org_abc123", CODE, { name: "Olive", domain: "olive.exchange", logoUrl: null, tint: null }),
    );
    expect(url.pathname).toBe(`/join/org_abc123.${CODE}`);
    expect(url.searchParams.get("bn")).toBe("Olive");
  });

  it("the cookie carries the token through any auth route and clears", () => {
    const token = joinToken("org_abc123", CODE);
    const set = joinCookieAssignment(token);
    expect(set.startsWith(`${JOIN_COOKIE}=`)).toBe(true);
    expect(readJoinCookie(`a=1; ${set.split(";")[0]}; b=2`)).toBe(token);
    expect(readJoinCookie(`${JOIN_COOKIE}=garbage`)).toBeNull();
    expect(clearJoinCookieAssignment()).toContain("max-age=0");
  });
});

describe("stored invite link", () => {
  const meta = { inviteLink: { code: CODE, createdAt: "2026-09-28T00:00:00Z", createdBy: "user_1" } };
  it("matches only the stored code, and nothing once revoked", () => {
    const stored = readInviteLink(meta);
    expect(inviteCodeMatches(stored, CODE)).toBe(true);
    expect(inviteCodeMatches(stored, CODE.slice(1) + "z")).toBe(false);
    expect(inviteCodeMatches(readInviteLink({ inviteLink: null }), CODE)).toBe(false);
    expect(inviteCodeMatches(readInviteLink(undefined), CODE)).toBe(false);
  });
});

describe("invite link call sites", () => {
  const manage = read("src/app/(authed)/api/orgs/invite-link/route.ts");
  const joinRoute = read("src/app/(authed)/api/join/route.ts");
  const claimer = read("src/components/team/join-claimer.tsx");
  const layout = read("src/app/(authed)/layout.tsx");
  const proxy = read("src/proxy.ts");
  const team = read("src/components/v2/team-page.tsx");
  const boot = read("src/instrumentation.ts");

  it("only an admin of the org on screen manages the link; revoke clears it", () => {
    expect(manage).toContain("orgIdFromClient !== orgId");
    expect(manage).toContain('orgRole !== "org:admin"');
    expect(manage).toContain("privateMetadata: { inviteLink: null }");
  });

  it("the join checks the stored code, joins as admin, and emails the other admins", () => {
    expect(joinRoute).toContain("treatPendingAsSignedOut: false");
    expect(joinRoute).toContain("inviteCodeMatches(readInviteLink(org.privateMetadata), parsed.code)");
    expect(joinRoute).toContain("status: 410");
    expect(joinRoute).toContain("role: INVITE_ROLE");
    expect(joinRoute).toContain("sendTeamMemberJoinedEmails(");
    expect(joinRoute).toContain("!isAdminEmail(email)");
    expect(boot).toContain('name: "team_member_joined"');
  });

  it("the claim runs on every authed page and activates the joined org", () => {
    expect(layout).toContain("<JoinClaimer />");
    expect(claimer).toContain("readJoinCookie(document.cookie)");
    expect(claimer).toContain("clerk.setActive({ organization: body.orgId })");
  });

  it("/join and /api/join are public, not auth routes", () => {
    const pub = proxy.slice(proxy.indexOf("const isPublicRoute"), proxy.indexOf("const isAuthRoute"));
    const authR = proxy.slice(proxy.indexOf("const isAuthRoute"), proxy.indexOf("const isSessionTaskRoute"));
    expect(pub).toContain('"/join(.*)"');
    expect(pub).toContain('"/api/join"');
    expect(authR).not.toContain("/join");
  });

  it("the Team page offers the link to admins with copy and revoke", () => {
    expect(team).toContain("{isAdmin && <InviteLinkCard />}");
    expect(team).toContain('run("DELETE")');
    expect(team).toContain("navigator.clipboard.writeText(url)");
  });
});

import { monochromeBackground } from "../src/lib/brand-tint";
import { parseInviteBrand, sanitizeInviteBrand, brandQuery } from "../src/lib/org-invite";

describe("black-and-white brands", () => {
  it("a palette with no accent keeps its dominant colour; any accent means not mono", () => {
    expect(monochromeBackground(["#000000", "#ffffff", "#ffffff"])).toBe("#000000");
    expect(monochromeBackground(["#ce2e36", "#000000"])).toBeNull();
    expect(monochromeBackground([])).toBeNull();
    expect(monochromeBackground(null)).toBeNull();
  });

  it("the mono background rides the link and comes back validated", () => {
    const b = sanitizeInviteBrand({ name: "Olive", domain: "olive.exchange", logoUrl: null, tint: null, mono: "#000000" });
    const q = new URLSearchParams(brandQuery(b));
    expect(q.get("bm")).toBe("000000");
    expect(parseInviteBrand(q)?.mono).toBe("#000000");
    expect(parseInviteBrand(new URLSearchParams("bn=A&bm=red"))?.mono).toBeNull();
  });
});

describe("joining while already signed in", () => {
  const page = read("src/app/(authed)/join/[token]/join-page.tsx");
  const claimer = read("src/components/team/join-claimer.tsx");
  it("the /join page claims by itself and states a failure instead of spinning", () => {
    expect(page).toContain("claimJoin(token, clerk, router)");
    expect(page).toContain("We could not add you to the team");
  });
  it("the layout claimer re-checks on navigation and leaves /join to the page", () => {
    expect(claimer).toContain('pathname.startsWith("/join")');
    // A join that succeeded never reports failure: reload the session, else a full load.
    expect(claimer).toContain("await clerk.user?.reload();");
    expect(claimer).toContain("window.location.assign(dest)");
    expect(claimer).toContain("[isSignedIn, clerk, router, pathname]");
  });
});

describe("invite link preview", () => {
  const shell = read("src/app/(authed)/join/[token]/page.tsx");
  const og = read("src/app/api/public/og/join/route.tsx");
  it("the link unfurls as the team it joins, not as the dashboard", () => {
    expect(shell).toContain("export async function generateMetadata");
    expect(shell).toContain("Join the ${brand.name} team on distribute.you");
    expect(shell).toContain("/api/public/og/join");
    expect(shell).not.toContain('"use client"');
    expect(og).toContain("new ImageResponse(");
    expect(og).toContain("parseInviteBrand(");
  });
});
