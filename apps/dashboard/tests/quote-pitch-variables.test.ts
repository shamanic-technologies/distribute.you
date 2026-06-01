import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  buildJournalistRequestVariable,
  buildExpertAnswerContextVariable,
  buildExpertQuotePitchVariables,
  coerceExtractedToString,
  ExpertQuotePitchInputError,
} from "../src/lib/quote-pitch-variables";

const FULL_IDENTITY = {
  brandName: "Acme SaaS",
  brandUrl: "https://acme.example",
  brandLogoUrl: "https://acme.example/logo.png",
};
const FULL_EXTRACTED = {
  brandDescription: "B2B SaaS for scaling eng teams.",
  brandHeadquartersLocation: "San Francisco, CA",
  expertBio: "Ex-Stripe; scaled three eng orgs.",
};
const FULL_EXPERT = {
  expertName: "Jordan Avery",
  expertTitle: "CEO & Co-founder",
  expertPhotoUrl: "https://acme.example/team/jordan.jpg",
  expertLinkedIn: "https://linkedin.com/in/jordanavery",
};
const FULL_OPP = {
  opportunityText: "Most common scaling mistake from 5 to 25 engineers?",
  mediaOutlet: "TechCrunch",
  journalistName: "Jane Doe",
  deadline: "2026-06-05T17:00:00.000Z",
  whyRelevant: "Brand scaled exactly this",
  category: "Engineering",
};

describe("expert-quote-pitch variable assembly (content-gen PR #124 all-required contract)", () => {
  it("buildJournalistRequestVariable maps opportunity → { question, mediaOutlet, source, deadline }", () => {
    expect(buildJournalistRequestVariable(FULL_OPP)).toEqual({
      question: FULL_OPP.opportunityText,
      mediaOutlet: "TechCrunch",
      source: "Jane Doe",
      deadline: "2026-06-05T17:00:00.000Z",
    });
  });

  it("buildJournalistRequestVariable normalizes missing fields to null, keeps question", () => {
    expect(buildJournalistRequestVariable({ opportunityText: "Q only" })).toEqual({
      question: "Q only",
      mediaOutlet: null,
      source: null,
      deadline: null,
    });
  });

  it("buildExpertAnswerContextVariable maps whyRelevant + category", () => {
    expect(buildExpertAnswerContextVariable(FULL_OPP)).toEqual({
      whyRelevant: "Brand scaled exactly this",
      category: "Engineering",
    });
  });

  it("coerceExtractedToString flattens string / object / array / null", () => {
    expect(coerceExtractedToString("  hi  ")).toBe("hi");
    expect(coerceExtractedToString(null)).toBe("");
    expect(coerceExtractedToString(undefined)).toBe("");
    expect(coerceExtractedToString(["a", "", "b"])).toBe("a\nb");
    expect(coerceExtractedToString({ city: "SF", country: "USA", empty: null })).toBe(
      "city: SF\ncountry: USA",
    );
  });

  it("buildExpertQuotePitchVariables emits the byte-equal all-required contract", () => {
    const out = buildExpertQuotePitchVariables({
      identity: FULL_IDENTITY,
      extracted: FULL_EXTRACTED,
      expert: FULL_EXPERT,
      opportunity: FULL_OPP,
    });
    expect(Object.keys(out).sort()).toEqual(
      [
        "brands",
        "expertAnswerContext",
        "expertBio",
        "expertLinkedIn",
        "expertName",
        "expertPhotoUrl",
        "expertTitle",
        "journalistRequest",
      ].sort(),
    );
    expect(out.brands).toEqual([
      {
        brandName: "Acme SaaS",
        brandUrl: "https://acme.example",
        brandDescription: "B2B SaaS for scaling eng teams.",
        brandHeadquartersLocation: "San Francisco, CA",
        brandLogoUrl: "https://acme.example/logo.png",
      },
    ]);
    expect(out.expertName).toBe("Jordan Avery");
    expect(out.expertBio).toBe("Ex-Stripe; scaled three eng orgs.");
    expect(out.expertPhotoUrl).toBe(FULL_EXPERT.expertPhotoUrl);
  });

  it("brands is ALWAYS an array even for a single brand", () => {
    const out = buildExpertQuotePitchVariables({
      identity: FULL_IDENTITY,
      extracted: FULL_EXTRACTED,
      expert: FULL_EXPERT,
      opportunity: FULL_OPP,
    });
    expect(Array.isArray(out.brands)).toBe(true);
    expect((out.brands as unknown[]).length).toBe(1);
  });

  it.each([
    ["brandLogoUrl", { ...FULL_IDENTITY, brandLogoUrl: null }, FULL_EXTRACTED, FULL_EXPERT],
    ["brandLogoUrl", { ...FULL_IDENTITY, brandLogoUrl: "   " }, FULL_EXTRACTED, FULL_EXPERT],
    ["brandName", { ...FULL_IDENTITY, brandName: null }, FULL_EXTRACTED, FULL_EXPERT],
    ["brandDescription", FULL_IDENTITY, { ...FULL_EXTRACTED, brandDescription: "" }, FULL_EXPERT],
    [
      "brandHeadquartersLocation",
      FULL_IDENTITY,
      { ...FULL_EXTRACTED, brandHeadquartersLocation: null },
      FULL_EXPERT,
    ],
    ["expertBio", FULL_IDENTITY, { ...FULL_EXTRACTED, expertBio: "" }, FULL_EXPERT],
    ["expertName", FULL_IDENTITY, FULL_EXTRACTED, { ...FULL_EXPERT, expertName: "" }],
    ["expertPhotoUrl", FULL_IDENTITY, FULL_EXTRACTED, { ...FULL_EXPERT, expertPhotoUrl: null }],
  ])(
    "throws ExpertQuotePitchInputError naming %s when it is empty (no placeholder, no partial body)",
    (field, identity, extracted, expert) => {
      expect(() =>
        buildExpertQuotePitchVariables({
          identity: identity as never,
          extracted: extracted as never,
          expert: expert as never,
          opportunity: FULL_OPP,
        }),
      ).toThrow(ExpertQuotePitchInputError);
      try {
        buildExpertQuotePitchVariables({
          identity: identity as never,
          extracted: extracted as never,
          expert: expert as never,
          opportunity: FULL_OPP,
        });
      } catch (e) {
        expect((e as Error).message).toContain(field as string);
      }
    },
  );

  it("does NOT emit the legacy {brand, request, additionalContext} keys", () => {
    const out = buildExpertQuotePitchVariables({
      identity: FULL_IDENTITY,
      extracted: FULL_EXTRACTED,
      expert: FULL_EXPERT,
      opportunity: FULL_OPP,
    });
    expect(out).not.toHaveProperty("brand");
    expect(out).not.toHaveProperty("request");
    expect(out).not.toHaveProperty("additionalContext");
  });
});

