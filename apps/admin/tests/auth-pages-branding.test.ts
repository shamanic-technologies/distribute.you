import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Auth pages branding", () => {
  const signInPath = path.join(
    __dirname,
    "../src/app/(authed)/sign-in/[[...sign-in]]/page.tsx"
  );
  const signUpPath = path.join(
    __dirname,
    "../src/app/(authed)/sign-up/[[...sign-up]]/page.tsx"
  );
  const signInContent = fs.readFileSync(signInPath, "utf-8");
  const signUpContent = fs.readFileSync(signUpPath, "utf-8");

  it("names the brand distribute.you, never the bare verb", () => {
    expect(signInContent).toContain("distribute.you");
    expect(signInContent).not.toContain("MCP Factory");
    expect(signInContent).not.toContain("mcpfactory");
  });

  it("names the brand distribute.you on sign-up too", () => {
    expect(signUpContent).toContain("distribute.you");
    expect(signUpContent).not.toContain("MCP Factory");
    expect(signUpContent).not.toContain("mcpfactory");
  });

  it("sign-in page should have branding panel with tagline", () => {
    expect(signInContent).toContain("The Stripe of Distribution");
    expect(signInContent).toContain("automated");
  });

  it("sign-up page should have branding panel with tagline", () => {
    expect(signUpContent).toContain("The Stripe of Distribution");
    expect(signUpContent).toContain("automated");
  });

  it("sign-in page should link to distribute.you", () => {
    expect(signInContent).toContain("https://distribute.you");
  });

  it("sign-up page should link to distribute.you", () => {
    expect(signUpContent).toContain("https://distribute.you");
  });

  it("sign-up page should use logo-distribute.svg", () => {
    expect(signUpContent).toContain("logo-distribute.svg");
  });

  it("sign-in page should use logo-distribute.svg", () => {
    expect(signInContent).toContain("logo-distribute.svg");
  });
});

describe("Onboarding page should not reference mcpfactory", () => {
  const onboardingPath = path.join(
    __dirname,
    "../src/app/(authed)/onboarding/page.tsx"
  );
  const content = fs.readFileSync(onboardingPath, "utf-8");

  it("should use Clerk SDK for org creation and not reference mcpfactory", () => {
    expect(content).toContain("createOrganization");
    expect(content).toContain("@clerk/nextjs");
    expect(content).not.toContain("mcpfactory");
  });
});

describe("brand name", () => {
  // "distribute" is an ordinary English verb, and an unrelated npm package.
  // The PRODUCT is always distribute.you, so the wordmark a staff member reads
  // and the description a crawler indexes both spell it in full.
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf-8");

  const WORDMARK_PAGES = [
    "src/app/(authed)/sign-in/[[...sign-in]]/page.tsx",
    "src/app/(authed)/sign-up/[[...sign-up]]/page.tsx",
  ];

  it("spells the rendered wordmark in full on every page that draws one", () => {
    for (const page of WORDMARK_PAGES) {
      const bare = read(page)
        .split("\n")
        .filter((line) => line.trim() === "distribute");
      expect(`${page}:${bare.length}`).toBe(`${page}:0`);
    }
  });

  const METADATA_PAGES = [
    "src/app/(authed)/sign-in/[[...sign-in]]/layout.tsx",
    "src/app/(authed)/sign-up/[[...sign-up]]/layout.tsx",
  ];

  it("names the product in full in the description a crawler reads", () => {
    for (const page of METADATA_PAGES) {
      const source = read(page);
      expect(`${page}:${/distribute(?!\.you)/.test(source)}`).toBe(`${page}:false`);
    }
  });
});
