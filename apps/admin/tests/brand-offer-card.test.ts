import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("api.ts — brand user-fields (the 7 confirmed offer fields)", () => {
  const content = read("../src/lib/api.ts");

  it("exposes the 7 user-field keys (services + 6 Hormozi levers)", () => {
    expect(content).toContain("export const USER_FIELD_KEYS");
    for (const key of [
      '"services"',
      '"dreamOutcome"',
      '"perceivedLikelihood"',
      '"socialProof"',
      '"riskReversal"',
      '"urgency"',
      '"scarcity"',
    ]) {
      expect(content).toContain(key);
    }
  });

  it("exposes getBrandUserFields + saveBrandUserFields on the user-fields path", () => {
    expect(content).toContain("export async function getBrandUserFields");
    expect(content).toContain("export async function saveBrandUserFields");
    expect(content).toContain("/user-fields");
    expect(content).toContain("BrandUserFieldsResponseSchema.safeParse");
  });

  it("normalizes a degenerate user-field value to null (never throws the whole read)", () => {
    expect(content).toContain("const UserFieldValueSchema");
    expect(content).toContain("BrandUserFieldsResponseSchema");
  });

  it("SALES_PROFILE_FIELDS carries services + perceivedLikelihood for AI prefill", () => {
    expect(content).toContain('key: "services"');
    expect(content).toContain('key: "perceivedLikelihood"');
  });
});

describe("BrandOfferCard component", () => {
  const content = read("../src/components/settings/brand-offer-card.tsx");

  it("is a client component reading + writing user-fields", () => {
    expect(content).toContain('"use client"');
    expect(content).toContain("getBrandUserFields(brandId)");
    expect(content).toContain("saveBrandUserFields(brandId, profileToUserFieldsPayload(fields))");
    expect(content).toContain('["brandUserFields", brandId]');
  });

  it("renders the 7 offer fields via the shared FieldEditor primitives", () => {
    expect(content).toContain("ALL_FIELDS.map");
    expect(content).toContain("TextEditor");
    expect(content).toContain("ListEditor");
  });

  it("has an AI-prefill action that fills empty fields via extractBrandFields", () => {
    expect(content).toContain("Prefill with AI");
    expect(content).toContain("extractBrandFields([brandId], SALES_PROFILE_FIELDS");
    expect(content).toContain("isEmptyField");
  });

  it("seeds dreamOutcome from the valueProposition extraction", () => {
    expect(content).toContain("dreamOutcome:");
    expect(content).toContain('"valueProposition"');
  });

  it("uses a live dirty-compare against the saved baseline (no sticky latch)", () => {
    expect(content).toContain("fieldsEqual(offerDraft, offerBaseline)");
  });
});

describe("FieldEditor primitives (ported from dashboard)", () => {
  const content = read("../src/components/brand-profile/field-editor.tsx");

  it("declares the 7 confirmed user-fields incl services + dreamOutcome", () => {
    expect(content).toContain("export const ALL_FIELDS");
    expect(content).toContain('key: "services"');
    expect(content).toContain('key: "dreamOutcome"');
    expect(content).toContain('label: "Dream outcome"');
  });

  it("exports the text + list inline editors", () => {
    expect(content).toContain("export function TextEditor");
    expect(content).toContain("export function ListEditor");
  });
});

describe("Brand Settings page mounts the offer card", () => {
  const content = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("renders the Your offer section with the editor card", () => {
    expect(content).toContain("Your offer");
    expect(content).toContain("<BrandOfferCard brandId={brandId} />");
  });
});
