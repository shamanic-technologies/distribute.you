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

  it("exposes a BrandFunnelStage type with the 3 funnel elements", () => {
    expect(content).toContain('export type BrandFunnelStage =');
    expect(content).toContain('"website_signup"');
    expect(content).toContain('"website_purchase"');
    expect(content).toContain('"sales_meeting"');
  });

  it("exposes a BrandOptimizationGoal type (signups | booked_meetings | sales)", () => {
    expect(content).toContain(
      'export type BrandOptimizationGoal = "signups" | "booked_meetings" | "sales"',
    );
  });

  it("BrandSalesEconomics carries funnelStages + optimizationGoal (read shape includes them)", () => {
    expect(content).toContain("funnelStages: BrandFunnelStage[]");
    expect(content).toContain("optimizationGoal: BrandOptimizationGoal");
  });

  it("keeps funnelStages + optimizationGoal optional on the input (campaign form omits them)", () => {
    expect(content).toContain("funnelStages?: BrandFunnelStage[]");
    expect(content).toContain("optimizationGoal?: BrandOptimizationGoal");
  });

  it("the Zod schema parses funnelStages (array enum) + optimizationGoal (enum)", () => {
    expect(content).toContain("funnelStages: z.array(");
    expect(content).toContain('z.literal("website_signup")');
    expect(content).toContain('z.literal("booked_meetings")');
  });

  it("PUT body sends funnelStages + optimizationGoal only when defined (partial-update)", () => {
    expect(content).toContain("input.funnelStages !== undefined");
    expect(content).toContain("{ funnelStages: input.funnelStages }");
    expect(content).toContain("input.optimizationGoal !== undefined");
    expect(content).toContain("{ optimizationGoal: input.optimizationGoal }");
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

  it("renders the Sales-funnel multi-select with the 3 funnel elements", () => {
    expect(content).toContain("Sales funnel");
    expect(content).toContain("Website Signup");
    expect(content).toContain("Website Purchase");
    expect(content).toContain("Sales Meeting");
    expect(content).toContain("toggleFunnelStage");
  });

  it("renders the Optimization-goal single-choice (# Signups / # Booked Meetings / $ Sales)", () => {
    expect(content).toContain("Optimization goal");
    expect(content).toContain("# Signups");
    expect(content).toContain("# Booked Meetings");
    expect(content).toContain("$ Sales");
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
