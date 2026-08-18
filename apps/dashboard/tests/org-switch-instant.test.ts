import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * An org switch must LOOK instant and must never die in silence.
 *
 * Reported: clicking an organization in the switcher did nothing, sometimes for
 * ~30 seconds. Nothing was broken about the destination — the handler ran THREE
 * serial network round-trips before the navigation even started, with zero
 * feedback on screen:
 *
 *   1. POST /api/admin/orgs/:id/join  → Clerk Backend API, fired on EVERY staff
 *      switch, including into orgs the staff member had joined months ago.
 *   2. await setActive(...)           → Clerk.
 *   3. await getToken({skipCache})    → Clerk.
 *   4. router.push(...)               → only now does anything paint.
 *
 * `go()` had already closed the menu, and the sidebar still showed the OLD org
 * (the label is keyed on the URL org, which has not moved yet), so the whole
 * window was indistinguishable from a dead button.
 *
 * Worse, the join failure path did `console.error` and CONTINUED into
 * `setActive`, which then rejects for a non-member org. That rejection was
 * unhandled inside a click handler: `router.push` never ran, no message was
 * shown, and the switcher stayed dead until a reload — the "sometimes nothing
 * EVER happens" half of the report.
 *
 * These are source-substring guards (the dashboard convention), scoped to the
 * handler body so the assertions cannot be satisfied by unrelated code.
 */
describe("Org switch is instant to the eye and fails loud", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const hookPath = "src/lib/use-tenant-switcher.ts";
  const switcherPath = "src/components/tenant-switcher.tsx";

  /** The `handleOrgSwitch` body — from its declaration to its dependency array. */
  const handlerBody = () => {
    const src = read(hookPath);
    const at = src.indexOf("const handleOrgSwitch = useCallback(");
    expect(at, "handleOrgSwitch not found").toBeGreaterThan(-1);
    const end = src.indexOf("const handleBrandSwitch", at);
    expect(end, "handleBrandSwitch not found after handleOrgSwitch").toBeGreaterThan(at);
    return src.slice(at, end);
  };

  it("marks the switch pending BEFORE the first await", () => {
    // The whole complaint is the silent window. The pending flag has to be set
    // synchronously in the click, not after the first round-trip resolves —
    // otherwise the spinner appears at the moment it stops being needed.
    const body = handlerBody();
    const pendingAt = body.indexOf("setSwitchingOrg(");
    const firstAwaitAt = body.indexOf("await ");
    expect(pendingAt, "setSwitchingOrg( not called in handleOrgSwitch").toBeGreaterThan(-1);
    expect(firstAwaitAt).toBeGreaterThan(-1);
    expect(
      pendingAt,
      "the pending flag must be set before any await, or the spinner is useless",
    ).toBeLessThan(firstAwaitAt);
  });

  it("skips the Clerk join round-trip when the staff member is already a member", () => {
    // Clerk's own membership list is already loaded client-side, so a present
    // membership is free and authoritative-positive. Absent is NOT authoritative
    // (the list is paginated), so we still call the idempotent route then.
    const body = handlerBody();
    expect(body).toContain("alreadyMember");
    const memberAt = body.indexOf("alreadyMember");
    const joinAt = body.indexOf("/api/admin/orgs/${clerkOrgId}/join");
    expect(joinAt, "the join route call is gone").toBeGreaterThan(-1);
    expect(memberAt, "the membership check must gate the join call").toBeLessThan(joinAt);
  });

  it("fails loud on a join rejection instead of walking into setActive", () => {
    // Continuing past a failed join reaches `setActive` on an org the user is not
    // a member of, which rejects — and an unhandled rejection in a click handler
    // is exactly the silence this whole file exists to kill.
    const body = handlerBody();
    expect(body).toContain("!res.ok");
    expect(body).not.toContain('console.error("Failed to join org:');
  });

  it("does not swallow the session re-mint", () => {
    // `.catch(() => {})` on the token re-mint hid the one failure that makes the
    // switch revert on its own (#1940). It is caught by the handler's own catch
    // now, which surfaces it.
    const body = handlerBody();
    expect(body).toContain("await session?.getToken({ skipCache: true })");
    expect(body).not.toContain("getToken({ skipCache: true }).catch");
  });

  it("keeps the setActive → re-mint → navigate ordering (#1940)", () => {
    // The instant-feedback work must not reorder the race fix: setActive resolves
    // the active org, the re-mint gets it into the cookie, and only then may the
    // navigation reach the middleware.
    const body = handlerBody();
    const order =
      /setActive\([\s\S]*?getToken\(\{ skipCache: true \}\)[\s\S]*?router\.push/.test(body);
    expect(order, "setActive → getToken → router.push ordering broken").toBe(true);
  });

  it("clears the pending flag on failure so the switcher is retryable", () => {
    const body = handlerBody();
    expect(body).toContain("setSwitchingOrg(null)");
    expect(body).toContain("setSwitchError(");
  });

  it("leaves the menu open on an org click and spins the clicked row", () => {
    // `go()` closes the menu first. On a brand switch that is fine (the push is
    // immediate); on an org switch it removed the only surface that could show
    // progress. The org rows call the handler directly and the menu closes once
    // the navigation is under way.
    const src = read(switcherPath);
    const at = src.indexOf("{/* ORG — tier 1 */}");
    const end = src.indexOf("{/* BRAND — tier 2", at);
    expect(at).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(at);
    const orgSection = src.slice(at, end);
    expect(
      orgSection,
      "an org row must not close the menu through go() before the switch runs",
    ).not.toContain("go(() => t.handleOrgSwitch");
    expect(orgSection).toContain("t.handleOrgSwitch(");
    expect(orgSection).toContain("t.switchingOrgId");
  });

  it("states the target while switching and states a failure", () => {
    const src = read(switcherPath);
    expect(src).toContain("Switching to");
    expect(src).toContain("t.switchError");
  });
});
