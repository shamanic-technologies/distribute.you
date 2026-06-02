import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  buildJournalistRequestVariable,
  buildExpertAnswerContextVariable,
  buildExpertQuotePitchVariables,
  coerceExtractedToString,
  selectPriorSubmittedPitches,
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
const FULL_ANSWER_CTX = {
  brandEvidence:
    "Scaled from 5 to 25 engineers in 18 months; cut onboarding from 6 weeks to 9 days.",
  evidenceSourceUrls: [
    "https://acme.example/about",
    "https://acme.example/blog/scaling",
  ],
  revisionInstructions: "Lead with the onboarding metric; drop buzzwords.",
  priorSubmittedPitches: [
    {
      draft: "Past pitch about hiring velocity.",
      status: "published",
      submittedAt: "2026-05-01T10:00:00.000Z",
    },
  ],
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

  it("buildExpertAnswerContextVariable maps brandEvidence + sources + revision + prior pitches (no whyRelevant/category)", () => {
    const out = buildExpertAnswerContextVariable(FULL_ANSWER_CTX);
    expect(out).toEqual({
      brandEvidence: FULL_ANSWER_CTX.brandEvidence,
      evidenceSourceUrls: FULL_ANSWER_CTX.evidenceSourceUrls,
      revisionInstructions: FULL_ANSWER_CTX.revisionInstructions,
      priorSubmittedPitches: FULL_ANSWER_CTX.priorSubmittedPitches,
    });
    expect(out).not.toHaveProperty("whyRelevant");
    expect(out).not.toHaveProperty("category");
  });

  it("buildExpertAnswerContextVariable empties blank brandEvidence to null, keeps null revision + [] pitches", () => {
    const out = buildExpertAnswerContextVariable({
      brandEvidence: "   ",
      evidenceSourceUrls: [],
      revisionInstructions: null,
      priorSubmittedPitches: [],
    });
    expect(out.brandEvidence).toBeNull();
    expect(out.revisionInstructions).toBeNull();
    expect(out.priorSubmittedPitches).toEqual([]);
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
      answerContext: FULL_ANSWER_CTX,
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
    expect(out.expertAnswerContext).toEqual({
      brandEvidence: FULL_ANSWER_CTX.brandEvidence,
      evidenceSourceUrls: FULL_ANSWER_CTX.evidenceSourceUrls,
      revisionInstructions: FULL_ANSWER_CTX.revisionInstructions,
      priorSubmittedPitches: FULL_ANSWER_CTX.priorSubmittedPitches,
    });
  });

  it("brands is ALWAYS an array even for a single brand", () => {
    const out = buildExpertQuotePitchVariables({
      identity: FULL_IDENTITY,
      extracted: FULL_EXTRACTED,
      expert: FULL_EXPERT,
      opportunity: FULL_OPP,
      answerContext: FULL_ANSWER_CTX,
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
          answerContext: FULL_ANSWER_CTX,
        }),
      ).toThrow(ExpertQuotePitchInputError);
      try {
        buildExpertQuotePitchVariables({
          identity: identity as never,
          extracted: extracted as never,
          expert: expert as never,
          opportunity: FULL_OPP,
          answerContext: FULL_ANSWER_CTX,
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
      answerContext: FULL_ANSWER_CTX,
    });
    expect(out).not.toHaveProperty("brand");
    expect(out).not.toHaveProperty("request");
    expect(out).not.toHaveProperty("additionalContext");
  });
});

describe("selectPriorSubmittedPitches — brand voice anchor (3 most recent submitted)", () => {
  const base = {
    draft: "A pitch.",
    status: "submitted",
    submittedAt: "2026-05-10T10:00:00.000Z",
    createdAt: "2026-05-10T09:00:00.000Z",
    brandIds: ["brand-A"],
  };

  it("keeps only this brand's submitted/selected/published rows with a non-empty draft", () => {
    const rows = [
      { ...base, status: "drafted" }, // not submitted → excluded
      { ...base, brandIds: ["brand-B"] }, // other brand → excluded
      { ...base, draft: "   " }, // empty draft → excluded
      { ...base, draft: null }, // null draft → excluded
      { ...base, status: "selected", draft: "selected pitch" }, // kept
      { ...base, status: "published", draft: "published pitch" }, // kept
    ];
    const out = selectPriorSubmittedPitches(rows, "brand-A");
    expect(out.map((p) => p.draft)).toEqual(["selected pitch", "published pitch"]);
  });

  it("sorts by submittedAt desc (createdAt fallback) and caps at the limit", () => {
    const rows = [
      { ...base, draft: "old", submittedAt: "2026-01-01T00:00:00.000Z" },
      { ...base, draft: "new", submittedAt: "2026-06-01T00:00:00.000Z" },
      { ...base, draft: "mid", submittedAt: "2026-03-01T00:00:00.000Z" },
    ];
    expect(selectPriorSubmittedPitches(rows, "brand-A", 2).map((p) => p.draft)).toEqual([
      "new",
      "mid",
    ]);
  });

  it("returns [] (never throws) when the brand has no submitted pitches", () => {
    expect(selectPriorSubmittedPitches([], "brand-A")).toEqual([]);
  });

  it("projects to { draft, status, submittedAt } only", () => {
    const out = selectPriorSubmittedPitches([base], "brand-A");
    expect(out).toEqual([
      { draft: "A pitch.", status: "submitted", submittedAt: base.submittedAt },
    ]);
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
