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

  it("bounds every leg of the switch", () => {
    const body = handlerBody();
    // setActive and the token re-mint are the two Clerk awaits; the join is a
    // plain fetch, which needs its own abort signal.
    expect(body).toContain("withTimeout(");
    expect(body).toContain("ORG_SWITCH_TIMEOUT_MS");
    expect(body).toContain("setActive({ organization: clerkOrgId })");
    expect(body).toContain("session.getToken({ skipCache: true })");
    expect(
      body,
      "the join fetch must carry an abort signal — fetch has no default timeout",
    ).toContain("AbortSignal.timeout(ORG_SWITCH_TIMEOUT_MS)");
  });

  it("asks Clerk instead of a paginated membership list", () => {
    const body = handlerBody();
    expect(
      body,
      "the first-page-only membership pre-check is what made every staff switch pay a join round-trip",
    ).not.toContain("alreadyMember");
    // The join is the RECOVERY from a refusal, so it lives after the setActive attempt.
    const activateAt = body.indexOf("await activate();");
    const joinAt = body.indexOf("/api/admin/orgs/${clerkOrgId}/join");
    expect(activateAt).toBeGreaterThan(-1);
    expect(joinAt, "the join route call is gone").toBeGreaterThan(activateAt);
  });

  it("does not join-and-retry after a timeout", () => {
    // A timeout is not a membership refusal. Joining then retrying on a dead
    // network only doubles the wait before the same failure.
    const body = handlerBody();
    expect(body).toContain("if (isTimeoutError(err) || !isStaff) throw err;");
  });

  it("states a network failure instead of a spinner", () => {
    const body = handlerBody();
    expect(body).toContain("setSwitchingOrg(null)");
    expect(body).toContain("Couldn't reach the auth service.");
  });

  it("keeps the setActive → re-mint → navigate ordering (#1940)", () => {
    const body = handlerBody();
    const order =
      /activate\(\)[\s\S]*?getToken\(\{ skipCache: true \}\)[\s\S]*?router\.push/.test(body);
    expect(order, "setActive → getToken → router.push ordering broken").toBe(true);
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
