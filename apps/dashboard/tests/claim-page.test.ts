import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const claimPagePath = path.resolve(
  __dirname,
  "../src/app/claim/[code]/page.tsx"
);
const proxyPath = path.resolve(__dirname, "../src/proxy.ts");

describe("Claim promo page", () => {
  const content = fs.readFileSync(claimPagePath, "utf-8");

  it("should exist", () => {
    expect(fs.existsSync(claimPagePath)).toBe(true);
  });

  it("should store promo code in sessionStorage before OAuth redirect", () => {
    expect(content).toContain("distribute_promo_code");
    expect(content).toContain("sessionStorage.setItem");
    const promoIndex = content.indexOf("distribute_promo_code");
    const redirectIndex = content.indexOf("authenticateWithRedirect");
    expect(promoIndex).toBeLessThan(redirectIndex);
  });

  it("should store auth intent as signup", () => {
    expect(content).toContain('sessionStorage.setItem("distribute_auth_intent"');
  });

  it("should use Google OAuth strategy", () => {
    expect(content).toContain('"oauth_google"');
  });

  it("should display $10 credit messaging", () => {
    expect(content).toContain("$10");
    expect(content).toContain("free credits");
  });

  it("should have a claim button", () => {
    expect(content).toContain("Claim my credit");
  });

  it("should use confetti on page load", () => {
    expect(content).toContain("canvas-confetti");
    expect(content).toContain("confetti(");
  });

  it("should read the code param from the URL", () => {
    expect(content).toContain("useParams");
    expect(content).toContain("params.code");
  });
});

describe("Middleware allows /claim as public route", () => {
  const content = fs.readFileSync(proxyPath, "utf-8");

  it("should include /claim in public routes", () => {
    expect(content).toContain('"/claim(.*)"');
  });

  it("should redirect authenticated users away from /claim", () => {
    // /claim is in isAuthRoute, so authenticated users get redirected to /
    const authRouteSection = content.slice(
      content.indexOf("isAuthRoute"),
      content.indexOf("isAuthRoute") + 200
    );
    expect(authRouteSection).toContain("/claim");
  });
});
