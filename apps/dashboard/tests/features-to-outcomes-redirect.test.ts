import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

/**
 * Regression test: old /features/ URLs must redirect to /outcomes/.
 *
 * The routes were renamed in #315. Users with cached browser bundles
 * or bookmarks still hit /features/*, which returns a 404.
 * The next.config.ts redirect catches these and sends a 301.
 */
describe("/features/* → /outcomes/* redirect", () => {
  it("should define a permanent redirect from /features/:path* to /outcomes/:path*", async () => {
    const redirectsFn = nextConfig.redirects;
    expect(redirectsFn).toBeDefined();

    const redirects = await redirectsFn!();
    const featureRedirect = redirects.find(
      (r) => r.source === "/features/:path*"
    );

    expect(featureRedirect).toBeDefined();
    expect(featureRedirect!.destination).toBe("/outcomes/:path*");
    expect(featureRedirect!.permanent).toBe(true);
  });
});
