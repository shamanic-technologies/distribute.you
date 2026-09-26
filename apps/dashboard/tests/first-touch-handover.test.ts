import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

/**
 * The capture is worthless unless every moment an org comes into being hands it
 * over. These pin the CALL SITES: a module able to record a first touch that no
 * route calls is the feature entirely absent with the module perfectly correct.
 */
describe("first-touch hand-over call sites", () => {
  it("the root layout renders the capture script", () => {
    expect(read("app/layout.tsx")).toContain("__html: FIRST_TOUCH_CAPTURE_SCRIPT");
  });

  it("the anonymous start records it on the org before anything else", () => {
    const route = read("app/api/anon/session/route.ts");
    const create = route.indexOf("await createAnonymousOrg(");
    const record = route.indexOf('await recordAcquisition({ orgId }, firstTouchForHandover(req.headers.get("cookie")))');
    const seed = route.indexOf("await seedTrialCredit(");
    expect(create).toBeGreaterThan(-1);
    expect(record).toBeGreaterThan(create);
    expect(seed).toBeGreaterThan(record);
  });

  it("an ordinary signup and the end of onboarding hand it over from the session", () => {
    const route = read("app/(authed)/api/attribution/first-touch/route.ts");
    expect(route).toContain("recordAcquisition({ externalOrgId: orgId, externalUserId: userId }, touch)");
    // the channel comes from the cookie, never from a body the client writes
    expect(route).not.toContain("req.json(");
    expect(read("components/posthog-auth-tracker.tsx")).toContain('fetch("/api/attribution/first-touch", { method: "POST" })');
    expect(read("app/(authed)/api/onboarding/complete/route.ts")).toContain(
      'firstTouchForHandover(req.headers.get("cookie"))',
    );
  });

  it("a failed hand-over is logged and never breaks the signup", () => {
    const lib = read("lib/client-service.ts");
    const fn = lib.slice(lib.indexOf("export async function recordAcquisition("));
    expect(fn).toContain("console.error(");
    expect(fn).toContain("return null;");
  });
});