describe("expert-quote-pitch consumers send the new all-required contract", () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");
  const apiLib = read("../src/lib/api.ts");

  it("api.ts generateExpertQuotePitch assembles via buildExpertQuotePitchVariables (no legacy builders)", () => {
    const block =
      apiLib.split("export async function generateExpertQuotePitch(")[1]?.split(
        "\nexport ",
      )[0] ?? "";
    expect(block).toContain("buildExpertQuotePitchVariables");
    expect(block).toContain("extractBrandFields");
    expect(block).toContain("getBrand");
    // Legacy assembly must be gone from the codebase.
    expect(apiLib).not.toContain("buildBrandVariableFromInputs");
  });

  it("public-report draft route extracts the brand+expert fields and builds the new contract", () => {
    const route = read(
      "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/draft/route.ts",
    );
    expect(route).toContain("buildExpertQuotePitchVariables");
    expect(route).toContain("/brands/extract-fields");
    expect(route).toContain("expertPhotoUrl");
    expect(route).toContain("brandHeadquartersLocation");
    // No legacy contract keys, no removed builders.
    expect(route).not.toContain("buildQuoteRequestVariable");
    expect(route).not.toContain("buildAdditionalContextVariable");
    expect(route).not.toContain("CLIENT_SUPPLIED_VARS");
  });

  it("shared helper no longer exports the legacy builders", () => {
    const helper = read("../src/lib/quote-pitch-variables.ts");
    expect(helper).not.toContain("buildBrandVariableFromInputs");
    expect(helper).not.toContain("ExpertBrandInputs");
  });
});
