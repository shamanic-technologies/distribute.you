import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const capture = read("src/components/invite/invite-capture.tsx");
const claimer = read("src/components/invite/invite-claimer.tsx");
const toast = read("src/components/toast.tsx");
const rootLayout = read("src/app/layout.tsx");
const dashLayout = read("src/components/v2/v2-client-layout.tsx");
const persist = read("src/lib/persist-cache.ts");
const api = read("src/lib/api.ts");

// These are source-substring guards because the components import through the
// `@` alias, which vitest does not resolve here. The pure logic lives in
// lib/invite-link.ts and is covered by real unit tests in invite-link.test.ts.

describe("the copy confirmation", () => {
  it("is announced, not just drawn", () => {
    // A toast the user did not navigate to is invisible to a screen reader
    // without this, and the control it confirms then reads as dead.
    expect(toast).toContain('role="status"');
    expect(toast).toContain('aria-live="polite"');
  });

  it("is green, and says what happened", () => {
    expect(toast).toContain("bg-green-600");
  });

  it("stays clear of the support FAB's corner", () => {
    // The FAB is pinned bottom-right on every dashboard page, so a toast landing
    // under it is the one message the user cannot read.
    expect(toast).toContain("left-1/2");
    expect(toast).not.toContain("right-");
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
