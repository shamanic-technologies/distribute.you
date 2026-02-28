import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Auth pages branding", () => {
  const signInPath = path.join(
    __dirname,
    "../src/app/sign-in/[[...sign-in]]/page.tsx"
  );
  const signUpPath = path.join(
    __dirname,
    "../src/app/sign-up/[[...sign-up]]/page.tsx"
  );
  const signInContent = fs.readFileSync(signInPath, "utf-8");
  const signUpContent = fs.readFileSync(signUpPath, "utf-8");

  it("sign-in page should use distribute brand name", () => {
    expect(signInContent).toContain("distribute");
    expect(signInContent).not.toContain("MCP Factory");
    expect(signInContent).not.toContain("mcpfactory");
  });

  it("sign-up page should use distribute brand name", () => {
    expect(signUpContent).toContain("distribute");
    expect(signUpContent).not.toContain("MCP Factory");
    expect(signUpContent).not.toContain("mcpfactory");
  });

  it("sign-in page should have branding panel with tagline", () => {
    expect(signInContent).toContain("The Stripe for Distribution");
    expect(signInContent).toContain("automated");
  });

  it("sign-up page should have branding panel with tagline", () => {
    expect(signUpContent).toContain("The Stripe for Distribution");
    expect(signUpContent).toContain("automated");
  });

  it("sign-in page should link to distribute.you", () => {
    expect(signInContent).toContain("https://distribute.you");
  });

  it("sign-up page should link to distribute.you", () => {
    expect(signUpContent).toContain("https://distribute.you");
  });

  it("sign-up page should use logo-head.jpg", () => {
    expect(signUpContent).toContain("logo-head.jpg");
  });

  it("sign-in page should use logo-head.jpg", () => {
    expect(signInContent).toContain("logo-head.jpg");
  });
});

describe("Onboarding page should not reference mcpfactory", () => {
  const onboardingPath = path.join(
    __dirname,
    "../src/app/onboarding/page.tsx"
  );
  const content = fs.readFileSync(onboardingPath, "utf-8");

  it("should use Clerk SDK for org creation and not reference mcpfactory", () => {
    expect(content).toContain("createOrganization");
    expect(content).toContain("@clerk/nextjs");
    expect(content).not.toContain("mcpfactory");
  });
});
