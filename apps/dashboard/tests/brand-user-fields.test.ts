import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Confirmed brand USER-FIELDS client surface (2-layer brand-fields model).
// The 7 user-facing fields the user validates, each with a provenance tag. The
// dashboard reads/writes them via api-service /v1/brands/:id/user-fields.
// Source-substring guards — tsc cannot catch wire path / key / shape drift.

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
const apiContent = read("../src/lib/api.ts");

describe("Brand user-fields client surface", () => {
  it("exposes getBrandUserFields as a GET on /user-fields with safeParse", () => {
    const start = apiContent.indexOf("export async function getBrandUserFields");
    expect(start).toBeGreaterThan(-1);
    const body = apiContent.slice(start, apiContent.indexOf("\n}", start) + 2);
    expect(body).toContain("/user-fields");
    expect(body).toContain("BrandUserFieldsResponseSchema.safeParse");
  });

  it("exposes saveBrandUserFields as an idempotent PUT on /user-fields", () => {
    const start = apiContent.indexOf("export async function saveBrandUserFields");
    expect(start).toBeGreaterThan(-1);
    const body = apiContent.slice(start, apiContent.indexOf("\n}", start) + 2);
    expect(body).toContain('method: "PUT"');
    expect(body).toContain("/user-fields");
    expect(body).toContain("body: { fields }");
    expect(body).toContain("BrandUserFieldsResponseSchema.safeParse");
  });

  it("locks the 7 user-field keys, with dreamOutcome (not valueProposition)", () => {
    const start = apiContent.indexOf("export const USER_FIELD_KEYS");
    const block = apiContent.slice(start, apiContent.indexOf("] as const", start));
    for (const key of [
      "services",
      "dreamOutcome",
      "perceivedLikelihood",
      "socialProof",
      "riskReversal",
      "urgency",
      "scarcity",
    ]) {
      expect(block).toContain(`"${key}"`);
    }
    expect(block).not.toContain("valueProposition");
  });

  it("validates each field as { value, provenance } with the provenance enum", () => {
    expect(apiContent).toContain("const UserFieldSchema = z.object({");
    expect(apiContent).toContain('provenance: z.enum(["confirmed", "suggested", "extracted"])');
    expect(apiContent).toContain("value: UserFieldValueSchema");
  });
});
