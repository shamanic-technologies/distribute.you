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

  it("SALES_PROFILE_FIELDS carries services + perceivedLikelihood for AI prefill", () => {
    expect(content).toContain('key: "services"');
    expect(content).toContain('key: "perceivedLikelihood"');
  });
});

describe("user-fields-form — split field subsets + services-conditioned extraction", () => {
  const content = read("../src/lib/user-fields-form.ts");

  it("splits the fields into a services-only subset and a levers-only subset", () => {
    expect(content).toContain("export const SERVICES_FIELDS");
    expect(content).toContain("export const LEVER_FIELDS");
    expect(content).toContain('f.key === "services"');
    expect(content).toContain('f.key !== "services"');
  });

  it("no longer builds its own extraction defs — both cards read the shared set", () => {
    // The request defs come from `prefillDefsFor(keys, USER_PROFILE_FIELDS)` in
    // lib/offer-prefill.ts, so a lever means the same thing here, on the customer
    // Strategy page and in onboarding.
    expect(content).not.toContain("buildExtractDefs");
    expect(content).not.toContain("HORMOZI_LEVER_GUIDANCE");
    // brand-service already injects the brand's CONFIRMED fields as authoritative
    // context, so repeating the services in front of all six levers was noise.
    expect(content).not.toContain("This brand sells the following services");
  });

  it("has no valueProposition remap — dreamOutcome is asked for under its own key", () => {
    // The extraction prompt names the requested JSON keys verbatim, so asking for
    // `valueProposition` made the model write a generic value proposition instead of
    // the dream outcome the lever is about.
    expect(content).not.toContain("EXTRACT_KEY_FOR_FIELD");
    expect(content).not.toContain('dreamOutcome: "valueProposition"');
  });

  it("saves only the subset's keys", () => {
    expect(content).toContain("export function profileToPayload");
  });
});

describe("BrandUserFieldsCard — generic subset editor", () => {
  const content = read("../src/components/settings/brand-user-fields-card.tsx");

  it("is a client component reading + writing user-fields for a field subset", () => {
    expect(content).toContain('"use client"');
    expect(content).toContain("getBrandUserFields(brandId)");
    expect(content).toContain("saveBrandUserFields(brandId, profileToPayload(f, defs))");
    expect(content).toContain('["brandUserFields", brandId]');
  });

  it("renders its subset via the shared FieldEditor primitives", () => {
    expect(content).toContain("defs.map");
    expect(content).toContain("TextEditor");
    expect(content).toContain("ListEditor");
  });

  it("has an update-from-the-website button that RESETS every field in the subset", () => {
    expect(content).toContain("prefillDefsFor(prefillKeys, USER_PROFILE_FIELDS)");
    expect(content).toContain("applyExtractionToDraft");
    expect(content).toContain("conditionOnServices");
    // A reset, not a top-up: no skip-if-already-filled guard, and a field the
    // extraction does not answer is cleared rather than left alone.
    expect(content).not.toContain("isEmptyField");
    expect(content).toContain("resetCache: true");
  });

  it("reads the saved services from the shared cache to gate the levers button", () => {
    expect(content).toContain("data?.fields?.services?.value");
    expect(content).toContain("leversBlockedOnServices");
  });

  it("requests suggest mode on BOTH cards", () => {
    // `extract` is site-grounded and returns the literal string "Unknown" for
    // anything the site does not state outright, which is not a value anyone wants
    // to read in a field.
    expect(content).toContain('mode: "suggest"');
    expect(content).not.toContain('mode: "extract"');
    expect(content).not.toContain('conditionOnServices ? "suggest" : "extract"');
  });

  it("uses a live dirty-compare against the saved baseline (no sticky latch)", () => {
    expect(content).toContain("subsetEqual(draft, baseline, defs)");
  });
});

describe("Brand Settings page mounts the two split cards", () => {
  const content = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("renders a Services sold card and a Your offer (levers) card", () => {
    expect(content).toContain("Services sold");
    expect(content).toContain("Your offer");
    expect(content).toContain("defs={SERVICES_FIELDS}");
    expect(content).toContain("defs={LEVER_FIELDS}");
    expect(content).toContain("conditionOnServices");
  });
});
