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

  it("conditions the extraction on the entered services (prepends them to each description)", () => {
    expect(content).toContain("export function buildExtractDefs");
    expect(content).toContain("servicesContext");
    expect(content).toContain("This brand sells the following services/products:");
  });

  it("saves only the subset's keys + seeds dreamOutcome from valueProposition", () => {
    expect(content).toContain("export function profileToPayload");
    expect(content).toContain("EXTRACT_KEY_FOR_FIELD");
    expect(content).toContain('dreamOutcome: "valueProposition"');
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

  it("has an AI-prefill that fills empty fields, optionally conditioned on services", () => {
    expect(content).toContain("buildExtractDefs(defs, servicesContext)");
    expect(content).toContain("isEmptyField");
    expect(content).toContain("conditionOnServices");
    expect(content).toContain("Prefill from services");
  });

  it("reads the saved services from the shared cache as the levers' context", () => {
    expect(content).toContain("data?.fields?.services?.value");
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
