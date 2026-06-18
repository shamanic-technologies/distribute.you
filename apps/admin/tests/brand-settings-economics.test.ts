import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("api.ts — brand sales-economics businessModel wiring", () => {
  const content = read("../src/lib/api.ts");

  it("exposes a BrandBusinessModel type", () => {
    expect(content).toContain('export type BrandBusinessModel = "b2c" | "b2b"');
  });

  it("BrandSalesEconomics carries businessModel (read shape includes it)", () => {
    expect(content).toContain("businessModel: BrandBusinessModel | null");
  });

  it("the Zod schema parses businessModel as a nullable b2c/b2b literal", () => {
    expect(content).toContain(
      'businessModel: z.union([z.literal("b2c"), z.literal("b2b")]).nullable()',
    );
  });

  it("keeps businessModel optional on the input so the campaign form (5 metrics only) still typechecks", () => {
    expect(content).toContain("businessModel?: BrandBusinessModel | null");
  });

  it("PUT body sends businessModel only when defined (partial-update: omit = unchanged, null = clear)", () => {
    expect(content).toContain("input.businessModel !== undefined");
    expect(content).toContain("{ businessModel: input.businessModel }");
  });
});

describe("BrandSalesEconomicsCard component", () => {
  const content = read("../src/components/settings/brand-sales-economics-card.tsx");

  it("is a client component", () => {
    expect(content).toContain('"use client"');
  });

  it("reads via getBrandSalesEconomics and writes via saveBrandSalesEconomics", () => {
    expect(content).toContain("getBrandSalesEconomics(brandId)");
    expect(content).toContain("saveBrandSalesEconomics(brandId, input)");
  });

  it("shares the brandSalesEconomics query key with the campaign form", () => {
    expect(content).toContain('["brandSalesEconomics", brandId]');
  });

  it("writes the saved row to cache and invalidates the revenue overview on success", () => {
    expect(content).toContain('queryClient.setQueryData(["brandSalesEconomics", brandId], res)');
    expect(content).toContain('invalidateQueries({ queryKey: ["featureRevenue"] })');
  });

  it("renders the full funnel + business model + an explicit Save", () => {
    expect(content).toContain("Customer Lifetime Revenue");
    expect(content).toContain("Positive reply → meeting");
    expect(content).toContain("Website visit → meeting");
    expect(content).toContain("Meeting → close");
    expect(content).toContain("Website visit → close");
    expect(content).toContain("Business model");
    expect(content).toContain("Save");
  });
});

describe("Brand Settings page", () => {
  const content = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("renders the Sales Economics section with the editor card", () => {
    expect(content).toContain("Sales Economics");
    expect(content).toContain("<BrandSalesEconomicsCard brandId={brandId} />");
  });
});
