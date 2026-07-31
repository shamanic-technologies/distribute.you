import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const card = read("src/components/invite/referral-card.tsx");
const capture = read("src/components/invite/invite-capture.tsx");
const claimer = read("src/components/invite/invite-claimer.tsx");
const sidebar = read("src/components/context-sidebar.tsx");
const rootLayout = read("src/app/layout.tsx");
const dashLayout = read("src/app/(authed)/(dashboard)/layout.tsx");
const persist = read("src/lib/persist-cache.ts");
const api = read("src/lib/api.ts");

// These are source-substring guards because the components import through the
// `@` alias, which vitest does not resolve here. The pure logic lives in
// lib/invite-link.ts and is covered by real unit tests in invite-link.test.ts.

describe("the referral card", () => {
  it("builds its link from the org's real invite code", () => {
    expect(card).toContain("getInviteStatus");
    expect(card).toContain("inviteLinkForCode");
  });

  it("never falls back to the old backend-free UTM link", () => {
    // The card this replaces copied a bare landing URL with `utm_source=referral`
    // and credited nobody while promising credits on screen. A link that leads to
    // no reward is the bug, so the card renders nothing when the code is missing.
    expect(card).not.toContain("utm_source");
    expect(card).toContain("if (!link) return null");
  });

  it("keys the invite read on the INTERNAL org id, not the Clerk org in the URL", () => {
    // Both invite routes 403 unless the path org matches the authenticated org,
    // and the authenticated org is the internal UUID. `useParams().orgId` is the
    // Clerk id and would fail every call.
    expect(card).toContain("account?.org_id");
    expect(card).not.toContain("useParams");
  });

  it("is anchored in the sidebar it belongs to", () => {
    expect(sidebar).toContain("<ReferralCard />");
    expect(sidebar).toContain('from "@/components/invite/referral-card"');
  });
});

describe("the code's journey", () => {
  it("is captured on the root layout, where a signup can reach it", () => {
    expect(rootLayout).toContain("<InviteCapture />");
    expect(capture).toContain("inviteCodeFromSearch");
    expect(capture).toContain("inviteCookieWrite");
  });

  it("is claimed on the authed shell, where an org exists", () => {
    expect(dashLayout).toContain("<InviteClaimer />");
    expect(claimer).toContain("claimInvite");
  });

  it("survives a failed claim instead of being dropped", () => {
    // A dropped code costs two orgs $500 each and nothing on screen says so, so
    // the cookie is cleared ONLY on success or on a rejection that can never
    // change its answer. Everything else retries on the next page load.
    expect(claimer).toContain("isTerminalClaimRejection");
    const clears = claimer.match(/inviteCookieClear\(\)/g) ?? [];
    expect(clears).toHaveLength(2); // one on success, one on a terminal rejection
  });

  it("attempts at most once per mount rather than looping", () => {
    expect(claimer).toContain("attempted.current");
  });
});

describe("the readers", () => {
  it("require only the code, so the invite-cap fields may retire", () => {
    // client-service is lifting the three-invite cap, which retires used/total/
    // expired. A reader that required them would break the moment it lands.
    expect(api).toContain("used: z.number().optional()");
    expect(api).toContain("total: z.number().optional()");
    expect(api).toContain("expired: z.boolean().optional()");
  });

  it("persist the invite code so the card does not cold-fetch every load", () => {
    expect(persist).toContain('"inviteStatus"');
  });
});
