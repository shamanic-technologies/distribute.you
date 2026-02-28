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
    expect(version).toMatch(/^[\^~]?6/);
  });

  it("ClerkProvider should use dynamic prop", () => {
    const layoutPath = path.resolve(__dirname, "../src/app/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("<ClerkProvider dynamic>");
  });

  it("onboarding should use full page reload after setActive", () => {
    const onboardingPath = path.resolve(
      __dirname,
      "../src/app/onboarding/page.tsx"
    );
    const content = fs.readFileSync(onboardingPath, "utf-8");
    expect(content).toContain('window.location.href = "/"');
    expect(content).not.toContain('router.push("/")');
  });

  it("API proxy should await auth() for orgId", () => {
    const proxyPath = path.resolve(
      __dirname,
      "../src/app/api/v1/[...path]/route.ts"
    );
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain("await auth()");
    expect(content).toContain("orgId");
  });
});
