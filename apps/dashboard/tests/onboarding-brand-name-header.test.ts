import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Source-substring guards: this module imports through the `@` alias, which vitest
// does not resolve in this repo, so the assertions read the function bodies rather
// than calling them.
const onboardingPath = path.resolve(
  __dirname,
  "../src/components/onboarding/onboarding.tsx",
);
const src = fs.readFileSync(onboardingPath, "utf-8");

function sliceFrom(marker: string, length: number): string {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return src.slice(at, at + length);
}

describe("onboarding step header shows the company name", () => {
  const header = sliceFrom("function BrandStepHeader(", 1400);

  it("accepts a name prop alongside the domain", () => {
    expect(header).toContain("name?: string | null");
  });

  it("prefers the resolved company name and falls back to the domain", () => {
    // A resumed session never saw the brand-create response, so the domain has to
    // remain a usable label rather than the header going blank.
    expect(header).toContain("name?.trim() || domain || hostname");
  });

  it("keys the logo on the domain, never on the label", () => {
    // `img.logo.dev/<company name>` resolves nothing, so reusing the label for the
    // logo silently empties the logo slot the moment a name is present.
    expect(header).toContain("const logoDomain = domain ?? hostname");
    expect(header).toContain("domain={logoDomain}");
    expect(header).not.toContain("domain={label}");
  });
});

describe("the resolved name comes from the brand-create response", () => {
  it("captures the name returned by upsertBrand", () => {
    expect(src).toContain(
      "const { brandId: newBrandId, name: createdBrandName } = await upsertBrand(brandUrl)",
    );
    expect(src).toContain("setResolvedBrandName(createdBrandName)");
  });

  it("keeps the resolved name distinct from the user-typed no-website name", () => {
    // `brandName` is what the user typed on the no-website path; conflating the two
    // would let a resolved name overwrite the user's own input.
    expect(src).toContain("const [resolvedBrandName, setResolvedBrandName]");
    expect(src).toContain("const headerName = noWebsiteMode ? null : resolvedBrandName");
  });

  it("does not persist the resolved name into the onboarding snapshot", () => {
    // Adding a field to the snapshot means bumping ONBOARDING_STATE_VERSION, which
    // strands an in-flight checkout. The name is cheap to re-resolve; a stranded
    // checkout is not.
    const parsed = sliceFrom("function parseOnboardingState(", 3000);
    expect(parsed).not.toContain("resolvedBrandName");
  });
});

describe("every step header reads the same identity", () => {
  it("passes the name to each header rendered from the main flow", () => {
    const mainFlowHeaders = src.match(
      /<BrandStepHeader domain=\{headerDomain\} hostname=\{headerHostname\}/g,
    );
    expect(mainFlowHeaders).toBeTruthy();
    // Every one of them must carry the name — a step left on the domain while its
    // siblings show the company name is an internally incoherent header.
    const withName = src.match(
      /<BrandStepHeader domain=\{headerDomain\} hostname=\{headerHostname\} name=\{headerName\}/g,
    );
    expect(withName).toHaveLength(mainFlowHeaders!.length);
  });

  it("threads the name into the audience step, which renders its own header", () => {
    expect(src).toContain("brandName={headerName}");
    const audiences = sliceFrom("function OnboardingAudiences(", 900);
    expect(audiences).toContain("brandName");
  });
});
