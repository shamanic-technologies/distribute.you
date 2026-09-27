import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The checkout button must not fail because the page was clicked too soon.
 *
 * A claimed signup lands on the budget screen straight from the account wall,
 * while the background hydrate is still loading the workflow projection. The
 * launch blob names a workflow off that projection, so a click before it settled
 * threw "Campaign workflow setup is still missing" and the customer read
 * "We couldn't open the checkout" at the moment of paying (reproduced in prod
 * 2026-09-27: the first two clicks failed, the third opened Stripe).
 *
 * It fetches the projection alone: the whole hydrate waits on a slow lever
 * extraction, and a payment must not. The ordering IS the fix, so it is pinned with an index compare.
 */
const SRC = fs.readFileSync(
  path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf8",
);

describe("checkout loads the projection before naming a workflow", () => {
  it("loads the projection (not the whole hydrate) before building the launch blob", () => {
    const start = SRC.indexOf("async function beginCheckoutAndLaunch()");
    expect(start).toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf("window.location.href = session.url;", start));
    const wait = body.indexOf("await ensureProjectionLoaded();");
    // The slow lever extraction must not gate a payment.
    expect(body).not.toContain("waitForOnboardingHydration");
    const build = body.indexOf("buildPendingLaunchBlob()");
    expect(wait).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(-1);
    expect(wait).toBeLessThan(build);
  });
});
