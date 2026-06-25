import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: @clerk/nextjs must be v6+ for Next.js 15 compatibility.
 *
 * In v5, auth() is synchronous and calls headers() synchronously.
 * Next.js 15 made headers() async, so auth().orgId was always undefined —
 * the API proxy returned 403 "No active organization" on every request.
 */
describe("@clerk/nextjs v6 compatibility", () => {
  const pkgPath = path.resolve(__dirname, "../package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  it("should use @clerk/nextjs v6+", () => {
    const version = pkg.dependencies["@clerk/nextjs"];
    expect(version).toMatch(/^[\^~]?\d+/);
    const major = parseInt(version.replace(/^[\^~]/, ""), 10);
    expect(major).toBeGreaterThanOrEqual(6);
  });

  it("ClerkProvider should use dynamic prop", () => {
    // Moved out of root `src/app/layout.tsx` into the `(authed)` route group
    // so `/report/*` can render statically (ISR). ClerkProvider's `dynamic`
    // prop force-marks every descendant page as dynamic, defeating
    // `export const revalidate`. The `dynamic` requirement itself is
    // unchanged — Next 15 made `headers()` async, and Clerk v6 needs
    // `dynamic` to await it before resolving `auth().orgId`.
    const layoutPath = path.resolve(__dirname, "../src/app/(authed)/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("<ClerkProvider dynamic>");
  });

  it("onboarding should use full page reload after setActive", () => {
    const onboardingPath = path.resolve(
      __dirname,
      "../src/components/onboarding/onboarding.tsx"
    );
    const content = fs.readFileSync(onboardingPath, "utf-8");
    expect(content).toContain('window.location.href =');
    expect(content).not.toContain('router.push("/")');
  });

  it("API proxy should await auth() for orgId", () => {
    const proxyPath = path.resolve(
      __dirname,
      "../src/app/(authed)/api/v1/[...path]/route.ts"
    );
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain("await auth()");
    expect(content).toContain("orgId");
  });
});
