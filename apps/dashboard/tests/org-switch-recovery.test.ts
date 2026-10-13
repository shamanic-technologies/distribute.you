import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * An org switch must be BOUNDED, and its recovery must be able to succeed.
 *
 * Reported: switching org "sometimes doesn't work and takes infinite time". The
 * console showed two things at once — a flapping connection (Clerk's token and
 * touch endpoints failing with ERR_NETWORK_CHANGED / ERR_NAME_NOT_RESOLVED) and
 * a storm of `409 org_desync` on every `/api/v1/*` read. Three defects, all on
 * the client:
 *
 *   1. `handleOrgSwitch` awaited three network calls with NO timeout. `fetch`
 *      and Clerk both wait forever, so any of them could hang for the rest of
 *      the session behind a spinner with no error and no retry.
 *   2. The join round-trip was gated on `userMemberships.data` — Clerk's FIRST
 *      membership PAGE only. A staff member of many orgs reads as "not a member"
 *      for nearly every target, so nearly every click paid a Clerk Backend join.
 *   3. On a 409, `apiCall` waited 500ms and retried with the SAME CACHED Clerk
 *      token — which carries the org claim that was just refused. The retry was
 *      deterministically refused too, and there was only one of them.
 *
 * Source-substring guards (the dashboard convention), scoped per function so the
 * assertions cannot be satisfied by unrelated code. `with-timeout.ts` is
 * alias-free and has real unit tests of its own.
 */
describe("An org switch is bounded and its 409 recovery can actually succeed", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const hookPath = "src/lib/use-tenant-switcher.ts";

  /** The `handleOrgSwitch` body — from its declaration to its dependency array. */
  const handlerBody = () => {
    const src = read(hookPath);
    const at = src.indexOf("const handleOrgSwitch = useCallback(");
    expect(at, "handleOrgSwitch not found").toBeGreaterThan(-1);
    const end = src.indexOf("const handleBrandSwitch", at);
    expect(end, "handleBrandSwitch not found after handleOrgSwitch").toBeGreaterThan(at);
    return src.slice(at, end);
  };

  it("never runs Clerk's in-page setActive, and loads the target org instead", () => {
    // 2026-10-13: on a freshly loaded prod tab `setActive` hung until the 15s bound
    // fired ("Couldn't reach the auth service") with the network fine, after it had
    // already stored the target org on the session: every later token carried the
    // target while the page stayed on the old org, so every read 409'd. A full
    // load lets proxy.ts organizationSyncOptions activate the org server-side.
    const body = handlerBody();
    expect(body).not.toContain("setActive(");
    expect(body).not.toContain("getToken(");
    expect(body).toContain("window.location.assign(`/orgs/${clerkOrgId}`)");
  });

  it("joins BEFORE loading, bounded, skipped only on positive membership", () => {
    const body = handlerBody();
    // The middleware cannot activate an org the user does not belong to.
    const joinAt = body.indexOf("/api/admin/orgs/${clerkOrgId}/join");
    const loadAt = body.indexOf("window.location.assign(");
    expect(joinAt, "the join route call is gone").toBeGreaterThan(-1);
    expect(joinAt).toBeLessThan(loadAt);
    expect(
      body,
      "the join fetch must carry an abort signal: fetch has no default timeout",
    ).toContain("AbortSignal.timeout(ORG_SWITCH_TIMEOUT_MS)");
    // The paginated first page is evidence of membership, never of its absence.
    expect(body).toContain("if (isStaff && !knownMember)");
  });

  it("states a failure instead of a spinner", () => {
    const body = handlerBody();
    expect(body).toContain("setSwitchingOrg(null)");
    // The sentence lives in the alias-free `org-switch-error.ts`, pinned by
    // `org-switch-error-message.test.ts`.
    expect(body).toContain("orgSwitchErrorMessage(");
  });

  it("re-mints the token before retrying a 409, and retries more than once", () => {
    const src = read("src/lib/api.ts");
    // The token reader must be able to force a fresh mint...
    expect(src).toContain("async function getTabSessionToken(forceRefresh = false)");
    expect(src).toContain("forceRefresh ? { skipCache: true } : undefined");
    // ...and the desync retry must ask for one, on a real backoff.
    expect(src).toContain("const ORG_DESYNC_BACKOFF_MS");
    const at = src.indexOf("if (!token) {\n    for (let attempt");
    expect(at, "the org-desync retry loop is gone").toBeGreaterThan(-1);
    const loop = src.slice(at, at + 700);
    expect(loop).toContain("ORG_DESYNC_STATUS");
    expect(loop).toContain("ORG_DESYNC_ERROR");
    expect(
      loop,
      "the retry must force a fresh token — the cached one carries the refused org",
    ).toContain("send(true)");
  });

  it("keeps the ungated user-resolve from 409-ing through every switch", () => {
    const src = read("src/components/user-resolver.tsx");
    expect(src).toContain("useOrgQueryGate");
    expect(src).toContain("!orgConsistent");
  });
});
